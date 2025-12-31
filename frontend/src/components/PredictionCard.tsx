'use client';

import { getOffenseConfig, OffenseCode, ALL_OFFENSE_CODES } from '@/lib/offenseConfig';

interface Prediction {
    offenseCode: OffenseCode;
    predicted2025: number;
    trend: 'increasing' | 'decreasing' | 'stable';
    confidence: 'high' | 'medium' | 'low';
    cagr?: number;
}

interface PredictionCardProps {
    countyName: string;
    predictions: Prediction[];
    isLoading?: boolean;
}

export default function PredictionCard({
    countyName,
    predictions,
    isLoading,
}: PredictionCardProps) {
    if (isLoading) {
        return (
            <div className="card">
                <div className="h-8 bg-[var(--border-color)] rounded w-1/2 mb-4" />
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-12 bg-[var(--border-color)] rounded mb-2" />
                ))}
            </div>
        );
    }

    const getConfidenceColor = (confidence: string) => {
        switch (confidence) {
            case 'high': return 'text-green-400 bg-green-500/20';
            case 'medium': return 'text-yellow-400 bg-yellow-500/20';
            case 'low': return 'text-red-400 bg-red-500/20';
            default: return 'text-gray-400 bg-gray-500/20';
        }
    };

    const getTrendIcon = (trend: string) => {
        switch (trend) {
            case 'increasing': return '📈';
            case 'decreasing': return '📉';
            default: return '➡️';
        }
    };

    return (
        <div className="card">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-[var(--border-color)]">
                <span className="text-2xl">🔮</span>
                <div>
                    <h3 className="text-lg font-bold text-[var(--accent-primary)]">
                        2025 Predictions
                    </h3>
                    <p className="text-sm text-[var(--text-muted)]">
                        {countyName}
                    </p>
                </div>
            </div>

            {/* Predictions Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {predictions.map((prediction) => {
                    const offense = getOffenseConfig(prediction.offenseCode);
                    if (!offense) return null;

                    return (
                        <div
                            key={prediction.offenseCode}
                            className="p-4 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)]
                         hover:border-[var(--accent-primary)] transition-all"
                        >
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-xl">{offense.icon}</span>
                                    <span className="font-medium">{offense.shortLabel}</span>
                                </div>
                                <span className="text-lg">{getTrendIcon(prediction.trend)}</span>
                            </div>

                            <div className="flex items-end justify-between">
                                <div>
                                    <p
                                        className="text-2xl font-bold"
                                        style={{ color: offense.color }}
                                    >
                                        {prediction.predicted2025.toLocaleString()}
                                    </p>
                                    {prediction.cagr && (
                                        <p className="text-xs text-[var(--text-muted)]">
                                            CAGR: {prediction.cagr > 0 ? '+' : ''}{prediction.cagr.toFixed(1)}%
                                        </p>
                                    )}
                                </div>

                                <span className={`text-xs px-2 py-1 rounded-full ${getConfidenceColor(prediction.confidence)
                                    }`}>
                                    {prediction.confidence.toUpperCase()}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Disclaimer */}
            <div className="mt-4 p-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)]">
                <p className="text-xs text-[var(--text-muted)] flex items-center gap-2">
                    <span>ℹ️</span>
                    <span>
                        Predictions based on 5-year trend analysis. Confidence reflects data volatility.
                    </span>
                </p>
            </div>
        </div>
    );
}
