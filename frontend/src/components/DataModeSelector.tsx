'use client';

import { useState, useEffect } from 'react';

export type AggregationMode = 'single' | 'sum' | 'avg' | 'growth' | 'min' | 'max';

export interface DataModeConfig {
    year: number;           // 2020-2025
    mode: AggregationMode;
    range?: number;         // 2-6 for sum/avg/min/max modes
}

export interface CalculatedValue {
    value: number;
    label?: string;         // For min/max: "2020", "2024" etc
    suffix?: string;        // For growth: "%"
    prefix?: string;        // For growth: "+" or "-"
    isNA?: boolean;
}

interface DataModeSelectorProps {
    config: DataModeConfig;
    onChange: (config: DataModeConfig) => void;
}

const YEARS = [2025, 2024, 2023, 2022, 2021, 2020];

const MODE_OPTIONS: { value: AggregationMode; label: string; icon: string }[] = [
    { value: 'single', label: 'Single Year', icon: '📅' },
    { value: 'growth', label: '% Growth', icon: '📈' },
    { value: 'sum', label: 'Sum Total', icon: '➕' },
    { value: 'avg', label: 'Average', icon: '📊' },
    { value: 'max', label: 'Highest Year', icon: '🔺' },
    { value: 'min', label: 'Lowest Year', icon: '🔻' },
];

export default function DataModeSelector({ config, onChange }: DataModeSelectorProps) {
    const { year, mode, range } = config;

    // Calculate max range based on selected year (can't go before 2020)
    const maxRange = year - 2020 + 1; // e.g., 2024 → 5 years (2020-2024)

    // Check if growth mode is available (needs previous year)
    const isGrowthAvailable = year > 2020;

    // Check if mode needs range selection
    const needsRange = ['sum', 'avg', 'min', 'max'].includes(mode);

    // Handle year change
    const handleYearChange = (newYear: number) => {
        const newConfig: DataModeConfig = { ...config, year: newYear };

        // Disable growth if year is 2020
        if (newYear === 2020 && mode === 'growth') {
            newConfig.mode = 'single';
        }

        // Adjust range if it exceeds new max
        if (needsRange && range && range > newYear - 2020 + 1) {
            newConfig.range = newYear - 2020 + 1;
        }

        onChange(newConfig);
    };

    // Handle mode change
    const handleModeChange = (newMode: AggregationMode) => {
        const newConfig: DataModeConfig = { ...config, mode: newMode };

        // Set default range for modes that need it
        if (['sum', 'avg', 'min', 'max'].includes(newMode) && !range) {
            newConfig.range = Math.min(3, maxRange); // Default to 3-year or max available
        }

        // Remove range for modes that don't need it
        if (newMode === 'single' || newMode === 'growth') {
            delete newConfig.range;
        }

        onChange(newConfig);
    };

    // Handle range change
    const handleRangeChange = (newRange: number) => {
        onChange({ ...config, range: newRange });
    };

    // Get available range options
    const rangeOptions = Array.from({ length: maxRange - 1 }, (_, i) => i + 2)
        .filter(r => r <= 6); // Max 6-year range

    return (
        <div className="flex items-center gap-2 flex-wrap">
            {/* Year Dropdown */}
            <div className="relative">
                <select
                    value={year}
                    onChange={(e) => handleYearChange(Number(e.target.value))}
                    className="appearance-none bg-[var(--bg-card)] border border-[var(--border-color)] 
                             rounded-lg px-3 py-1.5 pr-8 text-sm font-medium
                             text-[var(--text-primary)] cursor-pointer
                             hover:border-[var(--accent-primary)] transition-colors
                             focus:outline-none focus:ring-2 focus:ring-[var(--accent-glow)]"
                >
                    {YEARS.map((y) => (
                        <option key={y} value={y}>
                            {y}
                        </option>
                    ))}
                </select>
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none text-xs">
                    ▼
                </span>
            </div>

            {/* Mode Dropdown */}
            <div className="relative">
                <select
                    value={mode}
                    onChange={(e) => handleModeChange(e.target.value as AggregationMode)}
                    className="appearance-none bg-[var(--bg-card)] border border-[var(--border-color)] 
                             rounded-lg px-3 py-1.5 pr-8 text-sm font-medium
                             text-[var(--text-primary)] cursor-pointer
                             hover:border-[var(--accent-primary)] transition-colors
                             focus:outline-none focus:ring-2 focus:ring-[var(--accent-glow)]"
                >
                    {MODE_OPTIONS.map((opt) => (
                        <option
                            key={opt.value}
                            value={opt.value}
                            disabled={opt.value === 'growth' && !isGrowthAvailable}
                        >
                            {opt.icon} {opt.label}
                        </option>
                    ))}
                </select>
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none text-xs">
                    ▼
                </span>
            </div>

            {/* Range Dropdown - Only for sum/avg/min/max */}
            {needsRange && rangeOptions.length > 0 && (
                <div className="relative">
                    <select
                        value={range || 3}
                        onChange={(e) => handleRangeChange(Number(e.target.value))}
                        className="appearance-none bg-[var(--bg-card)] border border-[var(--border-color)] 
                                 rounded-lg px-3 py-1.5 pr-8 text-sm font-medium
                                 text-[var(--text-primary)] cursor-pointer
                                 hover:border-[var(--accent-primary)] transition-colors
                                 focus:outline-none focus:ring-2 focus:ring-[var(--accent-glow)]"
                    >
                        {rangeOptions.map((r) => (
                            <option key={r} value={r}>
                                {r}-Year Range
                            </option>
                        ))}
                    </select>
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none text-xs">
                        ▼
                    </span>
                </div>
            )}

            {/* Mode indicator badge */}
            <div className="hidden md:flex items-center gap-1 px-2 py-1 rounded-full bg-[var(--danger-bg)] border border-[var(--accent-primary)]/30 text-xs">
                <span>{MODE_OPTIONS.find(m => m.value === mode)?.icon}</span>
                <span className="text-[var(--text-secondary)]">
                    {mode === 'single' && `${year}`}
                    {mode === 'growth' && `${year - 1} → ${year}`}
                    {mode === 'sum' && `${year - (range || 3) + 1}-${year} Sum`}
                    {mode === 'avg' && `${year - (range || 3) + 1}-${year} Avg`}
                    {mode === 'max' && `${year - (range || 3) + 1}-${year} Peak`}
                    {mode === 'min' && `${year - (range || 3) + 1}-${year} Low`}
                </span>
            </div>
        </div>
    );
}

/**
 * Calculate the displayed value based on mode configuration
 * @param yearlyData - Object with year keys and count values: { 2020: 54437, 2021: 58221, ... }
 * @param config - DataModeConfig
 * @returns CalculatedValue
 */
export function calculateDisplayValue(
    yearlyData: Record<number, number>,
    config: DataModeConfig
): CalculatedValue {
    const { year, mode, range = 3 } = config;

    // Get value for a specific year
    const getValue = (y: number): number => yearlyData[y] || 0;

    switch (mode) {
        case 'single':
            return { value: getValue(year) };

        case 'growth': {
            const current = getValue(year);
            const previous = getValue(year - 1);
            if (previous === 0) {
                return { value: 0, isNA: true };
            }
            const growth = ((current - previous) / previous) * 100;
            return {
                value: Math.abs(growth),
                suffix: '%',
                prefix: growth >= 0 ? '+' : '-',
            };
        }

        case 'sum': {
            const startYear = Math.max(2020, year - range + 1);
            let total = 0;
            for (let y = startYear; y <= year; y++) {
                total += getValue(y);
            }
            return { value: total };
        }

        case 'avg': {
            const startYear = Math.max(2020, year - range + 1);
            let total = 0;
            let count = 0;
            for (let y = startYear; y <= year; y++) {
                total += getValue(y);
                count++;
            }
            return { value: count > 0 ? Math.round(total / count) : 0 };
        }

        case 'max': {
            const startYear = Math.max(2020, year - range + 1);
            let maxYear = startYear;
            let maxValue = getValue(startYear);
            for (let y = startYear; y <= year; y++) {
                const val = getValue(y);
                if (val > maxValue) {
                    maxValue = val;
                    maxYear = y;
                }
            }
            return { value: maxValue, label: `${maxYear}` };
        }

        case 'min': {
            const startYear = Math.max(2020, year - range + 1);
            let minYear = startYear;
            let minValue = getValue(startYear);
            for (let y = startYear; y <= year; y++) {
                const val = getValue(y);
                if (val < minValue || minValue === 0) {
                    minValue = val;
                    minYear = y;
                }
            }
            return { value: minValue, label: `${minYear}` };
        }

        default:
            return { value: getValue(year) };
    }
}
