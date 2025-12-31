'use client';

import { ProxyStatus } from '@/lib/api';

interface ProxyToggleProps {
    status?: ProxyStatus;
    onToggle: () => void;
}

export function ProxyToggle({ status, onToggle }: ProxyToggleProps) {
    const isEnabled = status?.enabled ?? false;

    return (
        <div className="stat-card">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Proxy</h3>
            <div className="flex items-center justify-between">
                <span className={isEnabled ? 'text-green-500' : 'text-gray-400'}>
                    {isEnabled ? 'Enabled' : 'Disabled'}
                </span>
                <button
                    onClick={onToggle}
                    className={`
            relative inline-flex h-6 w-11 items-center rounded-full
            transition-colors duration-200 ease-in-out focus:outline-none
            ${isEnabled ? 'bg-green-500' : 'bg-gray-300'}
          `}
                >
                    <span
                        className={`
              inline-block h-4 w-4 transform rounded-full bg-white shadow
              transition-transform duration-200 ease-in-out
              ${isEnabled ? 'translate-x-6' : 'translate-x-1'}
            `}
                    />
                </button>
            </div>
            {status?.in_fallback && (
                <p className="text-xs text-yellow-500 mt-1">In fallback mode</p>
            )}
        </div>
    );
}
