'use client';

import { useState, useEffect } from 'react';
import { getOffenseConfig, OffenseCode, ALL_OFFENSE_CODES, normalizeOffenseCode } from '@/lib/offenseConfig';
import { fetchAgencyCrimeData, showToast } from '@/lib/agencyActions';
import CrimeStatsCard from '../CrimeStatsCard';
import DetailedContextModal from '../DetailedContextModal';
import { DataModeConfig, calculateDisplayValue, CalculatedValue } from '../DataModeSelector';

interface Agency {
    ori: string;
    name: string;
    type: string;
    population: number;
    isHeavyLift: boolean;
    isFetching?: boolean;
    hasCrimeData?: boolean;
}

interface CrimeStat {
    offense: string;
    year: number;
    totalCount: number;
    agenciesReporting: number;
    agenciesTotal: number;
    reportingPct: number;
    isComplete: boolean;
}

interface CountyViewProps {
    countyId: string;
    countyName: string;
    stateAbbr: string;
    selectedOffense: OffenseCode;
    year: number;
    dataMode: DataModeConfig;
}

export default function CountyView({
    countyId,
    countyName,
    stateAbbr,
    selectedOffense,
    year,
    dataMode,
}: CountyViewProps) {

    const [agencies, setAgencies] = useState<Agency[]>([]);
    const [crimeStats, setCrimeStats] = useState<CrimeStat[]>([]);
    const [aggregations, setAggregations] = useState<Record<string, any>>({});
    const [isLoading, setIsLoading] = useState(true);
    // Track controllers to allow cancellation
    const [fetchingControllers, setFetchingControllers] = useState<Record<string, AbortController>>({});

    // Modal state for detailed analytics
    const [selectedDetailOffense, setSelectedDetailOffense] = useState<OffenseCode | null>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

    const fetchCountyData = async (isBackground = false) => {
        if (!isBackground) setIsLoading(true);
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:49080';
            const response = await fetch(`${apiUrl}/api/counties/${countyId}`);
            const data = await response.json();

            if (data.agencies) {
                setAgencies(prev => data.agencies.map((a: any) => {
                    const existing = prev.find((p) => p.ori === a.ori);
                    return {
                        ori: a.ori,
                        name: a.name,
                        type: a.type,
                        population: a.population || 0,
                        isHeavyLift: a.is_heavy_lift || false,
                        hasCrimeData: a.has_crime_data || existing?.hasCrimeData || false,
                    };
                }));
            }

            if (data.crime_stats) {
                setCrimeStats(data.crime_stats.map((s: any) => ({
                    offense: normalizeOffenseCode(s.offense),
                    year: s.year,
                    totalCount: s.total_count || 0,
                    agenciesReporting: s.agencies_reporting || 0,
                    agenciesTotal: s.agencies_total || 0,
                    reportingPct: s.reporting_pct || 0,
                    isComplete: s.is_complete || false,
                })));
            }

            if (!isBackground) showToast('success', `Loaded ${countyName} county data`);
        } catch (error) {
            console.error('Failed to fetch county data:', error);
            if (!isBackground) showToast('error', 'Failed to load county data');
        } finally {
            if (!isBackground) setIsLoading(false);
        }
    };

    const fetchAggregations = async () => {
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:49080';
            const response = await fetch(`${apiUrl}/api/stats/aggregations/county/${countyId}`);
            if (response.ok) {
                const data = await response.json();
                const aggMap = data.reduce((acc: any, curr: any) => {
                    acc[curr.offense.toUpperCase()] = curr;
                    return acc;
                }, {});
                setAggregations(aggMap);
            }
        } catch (err) {
            console.error('Failed to fetch aggregations:', err);
        }
    };

    useEffect(() => {
        fetchCountyData();
        fetchAggregations();
        // Sync modal offense with sidebar selection
        if (selectedOffense && selectedOffense !== 'ALL') {
            setSelectedDetailOffense(selectedOffense);
        }
    }, [countyId, countyName, selectedOffense]);

    // Handle agency click - fetch crime data
    const handleAgencyClick = async (agency: Agency) => {
        // Check if already fetching
        if (fetchingControllers[agency.ori]) {
            // Already fetching -> THIS BUTTON SHOULD BE "STOP" now
            // But if called here, maybe stop?
            // See render logic for Stop button.
            return;
        }

        const controller = new AbortController();
        setFetchingControllers(prev => ({ ...prev, [agency.ori]: controller }));

        try {
            await fetchAgencyCrimeData(
                agency.ori,
                agency.name,
                { forceRefresh: agency.hasCrimeData }, // Force refresh if already has data
                // onProgress
                (count) => {
                    // Refresh data in background to show progress on charts!
                    fetchCountyData(true);
                },
                controller.signal
            );

            // Final refresh
            fetchCountyData(true);

            // Mark agency as having data
            setAgencies(prev => prev.map(a =>
                a.ori === agency.ori ? { ...a, hasCrimeData: true } : a
            ));

        } catch (error: any) {
            if (error.name === 'AbortError') {
                console.log('Fetch aborted');
            } else {
                console.error('Fetch failed:', error);
            }
        } finally {
            setFetchingControllers(prev => {
                const next = { ...prev };
                delete next[agency.ori];
                return next;
            });
        }
    };

    const handleStopFetch = (agency: Agency) => {
        const controller = fetchingControllers[agency.ori];
        if (controller) {
            controller.abort();
            // cleanup handled in finally block of handleAgencyClick
        }
    };

    // Filter stats by selected offense
    const filteredStats = (selectedOffense && selectedOffense !== 'ALL')
        ? crimeStats.filter(s => s.offense === selectedOffense)
        : crimeStats;

    // Get latest year stats
    const latestStats = filteredStats.filter(s => s.year === year);

    // Get unique offenses with data
    const offensesWithData = Array.from(new Set(crimeStats.map(s => s.offense)));

    const displayLabelHeader = dataMode.mode === 'sum' ? 'Total Sum' :
        dataMode.mode === 'avg' ? 'Annual Average' :
            dataMode.mode === 'growth' ? 'Year-over-Year Growth' :
                dataMode.mode === 'min' ? 'Lowest Reported' :
                    dataMode.mode === 'max' ? 'Peak Reported' : 'Crime Statistics';

    return (
        <div className="space-y-6 animate-fade-in h-full overflow-y-auto pr-2 custom-scrollbar">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                    <span className="text-4xl">🏘️</span>
                    <div>
                        <h1 className="text-2xl font-bold text-[var(--text-primary)]">
                            {countyName}
                        </h1>
                        <p className="text-[var(--text-muted)]">
                            {stateAbbr} • {agencies.length} agencies • {year} data
                        </p>
                    </div>
                </div>

                {/* Quick Stats */}
                <div className="flex items-center gap-4">
                    <div className="card py-2 px-4">
                        <p className="stat-label text-xs">Total Agencies</p>
                        <p className="text-xl font-bold text-[var(--accent-primary)]">
                            {agencies.length}
                        </p>
                    </div>
                    <div className="card py-2 px-4">
                        <p className="stat-label text-xs">Offenses Tracked</p>
                        <p className="text-xl font-bold text-[var(--accent-secondary)]">
                            {offensesWithData.length}
                        </p>
                    </div>
                </div>
            </div>

            {/* No Data State */}
            {!isLoading && crimeStats.length === 0 && (
                <div className="card text-center py-12 border-dashed border-2 border-[var(--accent-primary)]">
                    <span className="text-5xl mb-4 block">📊</span>
                    <h3 className="text-xl font-bold text-[var(--text-primary)] mb-2">
                        No Crime Data Yet
                    </h3>
                    <p className="text-[var(--text-muted)] mb-4">
                        Click on an agency below to fetch crime data from the FBI API.
                    </p>
                    <p className="text-sm text-[var(--accent-primary)]">
                        Each agency fetch will retrieve 5 years × 15 offenses = 75 data points
                    </p>
                </div>
            )}

            {/* Crime Stats Cards */}
            {latestStats.length > 0 && (
                <div>
                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <span>📈</span>
                        <span>{dataMode.mode === 'single' ? `${year} Crime Statistics` : `${displayLabelHeader}`}</span>
                        {dataMode.mode === 'single' && (
                            <span className="text-sm font-normal text-[var(--text-muted)]">
                                ({latestStats.length} offenses)
                            </span>
                        )}
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {latestStats.map((stat) => {
                            const offenseKey = stat.offense.toUpperCase();
                            const agg = aggregations[offenseKey];
                            let calculatedVal: CalculatedValue | undefined;
                            let displayLabel = `${stat.year} Data`;
                            let displayCount = stat.totalCount;

                            if (dataMode.mode !== 'single' && agg) {
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
                            }

                            return (
                                <CrimeStatsCard
                                    key={`${stat.offense}-${stat.year}`}
                                    offenseCode={stat.offense as OffenseCode}
                                    count={displayCount}
                                    year={stat.year}
                                    agenciesReporting={stat.agenciesReporting}
                                    agenciesTotal={stat.agenciesTotal}
                                    calculatedValue={calculatedVal}
                                    displayMode={dataMode.mode}
                                    displayLabel={displayLabel}
                                    population={agg?.population}
                                    per100k={agg?.per_100k}
                                    onDetailClick={() => {
                                        setSelectedDetailOffense(stat.offense as OffenseCode);
                                        setIsDetailModalOpen(true);
                                    }}
                                />
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Agencies List - CLICKABLE */}
            <div className="card">
                <h2 className="text-lg font-bold mb-2 flex items-center gap-2">
                    <span>🏛️</span>
                    <span>Reporting Agencies</span>
                    <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-[var(--accent-primary)] text-white">
                        {agencies.length}
                    </span>
                </h2>
                <p className="text-sm text-[var(--text-muted)] mb-4">
                    👆 Click an agency to fetch its crime data from the FBI API
                </p>

                {isLoading ? (
                    <div className="space-y-2">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="h-16 bg-[var(--border-color)] rounded animate-pulse" />
                        ))}
                    </div>
                ) : agencies.length === 0 ? (
                    <p className="text-[var(--text-muted)]">No agencies found</p>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {agencies.map((agency) => {
                            const isFetching = !!fetchingControllers[agency.ori];

                            return (
                                <button
                                    key={agency.ori}
                                    onClick={(e) => {
                                        if (isFetching) {
                                            e.stopPropagation();
                                            handleStopFetch(agency);
                                        } else {
                                            handleAgencyClick(agency);
                                        }
                                    }}
                                    className={`p-4 rounded-lg text-left transition-all cursor-pointer relative group
                                       ${agency.hasCrimeData
                                            ? 'bg-green-500/10 border-2 border-green-500'
                                            : 'bg-[var(--bg-secondary)] border border-[var(--border-color)]'
                                        }
                                       ${isFetching
                                            ? 'border-[var(--accent-primary)] ring-1 ring-[var(--accent-primary)]'
                                            : 'hover:border-[var(--accent-primary)] hover:shadow-glow'
                                        }
                                    `}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <p className="font-medium text-sm text-[var(--text-primary)]">
                                                {agency.name}
                                            </p>
                                            <p className="text-xs text-[var(--text-muted)] font-mono">
                                                {agency.ori}
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {agency.isHeavyLift && (
                                                <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400">
                                                    Heavy
                                                </span>
                                            )}
                                            {agency.hasCrimeData && (
                                                <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">
                                                    ✓ Data
                                                </span>
                                            )}
                                            {isFetching && (
                                                <div className="flex items-center gap-1">
                                                    <div className="w-4 h-4 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
                                                    <span className="text-xs text-red-400 font-bold hover:underline">STOP</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 mt-2 text-xs text-[var(--text-muted)]">
                                        <span className="px-2 py-0.5 rounded bg-[var(--border-color)]">
                                            {agency.type}
                                        </span>
                                        {agency.population > 0 && (
                                            <span>Pop: {agency.population.toLocaleString()}</span>
                                        )}
                                    </div>

                                    {!agency.hasCrimeData && !isFetching && (
                                        <div className="mt-3 text-xs text-[var(--accent-primary)] flex items-center gap-1">
                                            <span>🔍</span>
                                            <span>Click to fetch crime data</span>
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Fetch All Button */}
            {agencies.length > 0 && (
                <div className="card bg-[var(--accent-primary)]/10 border-[var(--accent-primary)]">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-bold text-[var(--text-primary)]">Batch Fetch All Agencies</p>
                            <p className="text-sm text-[var(--text-muted)]">
                                Fetch crime data for all {agencies.length} agencies ({agencies.filter(a => a.hasCrimeData).length} already enriched)
                            </p>
                        </div>
                        <button
                            onClick={async () => {
                                showToast('info', `Starting batch fetch for ${agencies.length} agencies...`);
                                for (const agency of agencies) {
                                    if (!agency.hasCrimeData) {
                                        await handleAgencyClick(agency);
                                        // Small delay between agencies to avoid overwhelming API
                                        await new Promise(r => setTimeout(r, 500));
                                    }
                                }
                                showToast('success', `Batch fetch complete!`);
                            }}
                            className="px-4 py-2 bg-[var(--accent-primary)] text-white rounded-lg 
                         hover:bg-[var(--accent-primary)]/80 transition-all font-medium"
                        >
                            🚀 Fetch All
                        </button>
                    </div>
                </div>
            )}

            {/* Detailed Analytics Modal */}
            {selectedDetailOffense && (
                <DetailedContextModal
                    isOpen={isDetailModalOpen}
                    onClose={() => setIsDetailModalOpen(false)}
                    countyId={countyId}
                    countyName={countyName}
                    offenseCode={selectedDetailOffense}
                />
            )}
        </div>
    );
}
