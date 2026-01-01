'use client';

import { getOffenseConfig, OffenseCode } from '@/lib/offenseConfig';
import { CalculatedValue, AggregationMode } from './DataModeSelector';

interface CrimeStatsCardProps {
    offenseCode: OffenseCode;
    count: number;
    year: number;
    previousCount?: number;
    stateTotal?: number;
    nationalRank?: number;
    stateRank?: number;
    agenciesReporting?: number;
    agenciesTotal?: number;
    prediction2025?: number;
    predictionConfidence?: 'high' | 'medium' | 'low';
    isLoading?: boolean;
    onDetailClick?: () => void;
    // New props for calculated display
    calculatedValue?: CalculatedValue;
    displayMode?: AggregationMode;
    displayLabel?: string;  // e.g., "2020-2024 Sum"
    per100k?: number;
    population?: number;
}

export default function CrimeStatsCard({
    offenseCode,
    count,
    year,
    previousCount,
    stateTotal,
    nationalRank,
    stateRank,
    agenciesReporting,
    agenciesTotal,
    prediction2025,
    predictionConfidence,
    isLoading,
    onDetailClick,
    calculatedValue,
    displayMode,
    displayLabel,
    per100k,
    population,
}: CrimeStatsCardProps) {

    const offense = getOffenseConfig(offenseCode);

    if (!offense) return null;

    // Calculate YoY change
    const yoyChange = previousCount ? ((count - previousCount) / previousCount) * 100 : null;
    const isIncreasing = yoyChange !== null && yoyChange > 0;

    // Calculate state percentage
    const statePercentage = stateTotal ? ((count / stateTotal) * 100) : null;

    // Reporting percentage
    const reportingPct = agenciesReporting && agenciesTotal
        ? Math.round((agenciesReporting / agenciesTotal) * 100)
        : null;

    if (isLoading) {
        return (
            <div className="card animate-pulse">
                <div className="h-8 bg-[var(--border-color)] rounded w-1/2 mb-4" />
                <div className="h-16 bg-[var(--border-color)] rounded mb-4" />
                <div className="h-4 bg-[var(--border-color)] rounded w-3/4" />
            </div>
        );
    }

    return (
        <div
            className={`card card-danger animate-fade-in transition-all duration-300 ${onDetailClick ? 'cursor-pointer hover:scale-[1.02] hover:shadow-xl' : ''}`}
            style={{ borderColor: offense.color }}
            onClick={onDetailClick}
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <span className="text-3xl">{offense.icon}</span>
                    <div>
                        <h3
                            className="text-lg font-bold"
                            style={{ color: offense.color }}
                        >
                            {offense.label}
                        </h3>
                        <p className="text-sm text-[var(--text-muted)]">{year} Data</p>
                    </div>
                </div>

                {/* YoY Change Badge */}
                {yoyChange !== null && (
                    <div className={`trend-badge ${isIncreasing ? 'trend-badge-up' : 'trend-badge-down'}`}>
                        <span>{isIncreasing ? '▲' : '▼'}</span>
                        <span>{Math.abs(yoyChange).toFixed(1)}%</span>
                    </div>
                )}
            </div>

            {/* Main Stat */}
            <div className="mb-6 flex-1 flex flex-col justify-center overflow-hidden">
                {/* Display mode badge */}
                {displayLabel && (
                    <span className="text-[10px] uppercase tracking-wide text-[var(--text-muted)] mb-1">
                        {displayLabel}
                    </span>
                )}

                <div
                    className="stat-number-lg animate-glow-text"
                    style={{ color: offense.color }}
                >
                    {calculatedValue ? (
                        calculatedValue.isNA ? (
                            <span className="text-[var(--text-muted)]">N/A</span>
                        ) : (
                            <>
                                {/* Year label for min/max modes */}
                                {calculatedValue.label && (
                                    <span className="text-[0.5em] text-[var(--text-secondary)] mr-1">
                                        {calculatedValue.label}:
                                    </span>
                                )}
                                {/* Prefix for growth (+ or -) */}
                                {calculatedValue.prefix}
                                {calculatedValue.value.toLocaleString(undefined, {
                                    maximumFractionDigits: calculatedValue.suffix === '%' ? 1 : 0
                                })}
                                {/* Suffix for growth (%) */}
                                {calculatedValue.suffix}
                            </>
                        )
                    ) : (
                        count.toLocaleString()
                    )}
                </div>

                <p className="stat-label">
                    {displayMode === 'growth' ? 'Year-over-Year Change' :
                        displayMode === 'sum' ? 'Total Incidents' :
                            displayMode === 'avg' ? 'Annual Average' :
                                displayMode === 'max' ? 'Peak Year' :
                                    displayMode === 'min' ? 'Lowest Year' :
                                        'Incidents Reported'}
                </p>
            </div>

            {/* Context Stats */}
            <div className="space-y-3 mb-6 p-4 rounded-lg bg-[var(--bg-secondary)] relative group">
                <h4 className="text-sm font-semibold text-[var(--text-muted)] flex items-center gap-2">
                    📊 Context
                    {onDetailClick && (
                        <span className="text-[10px] uppercase ml-auto text-[var(--accent-primary)] opacity-0 group-hover:opacity-100 transition-opacity">
                            View Details →
                        </span>
                    )}
                </h4>

                {statePercentage !== null && (
                    <p className="text-sm">
                        <span className="text-[var(--accent-primary)] font-bold">
                            {statePercentage.toFixed(1)}%
                        </span>
                        <span className="text-[var(--text-secondary)]"> of state total</span>
                    </p>
                )}

                {per100k !== undefined && per100k !== null && (
                    <p className="text-sm">
                        <span className="text-orange-500 font-bold">
                            {per100k.toFixed(1)}
                        </span>
                        <span className="text-[var(--text-secondary)]"> per 100k pop.</span>
                    </p>
                )}

                {stateRank && (
                    <p className="text-sm">
                        <span className="text-[var(--text-secondary)]">Rank: </span>
                        <span className="text-[var(--accent-primary)] font-bold">
                            #{stateRank}
                        </span>
                        <span className="text-[var(--text-secondary)]"> in state</span>
                        {nationalRank && (
                            <>
                                <span className="text-[var(--text-muted)]">, </span>
                                <span className="text-[var(--accent-secondary)] font-bold">
                                    #{nationalRank}
                                </span>
                                <span className="text-[var(--text-secondary)]"> nationally</span>
                            </>
                        )}
                    </p>
                )}

                {prediction2025 && (
                    <p className="text-sm flex items-center gap-2">
                        <span>🔮</span>
                        <span className="text-[var(--text-secondary)]">2025 Prediction:</span>
                        <span className="text-[var(--accent-primary)] font-bold">
                            {prediction2025.toLocaleString()}
                        </span>
                        {predictionConfidence && (
                            <span className={`text-xs px-2 py-0.5 rounded-full ${predictionConfidence === 'high' ? 'bg-green-500/20 text-green-400' :
                                predictionConfidence === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                                    'bg-red-500/20 text-red-400'
                                }`}>
                                {predictionConfidence.toUpperCase()}
                            </span>
                        )}
                    </p>
                )}
            </div>

            {/* Reporting Coverage */}
            {reportingPct !== null && (
                <div>
                    <div className="flex justify-between text-sm mb-1">
                        <span className="text-[var(--text-muted)]">Reporting Coverage</span>
                        <span className="text-[var(--text-secondary)]">
                            {agenciesReporting?.toLocaleString()}/{agenciesTotal?.toLocaleString()} agencies ({reportingPct}%)
                        </span>
                    </div>
                    <div className="progress-bar">
                        <div
                            className="progress-fill"
                            style={{
                                width: `${reportingPct}%`,
                                backgroundColor: reportingPct >= 80 ? '#10B981' :
                                    reportingPct >= 50 ? '#F59E0B' : '#DC2626'
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
