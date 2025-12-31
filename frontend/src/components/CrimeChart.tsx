'use client';

import { useQuery } from '@tanstack/react-query';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from 'recharts';
import { getCountyTrends, TrendData } from '@/lib/api';

// Offense colors
const OFFENSE_COLORS: Record<string, string> = {
    HOM: '#ef4444', // red
    RPE: '#f97316', // orange
    ROB: '#eab308', // yellow
    ASS: '#84cc16', // lime
    BUR: '#22c55e', // green
    LAR: '#14b8a6', // teal
    MVT: '#06b6d4', // cyan
    ARS: '#3b82f6', // blue
    '13B': '#8b5cf6', // violet
    '250': '#a855f7', // purple
    '270': '#d946ef', // fuchsia
    '280': '#ec4899', // pink
    '290': '#f43f5e', // rose
    '520': '#64748b', // slate
    '35A': '#78716c', // stone
};

interface CrimeChartProps {
    countyId: string;
}

export function CrimeChart({ countyId }: CrimeChartProps) {
    const { data, isLoading, error } = useQuery({
        queryKey: ['trends', countyId],
        queryFn: () => getCountyTrends(countyId),
        enabled: !!countyId,
    });

    if (isLoading) {
        return (
            <div className="h-96 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    if (error || !data?.trends) {
        return (
            <div className="h-96 flex items-center justify-center text-red-500">
                Failed to load crime data
            </div>
        );
    }

    // Transform data for Recharts
    const years = [2020, 2021, 2022, 2023, 2024];
    const chartData = years.map((year) => {
        const point: Record<string, any> = { year };
        data.trends.forEach((trend: TrendData) => {
            point[trend.offense] = trend.counts[year];
        });
        return point;
    });

    // Add prediction for 2025
    const prediction2025: Record<string, any> = { year: 2025 };
    data.trends.forEach((trend: TrendData) => {
        prediction2025[trend.offense] = trend.predicted_2025;
    });
    chartData.push(prediction2025);

    return (
        <div>
            <h2 className="text-xl font-semibold mb-4">
                Crime Trends for {countyId.replace('_', ', ')}
            </h2>

            {/* Main Chart */}
            <div className="h-96 mb-8">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="year" />
                        <YAxis />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                                borderRadius: '8px',
                                border: 'none',
                                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                            }}
                        />
                        <Legend />
                        {data.trends.slice(0, 8).map((trend: TrendData) => (
                            <Line
                                key={trend.offense}
                                type="monotone"
                                dataKey={trend.offense}
                                stroke={OFFENSE_COLORS[trend.offense] || '#666'}
                                strokeWidth={2}
                                dot={{ r: 4 }}
                                strokeDasharray={chartData.length > 5 ? '5 5' : undefined}
                            />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            </div>

            {/* Trend Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {data.trends.map((trend: TrendData) => (
                    <TrendCard key={trend.offense} trend={trend} />
                ))}
            </div>
        </div>
    );
}

function TrendCard({ trend }: { trend: TrendData }) {
    const trendIcon = {
        increasing: '↑',
        decreasing: '↓',
        stable: '→',
        unknown: '?',
    };

    const trendColor = {
        increasing: 'text-red-500',
        decreasing: 'text-green-500',
        stable: 'text-gray-500',
        unknown: 'text-gray-400',
    };

    return (
        <div className="p-4 rounded-lg bg-gray-50 dark:bg-slate-700">
            <div className="flex justify-between items-start mb-2">
                <span className="font-medium">{trend.offense}</span>
                <span className={trendColor[trend.trend]}>
                    {trendIcon[trend.trend]}
                </span>
            </div>

            {trend.cagr !== null && (
                <div className="text-sm">
                    <span className="text-gray-500">CAGR:</span>{' '}
                    <span className={trend.cagr > 0 ? 'text-red-500' : 'text-green-500'}>
                        {trend.cagr > 0 ? '+' : ''}{trend.cagr.toFixed(1)}%
                    </span>
                </div>
            )}

            {trend.predicted_2025 !== null && (
                <div className="text-sm text-gray-500">
                    2025 Est: {trend.predicted_2025.toLocaleString()}
                </div>
            )}

            {trend.is_anomaly && (
                <div className="text-xs text-yellow-600 mt-1">⚠️ Anomaly</div>
            )}
        </div>
    );
}
