'use client';

import { getOffenseConfig, OffenseCode } from '@/lib/offenseConfig';

interface Anomaly {
    countyId: string;
    countyName: string;
    stateAbbr: string;
    offenseCode: OffenseCode;
    change: number; // percentage
    reason: string;
}

interface AnomalyAlertsProps {
    anomalies: Anomaly[];
    onDismiss?: (countyId: string, offenseCode: string) => void;
    onSelectCounty: (countyId: string) => void;
    isLoading?: boolean;
}

export default function AnomalyAlerts({
    anomalies,
    onDismiss,
    onSelectCounty,
    isLoading,
}: AnomalyAlertsProps) {
    if (isLoading) {
        return (
            <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-16 bg-[var(--border-color)] rounded animate-pulse" />
                ))}
            </div>
        );
    }

    if (anomalies.length === 0) {
        return null;
    }

    return (
        <div className="space-y-3">
            <h3 className="text-lg font-bold text-[var(--accent-primary)] flex items-center gap-2">
                <span>⚠️</span>
                <span>Anomaly Alerts</span>
                <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-red-500/20 text-red-400">
                    {anomalies.length}
                </span>
            </h3>

            <div className="space-y-2">
                {anomalies.map((anomaly, index) => {
                    const offense = getOffenseConfig(anomaly.offenseCode);
                    if (!offense) return null;

                    const isIncreasing = anomaly.change > 0;

                    return (
                        <div
                            key={`${anomaly.countyId}-${anomaly.offenseCode}-${index}`}
                            className="flex items-center gap-4 p-4 rounded-lg animate-pulse-danger
                         bg-red-500/10 border border-red-500/30 hover:bg-red-500/20
                         transition-all cursor-pointer"
                            onClick={() => onSelectCounty(anomaly.countyId)}
                        >
                            {/* Icon */}
                            <div className="flex-shrink-0">
                                <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                                    <span className="text-2xl">{offense.icon}</span>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="font-bold text-red-400">
                                        {anomaly.countyName}, {anomaly.stateAbbr}
                                    </span>
                                    <span
                                        className="text-sm px-2 py-0.5 rounded-full"
                                        style={{
                                            backgroundColor: `${offense.color}20`,
                                            color: offense.color
                                        }}
                                    >
                                        {offense.shortLabel}
                                    </span>
                                </div>

                                <p className="text-sm text-[var(--text-secondary)]">
                                    {anomaly.reason || `${isIncreasing ? 'Spike' : 'Drop'} of ${Math.abs(anomaly.change).toFixed(0)}% detected`}
                                </p>
                            </div>

                            {/* Change */}
                            <div className="flex-shrink-0 text-right">
                                <p className={`text-xl font-bold ${isIncreasing ? 'text-red-500' : 'text-green-500'
                                    }`}>
                                    {isIncreasing ? '▲' : '▼'} {Math.abs(anomaly.change).toFixed(0)}%
                                </p>
                                <p className="text-xs text-[var(--text-muted)]">YoY Change</p>
                            </div>

                            {/* Dismiss */}
                            {onDismiss && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDismiss(anomaly.countyId, anomaly.offenseCode);
                                    }}
                                    className="flex-shrink-0 w-8 h-8 rounded-full hover:bg-red-500/30
                           flex items-center justify-center text-[var(--text-muted)]
                           hover:text-white transition-all"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Summary */}
            <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                <p className="text-sm text-red-400 flex items-center gap-2">
                    <span>🔍</span>
                    <span>
                        {anomalies.length} anomal{anomalies.length === 1 ? 'y' : 'ies'} detected.
                        Click to investigate.
                    </span>
                </p>
            </div>
        </div>
    );
}
