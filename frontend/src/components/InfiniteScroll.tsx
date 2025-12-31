'use client';

import { useEffect, useRef, useCallback, ReactNode } from 'react';

interface InfiniteScrollProps {
    children: ReactNode;
    onLoadMore: () => Promise<void>;
    hasMore: boolean;
    isLoading: boolean;
    threshold?: number; // pixels from bottom to trigger load
    loadingComponent?: ReactNode;
    endComponent?: ReactNode;
}

export default function InfiniteScroll({
    children,
    onLoadMore,
    hasMore,
    isLoading,
    threshold = 200,
    loadingComponent,
    endComponent,
}: InfiniteScrollProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const loadingRef = useRef(false);

    const handleScroll = useCallback(async () => {
        if (!containerRef.current || loadingRef.current || !hasMore || isLoading) {
            return;
        }

        const container = containerRef.current;
        const scrollBottom = container.scrollHeight - container.scrollTop - container.clientHeight;

        if (scrollBottom < threshold) {
            loadingRef.current = true;
            try {
                await onLoadMore();
            } finally {
                loadingRef.current = false;
            }
        }
    }, [hasMore, isLoading, onLoadMore, threshold]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        container.addEventListener('scroll', handleScroll);
        return () => container.removeEventListener('scroll', handleScroll);
    }, [handleScroll]);

    // Initial load check (if content doesn't fill container)
    useEffect(() => {
        if (hasMore && !isLoading) {
            const container = containerRef.current;
            if (container && container.scrollHeight <= container.clientHeight) {
                handleScroll();
            }
        }
    }, [hasMore, isLoading, handleScroll]);

    return (
        <div
            ref={containerRef}
            className="overflow-y-auto"
            style={{ height: '100%' }}
        >
            {children}

            {/* Loading indicator */}
            {isLoading && (
                loadingComponent || (
                    <div className="flex items-center justify-center py-8">
                        <div className="flex items-center gap-3">
                            <div className="w-6 h-6 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
                            <span className="text-[var(--text-muted)]">Loading more...</span>
                        </div>
                    </div>
                )
            )}

            {/* End of list */}
            {!hasMore && !isLoading && (
                endComponent || (
                    <div className="text-center py-6 text-[var(--text-muted)] text-sm">
                        ✓ All items loaded
                    </div>
                )
            )}
        </div>
    );
}

// Simpler hook-based version for use in existing components
export function useInfiniteScroll(
    onLoadMore: () => Promise<void>,
    hasMore: boolean,
    isLoading: boolean,
    threshold: number = 200
) {
    const containerRef = useRef<HTMLDivElement>(null);
    const loadingRef = useRef(false);

    const checkScroll = useCallback(async () => {
        if (!containerRef.current || loadingRef.current || !hasMore || isLoading) {
            return;
        }

        const container = containerRef.current;
        const scrollBottom = container.scrollHeight - container.scrollTop - container.clientHeight;

        if (scrollBottom < threshold) {
            loadingRef.current = true;
            try {
                await onLoadMore();
            } finally {
                loadingRef.current = false;
            }
        }
    }, [hasMore, isLoading, onLoadMore, threshold]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleScroll = () => checkScroll();
        container.addEventListener('scroll', handleScroll);

        // Check immediately
        checkScroll();

        return () => container.removeEventListener('scroll', handleScroll);
    }, [checkScroll]);

    return containerRef;
}
