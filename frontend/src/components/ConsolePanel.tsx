'use client';

import { useEffect, useRef, useState } from 'react';
import { logConsole, LogEntry } from '@/lib/logger';

export default function ConsolePanel() {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const bottomRef = useRef<HTMLDivElement>(null);
    const [isExpanded, setIsExpanded] = useState(true);

    useEffect(() => {
        // Load history
        setLogs(logConsole.getHistory());

        // Subscribe to new logs
        const unsubscribe = logConsole.subscribe((log) => {
            setLogs(prev => [...prev, log]);
        });

        return unsubscribe;
    }, []);

    // Auto-scroll
    useEffect(() => {
        if (bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs]);

    const getIcon = (type: string) => {
        switch (type) {
            case 'api': return '🌐';
            case 'success': return '✅';
            case 'error': return '❌';
            case 'warning': return '⚠️';
            default: return 'ℹ️';
        }
    };

    const getColor = (type: string) => {
        switch (type) {
            case 'api': return 'text-blue-400';
            case 'success': return 'text-green-400';
            case 'error': return 'text-red-400';
            case 'warning': return 'text-yellow-400';
            default: return 'text-[var(--text-muted)]';
        }
    };

    if (!isExpanded) {
        return (
            <button
                onClick={() => setIsExpanded(true)}
                className="w-full p-2 text-xs text-[var(--text-muted)] border-t border-[var(--border-color)] hover:bg-[var(--bg-secondary)]"
            >
                Show System Console
            </button>
        );
    }

    return (
        <div className="flex flex-col h-64 border-t border-[var(--border-color)] bg-black/20">
            <div className="flex items-center justify-between p-2 bg-[var(--bg-secondary)] border-b border-[var(--border-color)]">
                <span className="text-xs font-bold text-[var(--accent-primary)] flex items-center gap-2">
                    <span>🖥️</span> System Console
                </span>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => {
                            const logText = logs.map(log =>
                                `${log.timestamp.toLocaleTimeString()} ${log.type.toUpperCase()}: ${log.message}${log.details ? '\n' + JSON.stringify(log.details, null, 2) : ''}`
                            ).join('\n');
                            navigator.clipboard.writeText(logText);
                            alert('Log copied to clipboard!');
                        }}
                        className="text-[10px] px-2 py-0.5 rounded bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary)]/80"
                    >
                        📋 Copy
                    </button>
                    <button
                        onClick={() => setLogs([])}
                        className="text-[10px] px-2 py-0.5 rounded bg-[var(--border-color)] hover:bg-[var(--danger-bg)]"
                    >
                        Clear
                    </button>
                    <button
                        onClick={() => setIsExpanded(false)}
                        className="text-[10px] hover:text-white"
                    >
                        ▼
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1 font-mono text-[10px] leading-tight">
                {logs.length === 0 && (
                    <div className="text-[var(--text-muted)] text-center py-4 italic">
                        Waiting for activity...
                    </div>
                )}
                {logs.map((log) => (
                    <div key={log.id} className="animate-fade-in break-words">
                        <span className="text-[var(--text-muted)] opacity-50 mr-2">
                            {log.timestamp.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                        <span className={`mr-2 ${getColor(log.type)}`}>
                            {getIcon(log.type)}
                        </span>
                        <span>{log.message}</span>
                        {log.details && (
                            <pre className="mt-1 ml-14 p-1 bg-[var(--bg-primary)] rounded text-[9px] opacity-70 overflow-x-auto">
                                {JSON.stringify(log.details, null, 2)}
                            </pre>
                        )}
                    </div>
                ))}
                <div ref={bottomRef} />
            </div>
        </div>
    );
}
