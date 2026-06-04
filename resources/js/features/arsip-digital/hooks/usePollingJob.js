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
 * @param {function} [options.onTerminal] - Called when terminal status reached
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
    onTimeoutWarning,
    maxDurationMs,
}) {
    const intervalRef = useRef(null);
    const isMountedRef = useRef(true);
    const startTimeRef = useRef(null);
    const isPollingRef = useRef(false);
    const timeoutWarningSentRef = useRef(false);
    const pollFnRef = useRef(pollFn);
    const terminalStatusesRef = useRef(terminalStatuses);
    const onUpdateRef = useRef(onUpdate);
    const onTerminalRef = useRef(onTerminal);
    const onTimeoutWarningRef = useRef(onTimeoutWarning);
    const maxDurationMsRef = useRef(maxDurationMs);

    useEffect(() => {
        pollFnRef.current = pollFn;
        terminalStatusesRef.current = terminalStatuses;
        onUpdateRef.current = onUpdate;
        onTerminalRef.current = onTerminal;
        onTimeoutWarningRef.current = onTimeoutWarning;
        maxDurationMsRef.current = maxDurationMs;
    }, [pollFn, terminalStatuses, onUpdate, onTerminal, onTimeoutWarning, maxDurationMs]);

    const clearPolling = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    }, []);

    const poll = useCallback(async () => {
        if (!isMountedRef.current || !jobId || isPollingRef.current) return;

        const currentMaxDurationMs = maxDurationMsRef.current;
        if (currentMaxDurationMs && startTimeRef.current) {
            const elapsed = Date.now() - startTimeRef.current;
            if (elapsed >= currentMaxDurationMs && !timeoutWarningSentRef.current) {
                timeoutWarningSentRef.current = true;
                if (isMountedRef.current && onTimeoutWarningRef.current) {
                    onTimeoutWarningRef.current({ jobId, timeout: true, status: null, elapsed, maxDurationMs: currentMaxDurationMs });
                }
            }
        }

        isPollingRef.current = true;

        try {
            const result = await pollFnRef.current(jobId);

            if (!isMountedRef.current) return;

            if (onUpdateRef.current) {
                onUpdateRef.current(result);
            }

            const status = result?.data?.status || result?.status;
            if (status && terminalStatusesRef.current.includes(status)) {
                clearPolling();
                if (onTerminalRef.current) {
                    onTerminalRef.current({ jobId, timeout: false, status, data: result?.data || result });
                }
            }
        } catch {
            // Silently ignore poll errors; next interval will retry
        } finally {
            isPollingRef.current = false;
        }
    }, [jobId, clearPolling]);

    // Start/stop polling when enabled or jobId changes
    useEffect(() => {
        if (!enabled || !jobId) {
            clearPolling();
            startTimeRef.current = null;
            timeoutWarningSentRef.current = false;
            return;
        }

        startTimeRef.current = Date.now();
        timeoutWarningSentRef.current = false;

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
