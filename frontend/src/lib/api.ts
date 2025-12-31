/**
 * API client for backend communication.
 */
import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:49080';

export const api = axios.create({
    baseURL: `${API_BASE}/api`,
    timeout: 30000,
});

// Types
export interface CountySummary {
    county_id: string;
    county_name: string;
    state_abbr: string;
    agency_count: number;
}

export interface CrimeStat {
    offense: string;
    year: number;
    total_count: number | null;
    agencies_reporting: number;
    agencies_total: number;
    reporting_pct: number;
    is_complete: boolean;
}

export interface TrendData {
    offense: string;
    counts: Record<number, number | null>;
    trend: 'increasing' | 'decreasing' | 'stable' | 'unknown';
    cagr: number | null;
    yoy_changes: (number | null)[];
    volatility: 'high' | 'medium' | 'low' | 'unknown';
    predicted_2025: number | null;
    is_anomaly: boolean;
}

export interface ProxyStatus {
    enabled: boolean;
    in_fallback: boolean;
    consecutive_failures: number;
}

// API functions
export async function getCounties(state?: string): Promise<CountySummary[]> {
    const params = state ? { state } : {};
    const { data } = await api.get('/counties', { params });
    return data;
}

export async function getCountyDetail(countyId: string) {
    const { data } = await api.get(`/counties/${countyId}`);
    return data;
}

export async function getCountyTrends(countyId: string): Promise<{ trends: TrendData[] }> {
    const { data } = await api.get(`/analytics/trends/${countyId}`);
    return data;
}

export async function getTopRisers(offense: string, limit = 10) {
    const { data } = await api.get('/analytics/top-risers', { params: { offense, limit } });
    return data;
}

export async function getTopFallers(offense: string, limit = 10) {
    const { data } = await api.get('/analytics/top-fallers', { params: { offense, limit } });
    return data;
}

export async function getSystemHealth() {
    const { data } = await api.get('/system/health');
    return data;
}

export async function getJobStats() {
    const { data } = await api.get('/system/jobs/stats');
    return data;
}

export async function getProxyStatus(): Promise<ProxyStatus> {
    const { data } = await api.get('/proxy/status');
    return data;
}

export async function toggleProxy(): Promise<{ proxy_enabled: boolean }> {
    const { data } = await api.post('/proxy/toggle');
    return data;
}

export async function getOffenses() {
    const { data } = await api.get('/crimes/offenses');
    return data;
}

export async function getCrimeAggregate(offense: string, year: number, state?: string) {
    const params = { offense, year, ...(state ? { state } : {}) };
    const { data } = await api.get('/crimes/aggregate', { params });
    return data;
}
