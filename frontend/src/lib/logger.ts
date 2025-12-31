export type LogType = 'info' | 'success' | 'error' | 'warning' | 'api';

export interface LogEntry {
    id: string;
    timestamp: Date;
    type: LogType;
    message: string;
    details?: any;
}

type Listener = (log: LogEntry) => void;

class Logger {
    private listeners: Listener[] = [];

    // Keep last 100 logs in memory for new subscribers
    private history: LogEntry[] = [];

    subscribe(listener: Listener): () => void {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    getHistory(): LogEntry[] {
        return this.history;
    }

    log(type: LogType, message: string, details?: any) {
        const entry: LogEntry = {
            id: Math.random().toString(36).substring(7),
            timestamp: new Date(),
            type,
            message,
            details
        };

        this.history.push(entry);
        if (this.history.length > 100) {
            this.history.shift();
        }

        this.listeners.forEach(listener => listener(entry));
    }

    info(message: string, details?: any) { this.log('info', message, details); }
    success(message: string, details?: any) { this.log('success', message, details); }
    error(message: string, details?: any) { this.log('error', message, details); }
    warning(message: string, details?: any) { this.log('warning', message, details); }
    api(message: string, details?: any) { this.log('api', message, details); }
}

export const logConsole = new Logger();
