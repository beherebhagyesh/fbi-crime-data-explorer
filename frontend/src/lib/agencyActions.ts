/**
 * Agency data fetching actions with toast notifications.
 * Connects frontend to the crime data pipeline.
 */

import { pipelineToast, toast } from '@/components/ToastProvider';
import { VIOLENT_OFFENSES, PROPERTY_OFFENSES, OTHER_OFFENSES } from '@/lib/offenseConfig';
import { logConsole } from '@/lib/logger';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:49080';

export interface FetchResult {
    success: boolean;
    message: string;
    data?: any;
    cached?: boolean;
    recordCount?: number;
}

export type ProgressCallback = (count: number, offenseLabel: string) => void;

/**
 * Fetch crime data for a specific agency (ORI) from FBI API.
 * Shows toast notifications for each pipeline step.
 */
export async function fetchAgencyCrimeData(
    ori: string,
    agencyName: string,
    options: { years?: number[]; offenses?: string[]; forceRefresh?: boolean } = {},
    onProgress?: ProgressCallback,
    signal?: AbortSignal
): Promise<FetchResult> {
    const toastId = pipelineToast.fetching(`Fetching data for ${agencyName}...`);
    logConsole.info(`Initiating data check for ${agencyName} (${ori})`);

    try {
        // Step 1: Check cache (skip if forceRefresh)
        if (!options.forceRefresh) {
            pipelineToast.cacheCheck(toastId);
            await sleep(300); // Brief pause for UX

            // Step 2: Call API to fetch/check data
            logConsole.api(`GET /api/crimes/agency/${ori}`);
            const response = await fetch(`${API_URL}/api/crimes/agency/${ori}`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
            });

            if (response.ok) {
                const data = await response.json();
                if (data && data.length > 0) {
                    pipelineToast.cacheHit(toastId);
                    await sleep(500);
                    pipelineToast.complete(toastId, `Found ${data.length} cached records`);
                    return {
                        success: true,
                        message: 'Data retrieved from cache',
                        data,
                        cached: true,
                        recordCount: data.length,
                    };
                }
            }
        }

        // No cache or forceRefresh - trigger fresh fetch
        pipelineToast.cacheMiss(toastId);
        return await triggerAgencyFetch(ori, agencyName, toastId, options, onProgress, signal);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        pipelineToast.error(toastId, `Failed: ${message}`);
        return {
            success: false,
            message,
        };
    }
}

/**
 * Trigger a fresh fetch from FBI API for an agency.
 * Now splits requests into batches to provide detailed feedback.
 */
async function triggerAgencyFetch(
    ori: string,
    agencyName: string,
    toastId: string,
    options: { years?: number[]; offenses?: string[] },
    onProgress?: ProgressCallback,
    signal?: AbortSignal
): Promise<FetchResult> {
    // Prepare granular list of offenses to fetch one by one
    // This provides faster feedback to the user
    const allOffenses = [
        ...VIOLENT_OFFENSES,
        ...PROPERTY_OFFENSES,
        ...OTHER_OFFENSES
    ];

    let totalRecords = 0;
    let allData: any[] = [];
    let errorCount = 0;

    try {
        for (const offenseConfig of allOffenses) {
            // Check for cancellation manually since fetch signal might optimize network but we want logic break
            if (signal?.aborted) {
                logConsole.warning(`Fetch cancelled for ${agencyName}`);
                showToast('info', 'Fetch cancelled by user');
                break;
            }

            // Stop if error occurred too many times
            if (errorCount > 3) {
                showToast('error', 'Too many errors. Stopping fetch.');
                break;
            }

            const batchName = offenseConfig.label;
            const offenseCode = offenseConfig.code;

            // Update main toast to show current progress
            toast.loading(`Fetching ${batchName}...`, { id: toastId });

            // specific offense for this request
            logConsole.api(`FETCH: ${batchName} (${offenseCode})`, { offenses: [offenseCode] });

            try {
                const response = await fetch(`${API_URL}/api/crimes/fetch/${ori}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        years: options.years || [2020, 2021, 2022, 2023, 2024],
                        offenses: [offenseCode],
                    }),
                    signal, // cancel request if signal aborted
                });

                if (!response.ok) {
                    const errText = await response.text();
                    throw new Error(`${response.status} ${errText}`);
                }

                const result = await response.json();

                if (result.recordCount > 0) {
                    logConsole.success(`GOT DATA: ${batchName}`, { count: result.recordCount });
                    const count = result.recordCount || 0;
                    totalRecords += count;
                    if (result.data) allData.push(...result.data);
                    showToast('success', `Received ${count} records for ${batchName}`);

                    if (onProgress) onProgress(count, batchName);
                } else {
                    logConsole.info(`No records for ${batchName}`);
                }
            } catch (err: any) {
                if (err.name === 'AbortError') throw err; // propagate abort

                logConsole.error(`Failed to fetch ${batchName}: ${err.message}`);
                errorCount++;
                toast.error(`Failed to fetch ${batchName}`, { icon: '⚠️', duration: 2000 });
            }

            await sleep(100);
        }

        // Step 4: Final success
        if (totalRecords > 0) {
            pipelineToast.saving(toastId);
            await sleep(500);

            pipelineToast.complete(toastId, `Enrichment Complete! \nCaught ${totalRecords} crime stats.`);
        } else {
            pipelineToast.complete(toastId, 'No crime data found for this agency.');
        }

        return {
            success: true,
            message: 'Data fetched successfully',
            data: allData,
            cached: false,
            recordCount: totalRecords,
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Fetch failed';
        pipelineToast.error(toastId, message);
        return {
            success: false,
            message,
        };
    }
}

/**
 * Queue a batch fetch job for multiple agencies.
 */
export async function queueBatchFetch(
    countyId: string,
    countyName: string
): Promise<FetchResult> {
    const toastId = pipelineToast.fetching(`Queuing batch fetch for ${countyName}...`);

    try {
        const response = await fetch(`${API_URL}/api/jobs/queue`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                job_type: 'county_fetch',
                county_id: countyId,
            }),
        });

        if (!response.ok) {
            throw new Error(`Queue failed: ${response.status}`);
        }

        const result = await response.json();

        pipelineToast.queued(result.jobId || 'batch');
        pipelineToast.complete(toastId, `Job queued for ${countyName}`);

        return {
            success: true,
            message: `Job queued: ${result.jobId}`,
            data: result,
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Queue failed';
        pipelineToast.error(toastId, message);
        return {
            success: false,
            message,
        };
    }
}

/**
 * Simple toast for UI actions.
 */
export function showToast(
    type: 'success' | 'error' | 'info' | 'warning',
    message: string
) {
    switch (type) {
        case 'success':
            toast.success(message);
            logConsole.success(message);
            break;
        case 'error':
            toast.error(message);
            logConsole.error(message);
            break;
        case 'warning':
            pipelineToast.warning(message);
            logConsole.warning(message);
            break;
        default:
            pipelineToast.info(message);
            logConsole.info(message);
    }
}

// Helper
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
