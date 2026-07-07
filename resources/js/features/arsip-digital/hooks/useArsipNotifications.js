import { useCallback, useEffect, useRef, useState } from 'react';
import { arsipApi } from '../../../libs/arsip_api';
import { formatArsipError } from '../../../libs/arsip_http';

function unreadCountOf(response) {
    const payload = response?.data ?? response ?? {};
    const count = Number(payload.unread_count ?? payload.count ?? 0);
    return Number.isFinite(count) ? count : 0;
}

export function useArsipNotifications({ enabled = true, intervalMs = 60000 } = {}) {
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const isMountedRef = useRef(false);
    const isFetchingRef = useRef(false);

    const refreshUnreadCount = useCallback(async () => {
        const isHidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
        if (!enabled || isHidden || isFetchingRef.current) return null;

        isFetchingRef.current = true;
        if (isMountedRef.current) setLoading(true);

        try {
            const response = await arsipApi.notificationUnreadCount();
            const nextCount = unreadCountOf(response);
            if (isMountedRef.current) {
                setUnreadCount(nextCount);
                setError(null);
            }
            return nextCount;
        } catch (err) {
            const formatted = await formatArsipError(err);
            if (isMountedRef.current) setError(formatted.message);
            return null;
        } finally {
            isFetchingRef.current = false;
            if (isMountedRef.current) setLoading(false);
        }
    }, [enabled]);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        if (!enabled) return undefined;

        refreshUnreadCount();
        const intervalId = setInterval(refreshUnreadCount, intervalMs);

        return () => {
            clearInterval(intervalId);
        };
    }, [enabled, intervalMs, refreshUnreadCount]);

    useEffect(() => {
        if (!enabled || typeof document === 'undefined') return undefined;

        const handleVisibility = () => {
            if (document.visibilityState === 'visible') refreshUnreadCount();
        };

        document.addEventListener('visibilitychange', handleVisibility);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [enabled, refreshUnreadCount]);

    return { unreadCount, loading, error, refreshUnreadCount };
}
