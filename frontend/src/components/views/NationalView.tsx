'use client';

import { useState, useEffect } from 'react';
import { getOffenseConfig, OffenseCode, normalizeOffenseCode } from '@/lib/offenseConfig';
import CrimeStatsCard from '../CrimeStatsCard';
import DetailedContextModal from '../DetailedContextModal';
import { DataModeConfig, calculateDisplayValue, CalculatedValue } from '../DataModeSelector';

interface StateSummary {
    state_abbr: string;
    state_name: string;
    county_count: number;
    agency_count: number;
}

interface NationalViewProps {
    selectedOffense: OffenseCode;
    year: number;
    dataMode: DataModeConfig;
    onSelectState: (stateAbbr: string) => void;
}

export default function NationalView({
    selectedOffense,
    year,
    dataMode,
    onSelectState,
}: NationalViewProps) {

    const [states, setStates] = useState<StateSummary[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [nationalStats, setNationalStats] = useState<any>(null);
    const [allStats, setAllStats] = useState<any[]>([]);
    const [aggregations, setAggregations] = useState<Record<string, any>>({});
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [selectedDetailOffense, setSelectedDetailOffense] = useState<OffenseCode>(selectedOffense);

    // Sync modal offense with sidebar selection
    useEffect(() => {
        if (selectedOffense && selectedOffense !== 'ALL') {
            setSelectedDetailOffense(selectedOffense);
        }
    }, [selectedOffense]);

    const offense = getOffenseConfig(selectedOffense);

    useEffect(() => {
        const fetchStates = async () => {
            setIsLoading(true);
            setError(null);

            try {
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:49080';

                // NEW: Use efficient states summary endpoint (51 items instead of 3670)
                const response = await fetch(`${apiUrl}/api/stats/states`);

                if (!response.ok) {
                    throw new Error(`API error: ${response.status}`);
                }

                const data = await response.json();
                setStates(data);
            } catch (err) {
                console.error('Failed to fetch states:', err);
                setError(err instanceof Error ? err.message : 'Failed to load data');
            } finally {
                setIsLoading(false);
            }
        };


        fetchStates();

        const fetchNationalStats = async () => {
            try {
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:49080';

                // Fetch individual detail for selected offense
                if (selectedOffense !== 'ALL') {
                    const response = await fetch(`${apiUrl}/api/counties/NATIONAL_US/offense/${selectedOffense}/details`);
                    if (response.ok) {
                        const data = await response.json();
                        setNationalStats(data);
                    }
                }

                // Fetch ALL stats for the grid
                const summaryResponse = await fetch(`${apiUrl}/api/counties/NATIONAL_US`);
                if (summaryResponse.ok) {
                    const data = await summaryResponse.json();

                    // Standardize offense codes to lowercase if they aren't already
                    const normalizedStats = (data.crime_stats || []).map((s: any) => ({
                        ...s,
                        offense: normalizeOffenseCode(s.offense)
                    }));
                    setAllStats(normalizedStats);
                }
            } catch (err) {
                console.error('Failed to fetch national stats:', err);
            }
        };

        const fetchAggregations = async () => {
            try {
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:49080';
                const response = await fetch(`${apiUrl}/api/stats/aggregations/national/NATIONAL_US`);
                if (response.ok) {
                    const data = await response.json();
                    // Convert array to map by offense code
                    const aggMap: Record<string, any> = {};
                    data.forEach((agg: any) => {
                        aggMap[agg.offense.toUpperCase()] = agg;
                    });
                    setAggregations(aggMap);
                }
            } catch (err) {
                console.error('Failed to fetch aggregations:', err);
            }
        };

        fetchNationalStats();
        fetchAggregations();
    }, [selectedOffense]);

    const totalAgencies = states.reduce((sum: number, s: StateSummary) => sum + s.agency_count, 0);
    const totalCounties = states.reduce((sum: number, s: StateSummary) => sum + s.county_count, 0);

    return (
        <div className="space-y-6 animate-fade-in h-full overflow-y-auto pr-2 custom-scrollbar">
            {/* Header - Always shown */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                    <span className="text-4xl">🇺🇸</span>
                    <div>
                        <h1 className="text-2xl font-bold text-[var(--text-primary)]">
                            National Overview
                        </h1>
                        <p className="text-[var(--text-muted)]">
                            {states.length} States • {totalCounties.toLocaleString()} Counties • {totalAgencies.toLocaleString()} Agencies
                        </p>
                    </div>
                </div>

                {/* Enrich button for ALL offenses view */}
                {selectedOffense === 'ALL' && (
                    <button
                        onClick={async () => {
                            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:49080';
                            try {
                                const response = await fetch(`${apiUrl}/api/crimes/fetch/NATIONAL_US`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        years: [2020, 2021, 2022, 2023, 2024],
                                        forceRefresh: false
                                    }),
                                });
                                if (response.ok) {
                                    const result = await response.json();
                                    alert(`✅ Enriched: ${result.recordCount} records (${result.enrichment_status})`);
                                    window.location.reload();
                                }
                            } catch (e) {
                                alert('Failed to enrich: ' + e);
                            }
                        }}
                        className="card flex items-center gap-4 py-2 px-4 cursor-pointer hover:bg-[var(--accent-primary)]/10 transition-all"
                    >
                        <span className="text-2xl">🚀</span>
                        <div>
                            <p className="text-xs text-[var(--text-muted)]">Enrich All</p>
                            <p className="font-bold text-[var(--accent-primary)]">16 Offenses</p>
                        </div>
                    </button>
                )}
            </div>

            {/* Single Offense View - Card in first cell of grid */}
            {selectedOffense !== 'ALL' && (
                <div>
                    {/* States by Agency Count header */}
                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <span>📍</span>
                        <span>States by Agency Count</span>
                    </h2>

                    {/* Grid with card in first position */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        {/* Card cell - spans 2 rows on larger screens */}
                        <div className="row-span-2 flex flex-col gap-4">
                            {(() => {
                                // Build yearly data from yearly_trend array
                                const yearlyData: Record<number, number> = {};
                                if (nationalStats?.yearly_trend) {
                                    nationalStats.yearly_trend.forEach((item: { year: number; count: number }) => {
                                        yearlyData[item.year] = item.count;
                                    });
                                }

                                // Get count for selected year
                                const selectedYearCount = yearlyData[dataMode.year] || 0;

                                // Calculate display value based on dataMode
                                const calculatedVal = calculateDisplayValue(yearlyData, dataMode);

                                // Generate display label
                                const getDisplayLabel = () => {
                                    if (dataMode.mode === 'single') return `${dataMode.year} Data`;
                                    if (dataMode.mode === 'growth') return `${dataMode.year - 1} → ${dataMode.year}`;
                                    const startYear = Math.max(2020, dataMode.year - (dataMode.range || 3) + 1);
                                    return `${startYear}-${dataMode.year}`;
                                };

                                return (
                                    <CrimeStatsCard
                                        isLoading={!nationalStats}
                                        offenseCode={selectedOffense}
                                        count={selectedYearCount}
                                        year={dataMode.year}
                                        agenciesReporting={totalAgencies}
                                        agenciesTotal={totalAgencies}
                                        onDetailClick={() => setIsDetailModalOpen(true)}
                                        calculatedValue={dataMode.mode !== 'single' ? calculatedVal : undefined}
                                        displayMode={dataMode.mode}
                                        displayLabel={getDisplayLabel()}
                                    />
                                );
                            })()}

                            <div className="card bg-[var(--accent-primary)]/10 border-[var(--accent-primary)]">
                                <p className="text-xs text-[var(--text-secondary)]">
                                    <strong>📊 Note:</strong> Viewing <strong style={{ color: offense?.color }}>{offense?.label}</strong> data.
                                </p>
                            </div>
                        </div>

                        {/* First batch of states (fills remaining columns in first 2 rows) */}
                        {states.slice(0, 8).map((state, index) => (
                            <button
                                key={state.state_abbr}
                                onClick={() => onSelectState(state.state_abbr)}
                                className="card text-left hover:border-[var(--accent-primary)] hover:shadow-glow transition-all group relative overflow-hidden"
                            >
                                {index < 5 && (
                                    <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[var(--accent-primary)] flex items-center justify-center text-white text-xs font-bold">
                                        {index + 1}
                                    </div>
                                )}
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-xl">📍</span>
                                    <span className="font-bold text-lg text-[var(--text-primary)] group-hover:text-[var(--accent-primary)]">
                                        {state.state_abbr}
                                    </span>
                                </div>
                                <p className="text-sm text-[var(--text-muted)] mb-1 truncate">{state.state_name}</p>
                                <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                                    <span>{state.county_count} counties</span>
                                    <span className="font-bold" style={{ color: offense?.color }}>{state.agency_count} agencies</span>
                                </div>
                                <div className="mt-2 h-1 bg-[var(--border-color)] rounded-full overflow-hidden">
                                    <div
                                        className="h-full rounded-full transition-all"
                                        style={{
                                            width: `${Math.min((state.agency_count / (states[0]?.agency_count || 1)) * 100, 100)}%`,
                                            backgroundColor: offense?.color
                                        }}
                                    />
                                </div>
                            </button>
                        ))}
                    </div>

                    {/* Remaining states in full 5-column grid */}
                    {states.length > 8 && (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 mt-4">
                            {states.slice(8).map((state) => (
                                <button
                                    key={state.state_abbr}
                                    onClick={() => onSelectState(state.state_abbr)}
                                    className="card text-left hover:border-[var(--accent-primary)] hover:shadow-glow transition-all group relative overflow-hidden"
                                >
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-xl">📍</span>
                                        <span className="font-bold text-lg text-[var(--text-primary)] group-hover:text-[var(--accent-primary)]">
                                            {state.state_abbr}
                                        </span>
                                    </div>
                                    <p className="text-sm text-[var(--text-muted)] mb-1 truncate">{state.state_name}</p>
                                    <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                                        <span>{state.county_count} counties</span>
                                        <span className="font-bold" style={{ color: offense?.color }}>{state.agency_count} agencies</span>
                                    </div>
                                    <div className="mt-2 h-1 bg-[var(--border-color)] rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full transition-all"
                                            style={{
                                                width: `${Math.min((state.agency_count / (states[0]?.agency_count || 1)) * 100, 100)}%`,
                                                backgroundColor: offense?.color
                                            }}
                                        />
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Detailed Analytics Modal */}
            {isDetailModalOpen && (
                <DetailedContextModal
                    isOpen={isDetailModalOpen}
                    onClose={() => setIsDetailModalOpen(false)}
                    countyId="NATIONAL_US"
                    countyName="United States (National)"
                    offenseCode={selectedDetailOffense}
                />
            )}

            {/* All Offenses Grid - only when ALL is selected */}
            {selectedOffense === 'ALL' && allStats.length > 0 && (
                <div>
                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <span>📊</span>
                        <span>Crime Statistics by Offense</span>
                        <span className="text-sm font-normal text-[var(--text-muted)]">
                            ({dataMode.mode === 'single' ? `${dataMode.year} Data` :
                                dataMode.mode === 'sum' ? `${dataMode.year - (dataMode.range || 3) + 1}-${dataMode.year} Sum` :
                                    dataMode.mode === 'avg' ? `${dataMode.year - (dataMode.range || 3) + 1}-${dataMode.year} Average` :
                                        dataMode.mode === 'growth' ? `YoY Growth` :
                                            dataMode.mode === 'min' ? `Lowest Year` :
                                                dataMode.mode === 'max' ? `Highest Year` : `${dataMode.year} Data`
                            })
                        </span>
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {(() => {
                            // Group stats by offense, prioritizing selected year
                            const offenseStats = allStats.reduce((acc: any, stat: any) => {
                                const offenseKey = stat.offense.toUpperCase();

                                // Skip entries with no count
                                if (!stat.total_count || stat.total_count === 0) {
                                    return acc;
                                }

                                // If we don't have this offense yet, add it
                                if (!acc[offenseKey]) {
                                    acc[offenseKey] = stat;
                                } else {
                                    // Prefer the selected year, otherwise keep closest year
                                    const currentDiff = Math.abs(acc[offenseKey].year - dataMode.year);
                                    const newDiff = Math.abs(stat.year - dataMode.year);

                                    if (stat.year === dataMode.year || newDiff < currentDiff) {
                                        acc[offenseKey] = stat;
                                    }
                                }
                                return acc;
                            }, {} as Record<string, any>);

                            // Filter out any remaining entries with no valid data
                            const validStats = Object.values(offenseStats).filter(
                                (stat: any) => stat.total_count && stat.total_count > 0
                            );

                            return validStats
                                .filter((stat: any) => {
                                    // Only render if we have a valid offense config
                                    const config = getOffenseConfig(stat.offense.toUpperCase() as OffenseCode);
                                    return config !== null && config !== undefined;
                                })
                                .map((stat: any) => {
                                    const offenseKey = stat.offense.toUpperCase();
                                    const agg = aggregations[offenseKey];

                                    // Build calculated value based on dataMode
                                    let calculatedVal: CalculatedValue | undefined;
                                    let displayLabel = `${stat.year} Data`;
                                    let displayCount = stat.total_count;
                                    let displayYear = stat.year;

                                    if (dataMode.mode !== 'single' && agg) {
                                        const yearCounts = agg.year_counts || {};

                                        if (dataMode.mode === 'sum') {
                                            calculatedVal = { value: agg.sum_total, isNA: false };
                                            displayLabel = `${agg.sum_years_start}-${agg.sum_years_end} Sum`;
                                        } else if (dataMode.mode === 'avg') {
                                            calculatedVal = { value: Math.round(agg.avg_annual), isNA: false };
                                            displayLabel = `${agg.sum_years_start}-${agg.sum_years_end} Avg`;
                                        } else if (dataMode.mode === 'growth') {
                                            if (agg.growth_pct !== null) {
                                                calculatedVal = {
                                                    value: agg.growth_pct,
                                                    isNA: false,
                                                    prefix: agg.growth_pct >= 0 ? '+' : '',
                                                    suffix: '%'
                                                };
                                                displayLabel = `${agg.growth_prev_year || agg.latest_year - 1} → ${agg.latest_year}`;
                                            } else {
                                                calculatedVal = { value: 0, isNA: true };
                                                displayLabel = 'N/A';
                                            }
                                        } else if (dataMode.mode === 'min') {
                                            calculatedVal = {
                                                value: agg.min_count,
                                                isNA: false,
                                                label: `${agg.min_year}`
                                            };
                                            displayLabel = `Lowest: ${agg.min_year}`;
                                        } else if (dataMode.mode === 'max') {
                                            calculatedVal = {
                                                value: agg.max_count,
                                                isNA: false,
                                                label: `${agg.max_year}`
                                            };
                                            displayLabel = `Highest: ${agg.max_year}`;
                                        }
                                    } else if (dataMode.mode === 'single' && agg?.year_counts) {
                                        // For single year, get the count for the selected year from aggregations
                                        const yearCount = agg.year_counts[dataMode.year];
                                        if (yearCount) {
                                            displayCount = yearCount;
                                            displayYear = dataMode.year;
                                        }
                                    }

                                    return (
                                        <div key={stat.offense} className="relative">
                                            {/* Show warning if not exact year match (only for single mode) */}
                                            {dataMode.mode === 'single' && stat.year !== dataMode.year && (
                                                <div className="absolute top-2 right-2 z-10 px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-500 text-xs">
                                                    {stat.year} data
                                                </div>
                                            )}
                                            <CrimeStatsCard
                                                offenseCode={stat.offense.toUpperCase() as OffenseCode}
                                                count={displayCount}
                                                year={displayYear}
                                                agenciesReporting={100}
                                                agenciesTotal={100}
                                                calculatedValue={calculatedVal}
                                                displayMode={dataMode.mode}
                                                displayLabel={displayLabel}
                                                onDetailClick={() => {
                                                    setSelectedDetailOffense(stat.offense.toUpperCase() as OffenseCode);
                                                    setIsDetailModalOpen(true);
                                                }}
                                            />
                                        </div>
                                    );
                                });


                        })()}
                    </div>
                </div>
            )}


            {/* ALL Offenses View - State Grid */}
            {selectedOffense === 'ALL' && (
                <div>
                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <span>📍</span>
                        <span>States by Agency Count</span>
                    </h2>

                    {isLoading ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                            {Array.from({ length: 20 }).map((_, i) => (
                                <div key={i} className="card animate-pulse">
                                    <div className="h-6 bg-[var(--border-color)] rounded w-1/2 mb-2" />
                                    <div className="h-4 bg-[var(--border-color)] rounded w-3/4" />
                                </div>
                            ))}
                        </div>
                    ) : states.length === 0 ? (
                        <div className="card text-center py-8">
                            <p className="text-[var(--text-muted)]">No data available. Run the seed collector first.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                            {states.map((state, index) => (
                                <button
                                    key={state.state_abbr}
                                    onClick={() => onSelectState(state.state_abbr)}
                                    className="card text-left hover:border-[var(--accent-primary)] hover:shadow-glow transition-all group relative overflow-hidden"
                                >
                                    {index < 5 && (
                                        <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[var(--accent-primary)] flex items-center justify-center text-white text-xs font-bold">
                                            {index + 1}
                                        </div>
                                    )}
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-xl">📍</span>
                                        <span className="font-bold text-lg text-[var(--text-primary)] group-hover:text-[var(--accent-primary)]">
                                            {state.state_abbr}
                                        </span>
                                    </div>
                                    <p className="text-sm text-[var(--text-muted)] mb-1 truncate">{state.state_name}</p>
                                    <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                                        <span>{state.county_count} counties</span>
                                        <span className="font-bold" style={{ color: offense?.color }}>{state.agency_count} agencies</span>
                                    </div>
                                    <div className="mt-2 h-1 bg-[var(--border-color)] rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full transition-all"
                                            style={{
                                                width: `${Math.min((state.agency_count / (states[0]?.agency_count || 1)) * 100, 100)}%`,
                                                backgroundColor: offense?.color
                                            }}
                                        />
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Summary */}
            <div className="card bg-[var(--bg-secondary)]">
                <p className="text-sm text-[var(--text-muted)] flex items-center gap-2">
                    <span>ℹ️</span>
                    <span>
                        Click any state to view its counties. Counties load 50 at a time with scroll.
                    </span>
                </p>
            </div>
        </div >
    );
}
