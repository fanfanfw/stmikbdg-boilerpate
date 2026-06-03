import { useEffect, useRef, useCallback } from 'react';

// --------------------------------------------------------------------------
// usePollingJob - Safe polling hook with cleanup, visibility, and max duration
// --------------------------------------------------------------------------

/**
 * @param {Object} options
 * @param {boolean} options.enabled - Whether polling is active
 * @param {string|number|null} options.jobId - Job identifier to poll
 * @param {function} options.pollFn - Async function that fetches job status, receives jobId
 * @param {number} [options.intervalMs=3000] - Poll interval in ms
 * @param {string[]} options.terminalStatuses - Statuses that stop polling
 * @param {function} [options.onUpdate] - Called with job data on each poll
 * @param {function} [options.onTerminal] - Called when terminal status reached or max duration
 * @param {number} [options.maxDurationMs] - Optional max polling duration before warning
 */
export function usePollingJob({
    enabled = false,
    jobId = null,
    pollFn,
    intervalMs = 3000,
    terminalStatuses = [],
    onUpdate,
    onTerminal,
    maxDurationMs,
}) {
    const intervalRef = useRef(null);
    const isMountedRef = useRef(true);
    const startTimeRef = useRef(null);
    const isPollingRef = useRef(false);

    const clearPolling = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    }, []);

    const poll = useCallback(async () => {
        if (!isMountedRef.current || !jobId || isPollingRef.current) return;

        // Max duration check
        if (maxDurationMs && startTimeRef.current) {
            const elapsed = Date.now() - startTimeRef.current;
            if (elapsed >= maxDurationMs) {
                clearPolling();
                if (isMountedRef.current && onTerminal) {
                    onTerminal({ jobId, timeout: true, status: null });
                }
                return;
            }
        }

        isPollingRef.current = true;

        try {
            const result = await pollFn(jobId);

            if (!isMountedRef.current) return;

            if (onUpdate) {
                onUpdate(result);
            }

            const status = result?.data?.status || result?.status;
            if (status && terminalStatuses.includes(status)) {
                clearPolling();
                if (onTerminal) {
                    onTerminal({ jobId, timeout: false, status, data: result?.data || result });
                }
            }
        } catch {
            // Silently ignore poll errors; next interval will retry
        } finally {
            isPollingRef.current = false;
        }
    }, [jobId, pollFn, terminalStatuses, onUpdate, onTerminal, maxDurationMs, clearPolling]);

    // Start/stop polling when enabled or jobId changes
    useEffect(() => {
        if (!enabled || !jobId) {
            clearPolling();
            return;
        }

        startTimeRef.current = Date.now();

        // Initial poll
        poll();

        intervalRef.current = setInterval(poll, intervalMs);

        return () => {
            clearPolling();
        };
    }, [enabled, jobId, intervalMs, poll, clearPolling]);

    // Force poll on tab visibility change
    useEffect(() => {
        if (!enabled || !jobId) return;

        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                poll();
            }
        };

        document.addEventListener('visibilitychange', handleVisibility);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [enabled, jobId, poll]);

    // isMounted guard
    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    return { clearPolling };
}

// Terminal statuses for common job types
export const BULK_ZIP_TERMINAL = ['preview_ready', 'failed', 'expired', 'cancelled', 'confirmed'];
export const EXPORT_JOB_TERMINAL = ['completed', 'failed', 'cancelled'];
