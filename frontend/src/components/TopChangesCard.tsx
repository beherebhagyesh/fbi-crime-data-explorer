'use client';

import { getOffenseConfig, OffenseCode } from '@/lib/offenseConfig';

interface CountyChange {
    countyId: string;
    countyName: string;
    stateAbbr: string;
    change: number; // percentage
    currentCount: number;
    previousCount: number;
}

interface TopChangesCardProps {
    title: string;
    type: 'risers' | 'fallers';
    offenseCode: OffenseCode;
    counties: CountyChange[];
    onSelectCounty: (countyId: string) => void;
    isLoading?: boolean;
}

export default function TopChangesCard({
    title,
    type,
    offenseCode,
    counties,
    onSelectCounty,
    isLoading,
}: TopChangesCardProps) {
    const offense = getOffenseConfig(offenseCode);
    const isRisers = type === 'risers';

    if (isLoading) {
        return (
            <div className="card">
                <div className="h-8 bg-[var(--border-color)] rounded w-2/3 mb-4" />
                {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-10 bg-[var(--border-color)] rounded mb-2" />
                ))}
            </div>
        );
    }

    return (
        <div className={`card ${isRisers ? 'border-red-500/50' : 'border-green-500/50'}`}>
            {/* Header */}
            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-[var(--border-color)]">
                <span className="text-2xl">{isRisers ? '🔺' : '🔻'}</span>
                <div>
                    <h3 className={`text-lg font-bold ${isRisers ? 'text-red-500' : 'text-green-500'
                        }`}>
                        {title}
                    </h3>
                    <p className="text-sm text-[var(--text-muted)]">
                        {offense?.icon} {offense?.label}
                    </p>
                </div>
            </div>

            {/* List */}
            <div className="space-y-2">
                {counties.length === 0 ? (
                    <p className="text-center text-[var(--text-muted)] py-4">
                        No data available
                    </p>
                ) : (
                    counties.map((county, index) => (
                        <button
                            key={county.countyId}
                            onClick={() => onSelectCounty(county.countyId)}
                            className="w-full flex items-center gap-3 p-3 rounded-lg transition-all
                         hover:bg-[var(--danger-bg)] text-left"
                        >
                            {/* Rank */}
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${isRisers ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'
                                }`}>
                                {index + 1}
                            </span>

                            {/* County Info */}
                            <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">
                                    {county.countyName}
                                </p>
                                <p className="text-sm text-[var(--text-muted)]">
                                    {county.stateAbbr}
                                </p>
                            </div>

                            {/* Stats */}
                            <div className="text-right">
                                <p className={`font-bold ${isRisers ? 'text-red-500' : 'text-green-500'
                                    }`}>
                                    {isRisers ? '+' : ''}{county.change.toFixed(1)}%
                                </p>
                                <p className="text-xs text-[var(--text-muted)]">
                                    {county.previousCount.toLocaleString()} → {county.currentCount.toLocaleString()}
                                </p>
                            </div>
                        </button>
                    ))
                )}
            </div>

            {/* Warning for risers */}
            {isRisers && counties.length > 0 && (
                <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                    <p className="text-sm text-red-400 flex items-center gap-2">
                        <span>⚠️</span>
                        <span>These counties show significant crime increases</span>
                    </p>
                </div>
            )}
        </div>
    );
}
