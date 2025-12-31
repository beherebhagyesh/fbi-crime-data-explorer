'use client';

import { getOffenseConfig, OffenseCode } from '@/lib/offenseConfig';

interface StateData {
    stateAbbr: string;
    stateName?: string;
    totalCount: number;
    countiesReporting: number;
    yoyChange?: number;
}

interface StateRankingTableProps {
    offenseCode: OffenseCode;
    year: number;
    states: StateData[];
    onSelectState: (stateAbbr: string) => void;
    selectedState?: string;
    isLoading?: boolean;
}

export default function StateRankingTable({
    offenseCode,
    year,
    states,
    onSelectState,
    selectedState,
    isLoading,
}: StateRankingTableProps) {
    const offense = getOffenseConfig(offenseCode);
    const nationalTotal = states.reduce((sum, s) => sum + s.totalCount, 0);

    if (isLoading) {
        return (
            <div className="card">
                <div className="h-8 bg-[var(--border-color)] rounded w-1/3 mb-4" />
                {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-12 bg-[var(--border-color)] rounded mb-2" />
                ))}
            </div>
        );
    }

    return (
        <div className="card overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-[var(--border-color)]">
                <div className="flex items-center gap-3">
                    <span className="text-2xl">{offense?.icon}</span>
                    <div>
                        <h3 className="text-lg font-bold" style={{ color: offense?.color }}>
                            {offense?.label} by State
                        </h3>
                        <p className="text-sm text-[var(--text-muted)]">
                            {year} • National Total: {nationalTotal.toLocaleString()}
                        </p>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th className="w-12">#</th>
                            <th>State</th>
                            <th className="text-right">Incidents</th>
                            <th className="text-right">% of Total</th>
                            <th className="text-right">Counties</th>
                            <th className="text-right">YoY</th>
                        </tr>
                    </thead>
                    <tbody>
                        {states.map((state, index) => {
                            const pctOfTotal = (state.totalCount / nationalTotal) * 100;
                            const isSelected = selectedState === state.stateAbbr;

                            return (
                                <tr
                                    key={state.stateAbbr}
                                    onClick={() => onSelectState(state.stateAbbr)}
                                    className={`cursor-pointer transition-all ${isSelected ? 'bg-[var(--danger-bg)]' : ''
                                        }`}
                                >
                                    <td className="font-bold text-[var(--text-muted)]">
                                        {index + 1}
                                    </td>
                                    <td>
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg">📍</span>
                                            <span className="font-medium">{state.stateAbbr}</span>
                                            {state.stateName && (
                                                <span className="text-sm text-[var(--text-muted)]">
                                                    {state.stateName}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="text-right">
                                        <span
                                            className="font-bold text-lg"
                                            style={{ color: offense?.color }}
                                        >
                                            {state.totalCount.toLocaleString()}
                                        </span>
                                    </td>
                                    <td className="text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <div className="w-20 h-2 bg-[var(--border-color)] rounded-full overflow-hidden">
                                                <div
                                                    className="h-full rounded-full"
                                                    style={{
                                                        width: `${Math.min(pctOfTotal * 2, 100)}%`,
                                                        backgroundColor: offense?.color
                                                    }}
                                                />
                                            </div>
                                            <span className="text-sm text-[var(--text-secondary)] w-12 text-right">
                                                {pctOfTotal.toFixed(1)}%
                                            </span>
                                        </div>
                                    </td>
                                    <td className="text-right text-[var(--text-secondary)]">
                                        {state.countiesReporting}
                                    </td>
                                    <td className="text-right">
                                        {state.yoyChange !== undefined && (
                                            <span className={`trend-badge ${state.yoyChange > 0 ? 'trend-badge-up' : 'trend-badge-down'
                                                }`}>
                                                {state.yoyChange > 0 ? '▲' : '▼'}
                                                {Math.abs(state.yoyChange).toFixed(1)}%
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
