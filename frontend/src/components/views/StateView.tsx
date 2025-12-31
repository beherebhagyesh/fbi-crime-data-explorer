'use client';

import { useState, useEffect, useCallback } from 'react';
import { getOffenseConfig, OffenseCode, normalizeOffenseCode } from '@/lib/offenseConfig';
import { useInfiniteScroll } from '../InfiniteScroll';
import CrimeStatsCard from '../CrimeStatsCard';
import DetailedContextModal from '../DetailedContextModal';

interface County {
    county_id: string;
    county_name: string;
    state_abbr: string;
    agency_count: number;
}

interface StateViewProps {
    stateAbbr: string;
    stateName: string;
    selectedOffense: OffenseCode;
    year: number;
    onSelectCounty: (countyId: string) => void;
}

const PAGE_SIZE = 50;

export default function StateView({
    stateAbbr,
    stateName,
    selectedOffense,
    year,
    onSelectCounty,
}: StateViewProps) {
    const [counties, setCounties] = useState<County[]>([]);
    const [totalCount, setTotalCount] = useState<number>(0);
    const [offset, setOffset] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const [hasMore, setHasMore] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [stateStats, setStateStats] = useState<any>(null);
    const [allStats, setAllStats] = useState<any[]>([]);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [selectedDetailOffense, setSelectedDetailOffense] = useState<OffenseCode>(selectedOffense);

    // Sync modal offense with sidebar selection
    useEffect(() => {
        if (selectedOffense && selectedOffense !== 'ALL') {
            setSelectedDetailOffense(selectedOffense);
        }
    }, [selectedOffense]);

    const offense = getOffenseConfig(selectedOffense);

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:49080';

    // Fetch total count first
    useEffect(() => {
        const fetchCount = async () => {
            try {
                const response = await fetch(`${apiUrl}/api/counties/count?state=${stateAbbr}`);
                if (response.ok) {
                    const data = await response.json();
                    setTotalCount(data.count);
                }
            } catch (err) {
                console.error('Failed to fetch count:', err);
            }
        };

        fetchCount();

        // Also fetch state-level stats for the overview card
        const fetchStateStats = async () => {
            try {
                // Fetch individual detail for selected offense
                if (selectedOffense !== 'ALL') {
                    const response = await fetch(`${apiUrl}/api/counties/STATE_${stateAbbr}/offense/${selectedOffense}/details`);
                    if (response.ok) {
                        const data = await response.json();
                        setStateStats(data);
                    }
                }

                // Fetch ALL stats for the grid
                const summaryResponse = await fetch(`${apiUrl}/api/counties/STATE_${stateAbbr}`);
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
                console.error('Failed to fetch state stats:', err);
            }
        };
        fetchStateStats();
    }, [stateAbbr, selectedOffense, apiUrl]);

    // Load more counties
    const loadMore = useCallback(async () => {
        if (isLoading || !hasMore) return;

        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch(
                `${apiUrl}/api/counties?state=${stateAbbr}&limit=${PAGE_SIZE}&offset=${offset}`
            );

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();

            if (data.length < PAGE_SIZE) {
                setHasMore(false);
            }

            // Deduplicate counties by county_id
            setCounties(prev => {
                const existing = new Set(prev.map(c => c.county_id));
                const newCounties = data.filter((c: County) => !existing.has(c.county_id));
                return [...prev, ...newCounties];
            });
            setOffset(prev => prev + PAGE_SIZE);
        } catch (err) {
            console.error('Failed to fetch counties:', err);
            setError(err instanceof Error ? err.message : 'Failed to load');
        } finally {
            setIsLoading(false);
            setIsInitialLoad(false);
        }
    }, [apiUrl, stateAbbr, offset, isLoading, hasMore]);

    // Initial load
    useEffect(() => {
        // Reset when state changes
        setCounties([]);
        setOffset(0);
        setHasMore(true);
        setIsInitialLoad(true);
        setError(null);
    }, [stateAbbr]);

    // Trigger initial load after reset
    useEffect(() => {
        if (isInitialLoad && counties.length === 0 && hasMore) {
            loadMore();
        }
    }, [isInitialLoad, counties.length, hasMore, loadMore]);

    // Infinite scroll hook
    const scrollContainerRef = useInfiniteScroll(loadMore, hasMore, isLoading);

    return (
        <div className="space-y-6 animate-fade-in h-full flex flex-col">
            {/* Header - Always shown */}
            <div className="flex items-center justify-between flex-wrap gap-4 flex-shrink-0">
                <div className="flex items-center gap-4">
                    <span className="text-4xl">📍</span>
                    <div>
                        <h1 className="text-2xl font-bold text-[var(--text-primary)]">
                            {stateName}
                        </h1>
                        <p className="text-[var(--text-muted)]">
                            {totalCount > 0 ? (
                                <>Showing {counties.length} of {totalCount} counties</>
                            ) : (
                                <>Loading counties...</>
                            )}
                        </p>
                    </div>
                </div>

                {/* Enrich button for ALL offenses view */}
                {selectedOffense === 'ALL' && (
                    <button
                        onClick={async () => {
                            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:49080';
                            try {
                                const response = await fetch(`${apiUrl}/api/crimes/fetch/STATE_${stateAbbr}`, {
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

            {/* Detailed Analytics Modal */}
            {isDetailModalOpen && (
                <DetailedContextModal
                    isOpen={isDetailModalOpen}
                    onClose={() => setIsDetailModalOpen(false)}
                    countyId={`STATE_${stateAbbr}`}
                    countyName={`${stateName} (Statewide)`}
                    offenseCode={selectedDetailOffense}
                />
            )}

            {/* All Offenses Grid */}
            {selectedOffense === 'ALL' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 flex-shrink-0 mb-8">
                    {allStats.length > 0 ? (
                        Object.values(
                            allStats.reduce((acc: any, stat: any) => {
                                const offenseKey = stat.offense.toUpperCase();
                                if (!acc[offenseKey] || stat.year > acc[offenseKey].year) {
                                    acc[offenseKey] = stat;
                                }
                                return acc;
                            }, {} as Record<string, any>)
                        ).map((stat: any) => (
                            <CrimeStatsCard
                                key={stat.offense}
                                offenseCode={stat.offense.toUpperCase() as OffenseCode}
                                count={stat.total_count}
                                year={stat.year}
                                agenciesReporting={100}
                                agenciesTotal={100}
                                onDetailClick={() => {
                                    setSelectedDetailOffense(stat.offense.toUpperCase() as OffenseCode);
                                    setIsDetailModalOpen(true);
                                }}
                            />
                        ))
                    ) : (
                        <div className="col-span-full py-20 card text-center bg-[var(--bg-secondary)]/30 border-dashed border-2">
                            <p className="text-[var(--text-muted)] italic">No state-level crime statistics found.</p>
                        </div>
                    )}
                </div>
            )}

            {/* Error State */}
            {error && (
                <div className="card border-red-500 bg-red-500/10 flex-shrink-0">
                    <p className="text-red-400 flex items-center gap-2">
                        <span>⚠️</span>
                        <span>{error}</span>
                    </p>
                </div>
            )}

            {/* Counties Grid - Scrollable */}
            <div
                ref={scrollContainerRef}
                className="flex-1 overflow-y-auto min-h-0"
            >
                {isInitialLoad ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {Array.from({ length: 12 }).map((_, i) => (
                            <div key={i} className="card animate-pulse">
                                <div className="h-6 bg-[var(--border-color)] rounded w-2/3 mb-3" />
                                <div className="h-4 bg-[var(--border-color)] rounded w-1/2" />
                            </div>
                        ))}
                    </div>
                ) : counties.length === 0 ? (
                    <div className="card text-center py-8">
                        <p className="text-[var(--text-muted)]">No counties found for {stateAbbr}</p>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {/* Card in first cell for single offense view */}
                            {selectedOffense !== 'ALL' && (
                                <div className="row-span-2 flex flex-col gap-4">
                                    <CrimeStatsCard
                                        isLoading={!stateStats}
                                        offenseCode={selectedOffense}
                                        count={stateStats?.stats_2024?.total || 0}
                                        year={stateStats?.stats_2024?.year || 2024}
                                        agenciesReporting={stateStats?.stats_2024?.agencies_reporting || 0}
                                        agenciesTotal={stateStats?.agency_count || 0}
                                        onDetailClick={() => setIsDetailModalOpen(true)}
                                    />
                                    <div className="card bg-[var(--accent-primary)]/10 border-[var(--accent-primary)]">
                                        <p className="text-xs text-[var(--text-secondary)]">
                                            <strong>📊 Note:</strong> Viewing <strong style={{ color: offense?.color }}>{offense?.label}</strong> data.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* First batch of counties (fills remaining columns) */}
                            {counties.slice(0, selectedOffense !== 'ALL' ? 5 : 8).map((county, index) => (
                                <button
                                    key={county.county_id}
                                    onClick={() => onSelectCounty(county.county_id)}
                                    className="card text-left hover:border-[var(--accent-primary)] hover:shadow-glow transition-all group"
                                >
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg">🏘️</span>
                                            <span className="font-bold text-[var(--text-primary)] group-hover:text-[var(--accent-primary)]">
                                                {county.county_name}
                                            </span>
                                        </div>
                                        {index < 5 && (
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--accent-primary)] text-white">
                                                #{index + 1}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-[var(--text-muted)]">
                                            {county.agency_count} {county.agency_count === 1 ? 'agency' : 'agencies'}
                                        </span>
                                        <span className="text-[var(--accent-primary)] opacity-0 group-hover:opacity-100 transition-opacity">
                                            View →
                                        </span>
                                    </div>
                                    <div className="mt-3 h-1 bg-[var(--border-color)] rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full transition-all"
                                            style={{
                                                width: `${Math.min((county.agency_count / (counties[0]?.agency_count || 1)) * 100, 100)}%`,
                                                backgroundColor: offense?.color || 'var(--accent-primary)'
                                            }}
                                        />
                                    </div>
                                </button>
                            ))}
                        </div>

                        {/* Remaining counties in full grid */}
                        {counties.length > (selectedOffense !== 'ALL' ? 5 : 8) && (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
                                {counties.slice(selectedOffense !== 'ALL' ? 5 : 8).map((county) => (
                                    <button
                                        key={county.county_id}
                                        onClick={() => onSelectCounty(county.county_id)}
                                        className="card text-left hover:border-[var(--accent-primary)] hover:shadow-glow transition-all group"
                                    >
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="text-lg">🏘️</span>
                                                <span className="font-bold text-[var(--text-primary)] group-hover:text-[var(--accent-primary)]">
                                                    {county.county_name}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-[var(--text-muted)]">
                                                {county.agency_count} {county.agency_count === 1 ? 'agency' : 'agencies'}
                                            </span>
                                            <span className="text-[var(--accent-primary)] opacity-0 group-hover:opacity-100 transition-opacity">
                                                View →
                                            </span>
                                        </div>
                                        <div className="mt-3 h-1 bg-[var(--border-color)] rounded-full overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-all"
                                                style={{
                                                    width: `${Math.min((county.agency_count / (counties[0]?.agency_count || 1)) * 100, 100)}%`,
                                                    backgroundColor: offense?.color || 'var(--accent-primary)'
                                                }}
                                            />
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Loading more indicator */}
                        {isLoading && (
                            <div className="flex items-center justify-center py-8">
                                <div className="flex items-center gap-3">
                                    <div className="w-6 h-6 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
                                    <span className="text-[var(--text-muted)]">Loading more counties...</span>
                                </div>
                            </div>
                        )}

                        {/* End of list */}
                        {!hasMore && counties.length > 0 && (
                            <div className="text-center py-6 text-[var(--text-muted)] text-sm">
                                ✓ All {counties.length} counties loaded
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Progress indicator */}
            {totalCount > 0 && (
                <div className="flex-shrink-0 pt-2 border-t border-[var(--border-color)]">
                    <div className="flex items-center justify-between text-xs text-[var(--text-muted)] mb-1">
                        <span>Loading progress</span>
                        <span>{Math.round((counties.length / totalCount) * 100)}%</span>
                    </div>
                    <div className="h-1 bg-[var(--border-color)] rounded-full overflow-hidden">
                        <div
                            className="h-full rounded-full bg-[var(--accent-primary)] transition-all"
                            style={{ width: `${(counties.length / totalCount) * 100}%` }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
