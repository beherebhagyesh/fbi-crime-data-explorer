'use client';

import { Toaster, toast } from 'react-hot-toast';

// Toast configuration for dark/light theme support
export function ToastProvider() {
    return (
        <Toaster
            position="bottom-right"
            reverseOrder={false}
            gutter={8}
            toastOptions={{
                duration: 4000,
                style: {
                    background: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    fontSize: '14px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                },
                success: {
                    iconTheme: {
                        primary: '#22c55e',
                        secondary: 'white',
                    },
                },
                error: {
                    iconTheme: {
                        primary: '#ef4444',
                        secondary: 'white',
                    },
                },
            }}
        />
    );
}

// Custom toast helpers for our pipeline
export const pipelineToast = {
    fetching: (message: string) => {
        return toast.loading(message, {
            icon: '🔍',
        });
    },

    cacheCheck: (toastId: string) => {
        toast.loading('Checking Redis cache...', {
            id: toastId,
            icon: '⚡',
        });
    },

    cacheHit: (toastId: string) => {
        toast.success('Data found in cache!', {
            id: toastId,
            icon: '⚡',
            duration: 2000,
        });
    },

    cacheMiss: (toastId: string) => {
        toast.loading('Not in cache, calling FBI API...', {
            id: toastId,
            icon: '📡',
        });
    },

    apiFetch: (toastId: string) => {
        toast.loading('Fetching from FBI API...', {
            id: toastId,
            icon: '📡',
        });
    },

    apiSuccess: (toastId: string, count: number) => {
        toast.success(`Retrieved ${count} records from FBI API`, {
            id: toastId,
            icon: '📡',
            duration: 2000,
        });
    },

    saving: (toastId: string) => {
        toast.loading('Saving to PostgreSQL...', {
            id: toastId,
            icon: '💾',
        });
    },

    saved: (toastId: string, table: string) => {
        toast.success(`Saved to ${table}`, {
            id: toastId,
            icon: '💾',
            duration: 2000,
        });
    },

    indexing: (toastId: string) => {
        toast.loading('Indexing in Elasticsearch...', {
            id: toastId,
            icon: '🔎',
        });
    },

    indexed: (toastId: string) => {
        toast.success('Indexed in Elasticsearch', {
            id: toastId,
            icon: '🔎',
            duration: 2000,
        });
    },

    queued: (jobId: string) => {
        toast.success(`Job queued: ${jobId}`, {
            icon: '📋',
            duration: 3000,
        });
    },

    complete: (toastId: string, message: string) => {
        toast.success(message, {
            id: toastId,
            icon: '✅',
            duration: 4000,
        });
    },

    error: (toastId: string, message: string) => {
        toast.error(message, {
            id: toastId,
            icon: '❌',
            duration: 5000,
        });
    },

    info: (message: string) => {
        toast(message, {
            icon: 'ℹ️',
            duration: 3000,
        });
    },

    warning: (message: string) => {
        toast(message, {
            icon: '⚠️',
            style: {
                borderColor: '#f59e0b',
            },
            duration: 4000,
        });
    },
};

// Re-export toast for direct usage
export { toast };
