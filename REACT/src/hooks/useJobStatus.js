// src/hooks/useJobStatus.js
import { useState, useEffect, useCallback } from 'react';
import { getJobStatus } from '../services';

const RUNNING_STATUSES = ['queued', 'running'];
const COMPLETED_STATUSES = ['done', 'failed'];

/**
 * Hook for polling job status with automatic updates
 * @param {string} jobId - Job ID to monitor
 * @param {Object} options - Configuration options
 * @returns {Object} Job status and control functions
 */
export const useJobStatus = (jobId, options = {}) => {
    const {
        pollInterval = 2000, // Poll every 2 seconds
        maxRetries = 30, // Stop polling after 30 retries (1 minute)
        onComplete,
        onError,
        onStatusChange
    } = options;

    const [jobStatus, setJobStatus] = useState(null);
    const [isPolling, setIsPolling] = useState(false);
    const [error, setError] = useState(null);
    const [retryCount, setRetryCount] = useState(0);

    const pollStatus = useCallback(async () => {
        if (!jobId) return;

        try {
            const status = await getJobStatus(jobId);
            setJobStatus(status);
            setError(null);

            // Call status change callback
            if (onStatusChange) {
                onStatusChange(status);
            }

            // Check if job is complete
            if (COMPLETED_STATUSES.includes(status.status)) {
                setIsPolling(false);

                if (status.status === 'done' && onComplete) {
                    onComplete(status);
                } else if (status.status === 'failed' && onError) {
                    onError(status.error || 'Job failed');
                }
            }
        } catch (err) {
            setError(err.message);
            setIsPolling(false);

            if (onError) {
                onError(err.message);
            }
        }
    }, [jobId, onComplete, onError, onStatusChange]);

    const startPolling = useCallback(() => {
        if (!jobId || isPolling) return;

        setIsPolling(true);
        setRetryCount(0);
        setError(null);

        // Initial poll
        pollStatus();
    }, [jobId, isPolling, pollStatus]);

    const stopPolling = useCallback(() => {
        setIsPolling(false);
    }, []);

    // Effect for polling
    useEffect(() => {
        if (!isPolling || !jobId) return;

        const interval = setInterval(() => {
            setRetryCount(prev => {
                const newCount = prev + 1;

                if (newCount >= maxRetries) {
                    setIsPolling(false);
                    setError('Polling timeout');
                    if (onError) {
                        onError('Polling timeout');
                    }
                    return newCount;
                }

                pollStatus();
                return newCount;
            });
        }, pollInterval);

        return () => clearInterval(interval);
    }, [isPolling, jobId, pollStatus, pollInterval, maxRetries, onError]);

    // Effect to start polling when jobId changes
    useEffect(() => {
        if (jobId) {
            startPolling();
        } else {
            stopPolling();
            setJobStatus(null);
            setError(null);
        }
    }, [jobId, startPolling, stopPolling]);

    return {
        jobStatus,
        isPolling,
        error,
        retryCount,
        startPolling,
        stopPolling,
        isRunning: jobStatus && RUNNING_STATUSES.includes(jobStatus.status),
        isComplete: jobStatus && COMPLETED_STATUSES.includes(jobStatus.status),
        isSuccess: jobStatus && jobStatus.status === 'done',
        isFailed: jobStatus && jobStatus.status === 'failed'
    };
};
