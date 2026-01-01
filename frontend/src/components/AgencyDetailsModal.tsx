"use client";

import React from 'react';
import { X, MapPin, Building2, Phone, Globe, ExternalLink } from 'lucide-react';

interface AgencyDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    agency: {
        ori: string;
        name: string;
        type?: string;
        address?: string;
        city?: string;
        zip_code?: string;
        latitude?: number;
        longitude?: number;
        population?: number;
    };
}

const AgencyDetailsModal: React.FC<AgencyDetailsModalProps> = ({ isOpen, onClose, agency }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-4 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-secondary)]">
                    <div className="flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-[var(--accent-primary)]" />
                        <h3 className="font-bold text-[var(--text-primary)]">Agency Details</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-[var(--danger-bg)] rounded-full transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    <div>
                        <h2 className="text-xl font-bold text-[var(--text-primary)] mb-1">{agency.name}</h2>
                        <p className="text-xs font-mono text-[var(--text-muted)]">ORI: {agency.ori}</p>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-start gap-3">
                            <MapPin className="w-5 h-5 text-[var(--text-muted)] shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-medium text-[var(--text-primary)]">Location</p>
                                <p className="text-sm text-[var(--text-muted)]">
                                    {agency.address || 'No address provided'}<br />
                                    {agency.city && `${agency.city}, `}{agency.zip_code}
                                </p>
                            </div>
                        </div>

                        {(agency.latitude !== undefined && agency.longitude !== undefined) && (
                            <div className="p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)]">
                                <p className="text-[10px] uppercase font-bold text-[var(--text-muted)] mb-2">Coordinates</p>
                                <div className="flex justify-between items-center">
                                    <code className="text-xs text-[var(--accent-primary)]">
                                        Lat: {agency.latitude.toFixed(4)}, Lng: {agency.longitude.toFixed(4)}
                                    </code>
                                    <a
                                        href={`https://www.google.com/maps?q=${agency.latitude},${agency.longitude}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-[var(--accent-primary)] hover:underline flex items-center gap-1"
                                    >
                                        Maps <ExternalLink className="w-3 h-3" />
                                    </a>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)]">
                                <p className="text-[10px] uppercase font-bold text-[var(--text-muted)] mb-1">Type</p>
                                <p className="text-sm font-medium text-[var(--text-primary)]">{agency.type || 'Unknown'}</p>
                            </div>
                            <div className="p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)]">
                                <p className="text-[10px] uppercase font-bold text-[var(--text-muted)] mb-1">Population</p>
                                <p className="text-sm font-medium text-[var(--text-primary)]">{agency.population?.toLocaleString() || '0'}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-[var(--bg-secondary)]/50 border-t border-[var(--border-color)] text-center">
                    <button
                        onClick={onClose}
                        className="w-full py-2 bg-[var(--bg-primary)] hover:bg-[var(--border-color)] text-[var(--text-primary)] rounded-lg transition-colors border border-[var(--border-color)] font-medium text-sm"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AgencyDetailsModal;
