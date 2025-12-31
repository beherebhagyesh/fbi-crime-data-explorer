'use client';

import { useEffect, useState } from 'react';

interface HealthStatus {
    status: 'healthy' | 'degraded' | 'error';
    components: {
        database: 'ok' | 'error';
        redis: 'ok' | 'error';
        elasticsearch: 'ok' | 'error';
    };
}

export default function SystemStatus() {
    const [health, setHealth] = useState<HealthStatus | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        const checkHealth = async () => {
            try {
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:49080';
                const response = await fetch(`${apiUrl}/api/system/health`);
                const data = await response.json();
                setHealth(data);
            } catch (error) {
                setHealth({
                    status: 'error',
                    components: {
                        database: 'error',
                        redis: 'error',
                        elasticsearch: 'error',
                    },
                });
            } finally {
                setIsLoading(false);
            }
        };

        checkHealth();
        const interval = setInterval(checkHealth, 30000);
        return () => clearInterval(interval);
    }, []);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'healthy':
            case 'ok':
                return 'bg-green-500';
            case 'degraded':
                return 'bg-yellow-500';
            default:
                return 'bg-red-500';
        }
    };

    return (
        <div className="relative">
            {/* Status Badge - Click to toggle */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--border-color)] 
                   bg-[var(--bg-card)] hover:border-[var(--accent-primary)] transition-all"
            >
                <div className={`w-2 h-2 rounded-full ${isLoading ? 'bg-gray-400 animate-pulse' : getStatusColor(health?.status || 'error')
                    } ${health?.status !== 'healthy' ? 'animate-pulse' : ''}`} />
                <span className="text-xs text-[var(--text-secondary)]">
                    {isLoading ? '...' : health?.status === 'healthy' ? 'OK' : '⚠️'}
                </span>
            </button>

            {/* Dropdown - Only show when clicked */}
            {isOpen && (
                <>
                    {/* Backdrop to close */}
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Dropdown panel */}
                    <div className="absolute right-0 top-full mt-2 w-64 p-4 rounded-lg bg-[var(--bg-card)] 
                          border border-[var(--border-color)] shadow-lg z-50 animate-fade-in">
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-bold text-[var(--text-primary)]">System Health</h4>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="space-y-2">
                            {health?.components && Object.entries(health.components).map(([name, status]) => (
                                <div key={name} className="flex items-center justify-between">
                                    <span className="text-sm text-[var(--text-secondary)] capitalize">{name}</span>
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${getStatusColor(status)}`} />
                                        <span className={`text-xs ${status === 'ok' ? 'text-green-400' : 'text-red-400'}`}>
                                            {status === 'ok' ? 'OK' : 'Error'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-3 pt-3 border-t border-[var(--border-color)]">
                            <p className="text-xs text-[var(--text-muted)]">
                                Last checked: {new Date().toLocaleTimeString()}
                            </p>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
