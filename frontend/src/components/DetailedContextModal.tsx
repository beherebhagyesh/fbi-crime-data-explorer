"use client";

import React, { useState, useEffect } from 'react';
import {
    X, TrendingUp, TrendingDown, Activity,
    Calendar, MapPin, CheckCircle, AlertTriangle,
    BarChart3, LineChart, PieChart
} from 'lucide-react';
import {
    LineChart as ReLineChart,
    Line,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell
} from 'recharts';
import { getOffenseLabel, getOffenseConfig, OffenseCode } from '@/lib/offenseConfig';

interface Inference {
    type: string;
    label: string;
    value: string;
    importance: 'high' | 'medium' | 'low';
}

interface DetailData {
    offense: string;
    scope: string;
    level: 'National' | 'State' | 'County';
    yearly_trend: { year: number; count: number; clearances?: number }[];
    monthly_breakdown: { date: string; count: number }[];
    inferences: Inference[];
    agency_contribution?: { name: string; count: number }[];
    stats_2024?: {
        total: number;
        clearances: number;
        population: number;
        per_100k: number;
        coverage: number;
    };
}

interface DetailedContextModalProps {
    isOpen: boolean;
    onClose: () => void;
    countyId: string;
    countyName: string;
    offenseCode: OffenseCode;
}

const DetailedContextModal: React.FC<DetailedContextModalProps> = ({
    isOpen,
    onClose,
    countyId,
    countyName,
    offenseCode
}) => {
    const [data, setData] = useState<DetailData | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'trends' | 'breakdown' | 'agencies'>('trends');

    useEffect(() => {
        if (isOpen) {
            fetchData();
        }
    }, [isOpen, countyId, offenseCode]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:49080';
            const response = await fetch(`${API_URL}/api/counties/${countyId}/offense/${offenseCode}/details`);
            if (response.ok) {
                const result = await response.json();
                setData(result);
            }
        } catch (error) {
            console.error("Error fetching detail data:", error);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const getInferenceIcon = (type: string) => {
        switch (type) {
            case 'trend': return <TrendingUp className="w-5 h-5" />;
            case 'peak': return <Activity className="w-5 h-5" />;
            case 'season': return <Calendar className="w-5 h-5" />;
            case 'hotspot': return <MapPin className="w-5 h-5" />;
            case 'performance': return <CheckCircle className="w-5 h-5" />;
            case 'benchmark': return <BarChart3 className="w-5 h-5" />;
            case 'completeness': return <AlertTriangle className="w-5 h-5" />;
            default: return <CheckCircle className="w-5 h-5" />;
        }
    };

    const getImportanceColor = (imp: string) => {
        switch (imp) {
            case 'high': return 'text-red-400 border-red-900/50 bg-red-900/20';
            case 'medium': return 'text-orange-400 border-orange-900/50 bg-orange-900/20';
            default: return 'text-blue-400 border-blue-900/50 bg-blue-900/20';
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] w-full max-w-5xl max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col">

                {/* Header */}
                <div className="p-6 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-secondary)]">
                    <div>
                        <div className="flex items-center gap-3">
                            <span className="text-3xl">{getOffenseConfig(offenseCode)?.icon || '📊'}</span>
                            <h2 className="text-2xl font-bold text-[var(--text-primary)]">
                                {getOffenseLabel(offenseCode)} Breakdown
                            </h2>
                        </div>
                        <p className="text-[var(--text-muted)] text-sm mt-1">
                            Insights for {data?.scope || countyName} • {data?.level} Level Analysis
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-[var(--danger-bg)] rounded-full transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <div className="w-12 h-12 border-4 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin"></div>
                            <p className="text-[var(--text-muted)] animate-pulse">Running detail analytics...</p>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                {data?.inferences && data.inferences.length > 0 ? (
                                    data.inferences.map((inf, idx) => (
                                        <div
                                            key={idx}
                                            className={`p-4 rounded-xl border transition-all hover:scale-[1.02] ${getImportanceColor(inf.importance)}`}
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="opacity-70">{getInferenceIcon(inf.type)}</span>
                                                <span className="text-[10px] uppercase font-bold tracking-widest opacity-50">{inf.type}</span>
                                            </div>
                                            <h4 className="text-xs font-semibold uppercase opacity-60 mb-1">{inf.label}</h4>
                                            <p className="text-sm font-bold text-[var(--text-primary)]">{inf.value}</p>
                                        </div>
                                    ))
                                ) : (
                                    <div className="col-span-full py-10 card border-dashed border-2 flex flex-col items-center justify-center opacity-50">
                                        <BarChart3 className="w-8 h-8 mb-2" />
                                        <p>No actionable insights found for {offenseCode} yet.</p>
                                    </div>
                                )}
                            </div>

                            {/* Key Performance Indicators (KPIs) */}
                            {data?.stats_2024 ? (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-2">
                                    <div className="card-sm bg-[var(--bg-secondary)] p-4 rounded-xl border border-[var(--border-color)]">
                                        <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1 font-bold">{(data.stats_2024 as any).year || 2024} Total Incidents</p>
                                        <p className="text-2xl font-bold text-[var(--text-primary)]">{data.stats_2024.total.toLocaleString()}</p>
                                    </div>
                                    <div className="card-sm bg-[var(--bg-secondary)] p-4 rounded-xl border border-[var(--border-color)]">
                                        <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1 font-bold">Clearance rate</p>
                                        <p className="text-2xl font-bold text-green-500">
                                            {data.stats_2024.total > 0 ? ((data.stats_2024.clearances / data.stats_2024.total) * 100).toFixed(1) : 0}%
                                        </p>
                                    </div>
                                    <div className="card-sm bg-[var(--bg-secondary)] p-4 rounded-xl border border-[var(--border-color)]">
                                        <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1 font-bold">Crimes per 100k</p>
                                        <p className="text-2xl font-bold text-orange-500">{data.stats_2024.per_100k.toFixed(1)}</p>
                                    </div>
                                    <div className="card-sm bg-[var(--bg-secondary)] p-4 rounded-xl border border-[var(--border-color)]">
                                        <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1 font-bold">Pop. coverage</p>
                                        <p className={`text-2xl font-bold ${data.stats_2024.coverage < 90 ? 'text-red-500' : 'text-blue-500'}`}>
                                            {data.stats_2024.coverage?.toFixed(1)}%
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-orange-500/10 border border-orange-500/30 p-4 rounded-xl flex items-center gap-3">
                                    <AlertTriangle className="text-orange-500" />
                                    <p className="text-sm text-orange-400">Wait: 2024 KPI summary is pending for this offense at this level.</p>
                                </div>
                            )}

                            {/* Charts Section */}
                            <div className="space-y-6">
                                <div className="flex items-center gap-4 border-b border-[var(--border-color)]">
                                    <button
                                        onClick={() => setActiveTab('trends')}
                                        className={`pb-3 px-2 text-sm font-medium transition-all relative ${activeTab === 'trends' ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}
                                    >
                                        5-Year Trend
                                        {activeTab === 'trends' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--accent-primary)] shadow-[0_0_8px_var(--accent-primary)]" />}
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('breakdown')}
                                        className={`pb-3 px-2 text-sm font-medium transition-all relative ${activeTab === 'breakdown' ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}
                                    >
                                        Monthly Breakdown
                                        {activeTab === 'breakdown' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--accent-primary)] shadow-[0_0_8px_var(--accent-primary)]" />}
                                    </button>
                                    {data?.agency_contribution && data.agency_contribution.length > 0 && (
                                        <button
                                            onClick={() => setActiveTab('agencies')}
                                            className={`pb-3 px-2 text-sm font-medium transition-all relative ${activeTab === 'agencies' ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}
                                        >
                                            Agency Contributions
                                            {activeTab === 'agencies' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--accent-primary)] shadow-[0_0_8px_var(--accent-primary)]" />}
                                        </button>
                                    )}
                                </div>

                                <div className="h-[300px] w-full bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] rounded-xl p-4 flex items-center justify-center">
                                    {(!data?.yearly_trend || data.yearly_trend.length === 0) && activeTab === 'trends' ? (
                                        <div className="text-center opacity-40">
                                            <LineChart className="w-12 h-12 mx-auto mb-2" />
                                            <p>No 5-Year Trend data found</p>
                                        </div>
                                    ) : (!data?.monthly_breakdown || data.monthly_breakdown.length === 0) && activeTab === 'breakdown' ? (
                                        <div className="text-center opacity-40">
                                            <BarChart3 className="w-12 h-12 mx-auto mb-2" />
                                            <p>No monthly breakdown found</p>
                                        </div>
                                    ) : (
                                        <ResponsiveContainer width="100%" height="100%">
                                            {activeTab === 'trends' ? (
                                                <ReLineChart data={data?.yearly_trend || []}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                                                    <XAxis dataKey="year" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                                                    <YAxis
                                                        stroke="var(--text-muted)"
                                                        fontSize={12}
                                                        tickLine={false}
                                                        axisLine={false}
                                                        tickFormatter={(val) => val.toLocaleString()}
                                                    />
                                                    <Tooltip
                                                        contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)' }}
                                                        itemStyle={{ color: 'var(--accent-primary)' }}
                                                        formatter={(value: any) => [Number(value).toLocaleString(), ""]}
                                                    />
                                                    <Line
                                                        type="monotone"
                                                        dataKey="count"
                                                        stroke="var(--accent-primary)"
                                                        strokeWidth={3}
                                                        dot={{ r: 4, fill: 'var(--accent-primary)', strokeWidth: 2, stroke: 'var(--bg-primary)' }}
                                                        activeDot={{ r: 6 }}
                                                        name="Incidents"
                                                    />
                                                    <Line
                                                        type="monotone"
                                                        dataKey="clearances"
                                                        stroke="#22c55e"
                                                        strokeWidth={2}
                                                        strokeDasharray="5 5"
                                                        dot={{ r: 3, fill: '#22c55e' }}
                                                        name="Clearances"
                                                    />
                                                </ReLineChart>
                                            ) : activeTab === 'breakdown' ? (
                                                <BarChart data={data?.monthly_breakdown || []}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                                                    <XAxis
                                                        dataKey="date"
                                                        stroke="var(--text-muted)"
                                                        fontSize={10}
                                                        tickLine={false}
                                                        axisLine={false}
                                                        tickFormatter={(val) => val.split('-')[1] === '01' ? val.split('-')[0] : ''}
                                                    />
                                                    <YAxis
                                                        stroke="var(--text-muted)"
                                                        fontSize={12}
                                                        tickLine={false}
                                                        axisLine={false}
                                                        tickFormatter={(val) => val.toLocaleString()}
                                                    />
                                                    <Tooltip
                                                        contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)' }}
                                                        labelFormatter={(label) => `Date: ${label}`}
                                                        formatter={(value: any, name: string) => [Number(value).toLocaleString(), name === 'count' ? 'Incidents' : 'Clearances']}
                                                    />
                                                    <Bar dataKey="count" stackId="a" fill="var(--accent-primary)" radius={[0, 0, 0, 0]} name="Incidents" />
                                                    <Bar dataKey="clearances" stackId="a" fill="#22c55e" radius={[4, 4, 0, 0]} name="Clearances" />
                                                </BarChart>
                                            ) : (
                                                <BarChart data={data?.agency_contribution || []} layout="vertical" margin={{ left: 40, right: 20 }}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" horizontal={false} />
                                                    <XAxis type="number" stroke="var(--text-muted)" fontSize={12} hide />
                                                    <YAxis
                                                        dataKey="name"
                                                        type="category"
                                                        stroke="var(--text-muted)"
                                                        fontSize={10}
                                                        width={150}
                                                        tickLine={false}
                                                        axisLine={false}
                                                    />
                                                    <Tooltip
                                                        contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)' }}
                                                        formatter={(value: any) => [Number(value).toLocaleString(), "Incidents"]}
                                                    />
                                                    <Bar dataKey="count" fill="var(--accent-primary)" radius={[0, 4, 4, 0]} barSize={20} />
                                                </BarChart>
                                            )}
                                        </ResponsiveContainer>
                                    )}
                                </div>
                            </div>

                            {/* Legend / Info */}
                            <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl flex items-start gap-4">
                                <Activity className="w-6 h-6 text-blue-500 mt-1 shrink-0" />
                                <div>
                                    <h5 className="font-bold text-blue-500 text-sm">Context & Methodology</h5>
                                    <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                                        These values represent <b>Actual Reported Incidents</b> and <b>Clearances</b> aggregated for {data?.scope}.
                                        {data?.level === 'County' && ` Data is aggregated across ${data?.agency_contribution?.length} agencies.`}
                                        Clearance rates indicate Law Enforcement effectiveness in solving crimes.
                                        {data?.stats_2024?.coverage && data.stats_2024.coverage < 100 && ` Note: Data reflects ~${data.stats_2024.coverage.toFixed(0)}% population coverage.`}
                                    </p>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <div className="p-4 border-t border-[var(--border-color)] bg-[var(--bg-secondary)]/50 flex justify-between">
                    <button
                        onClick={async () => {
                            const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:49080';
                            try {
                                const response = await fetch(`${API_URL}/api/crimes/fetch/${countyId}`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        years: [2020, 2021, 2022, 2023, 2024],
                                        offenses: [offenseCode],
                                        forceRefresh: true
                                    }),
                                });
                                if (response.ok) {
                                    const result = await response.json();
                                    alert(`✅ Enriched ${offenseCode}: ${result.recordCount} records`);
                                    fetchData(); // Refresh modal data
                                }
                            } catch (e) {
                                alert('Failed to enrich: ' + e);
                            }
                        }}
                        className="px-6 py-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/80 text-white rounded-lg transition-colors font-medium flex items-center gap-2"
                    >
                        🔄 Enrich This Offense
                    </button>
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-[var(--bg-primary)] hover:bg-[var(--danger-bg)] text-[var(--text-primary)] rounded-lg transition-colors border border-[var(--border-color)] font-medium"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DetailedContextModal;
