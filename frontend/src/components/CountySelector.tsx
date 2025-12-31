'use client';

import { CountySummary } from '@/lib/api';

interface CountySelectorProps {
    counties: CountySummary[];
    selectedCounty: string;
    onSelect: (countyId: string) => void;
    disabled?: boolean;
}

export function CountySelector({
    counties,
    selectedCounty,
    onSelect,
    disabled,
}: CountySelectorProps) {
    return (
        <div>
            <label className="block text-sm font-medium mb-2">County</label>
            <select
                value={selectedCounty}
                onChange={(e) => onSelect(e.target.value)}
                disabled={disabled}
                className="w-full p-2 rounded-lg border dark:bg-slate-700 dark:border-slate-600 disabled:opacity-50"
            >
                <option value="">Select a county...</option>
                {counties.map((county) => (
                    <option key={county.county_id} value={county.county_id}>
                        {county.county_name} ({county.agency_count} agencies)
                    </option>
                ))}
            </select>
        </div>
    );
}
