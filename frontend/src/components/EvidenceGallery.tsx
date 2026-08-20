import React, { useState, useEffect } from 'react';
import { EvidenceItem } from '../types/evidence';
import { fetchTicketEvidenceApi } from '../services/evidenceApi';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, Hash, Calendar, Camera, Upload, AlertCircle, RefreshCw, FileCheck } from 'lucide-react';

interface Props {
  ticketId: string;
  onRefreshTrigger?: number;
}

export const EvidenceGallery: React.FC<Props> = ({ ticketId, onRefreshTrigger }) => {
  const { token } = useAuth();
  const [evidences, setEvidences] = useState<EvidenceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadEvidence = async () => {
    if (!token) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await fetchTicketEvidenceApi(ticketId, token);
      setEvidences(data);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('Failed to load evidence items.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadEvidence();
  }, [ticketId, token, onRefreshTrigger]);

  if (isLoading) {
    return (
      <div className="p-6 text-center bg-slate-950/60 rounded-2xl border border-slate-800">
        <RefreshCw className="w-5 h-5 text-sky-400 animate-spin mx-auto mb-2" />
        <p className="text-xs font-mono text-slate-400">Loading evidence gallery...</p>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2">
        <AlertCircle className="w-4 h-4 flex-shrink-0" />
        <span>{errorMsg}</span>
      </div>
    );
  }

  if (evidences.length === 0) {
    return (
      <div className="p-6 text-center bg-slate-950/40 rounded-2xl border border-slate-800 space-y-1">
        <FileCheck className="w-6 h-6 text-slate-600 mx-auto" />
        <h4 className="text-xs font-semibold text-slate-300">No Evidence Submitted Yet</h4>
        <p className="text-[11px] text-slate-500">Upload BEFORE/AFTER evidence to trigger verification pipeline.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-white flex items-center space-x-1.5">
          <ShieldCheck className="w-4 h-4 text-sky-400" />
          <span>Evidence Items ({evidences.length})</span>
        </h4>
        <button
          onClick={loadEvidence}
          className="text-[11px] font-mono text-sky-400 hover:underline flex items-center space-x-1"
        >
          <RefreshCw className="w-3 h-3" />
          <span>Refresh</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {evidences.map((item) => (
          <div
            key={item.id}
            className="glass-panel rounded-2xl p-4 border border-slate-800 space-y-3 relative group"
          >
            {/* Type Header Tag */}
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-0.5 rounded text-[10px] font-bold font-mono bg-sky-500/10 text-sky-300 border border-sky-500/30">
                {item.evidence_type}
              </span>

              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono flex items-center space-x-1 border ${
                  item.source_type === 'LIVE_CAMERA'
                    ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                    : 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30'
                }`}
              >
                {item.source_type === 'LIVE_CAMERA' ? (
                  <>
                    <Camera className="w-3 h-3" />
                    <span>LIVE CAMERA</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-3 h-3" />
                    <span>FILE UPLOAD</span>
                  </>
                )}
              </span>
            </div>

            {/* Image Preview Thumbnail */}
            <div className="aspect-video w-full rounded-xl overflow-hidden bg-slate-950 border border-slate-900 relative">
              <img
                src={`/${item.file_path}`}
                alt={item.evidence_type}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                onError={(e) => {
                  // Fallback for demo preview
                  (e.target as HTMLImageElement).src =
                    'https://images.unsplash.com/photo-1541888946425-d0fbb186a5b3?w=600&auto=format&fit=crop&q=60';
                }}
              />
            </div>

            {/* Metadata Specs */}
            <div className="space-y-1.5 text-[11px] font-mono">
              <div className="flex items-center justify-between text-slate-400">
                <span className="flex items-center space-x-1 text-slate-300">
                  <Hash className="w-3 h-3 text-sky-400" />
                  <span>SHA-256:</span>
                </span>
                <span className="text-[10px] text-sky-300 font-bold truncate max-w-[140px]" title={item.sha256_hash}>
                  {item.sha256_hash.substring(0, 16)}...
                </span>
              </div>

              {item.captured_at && (
                <div className="flex items-center justify-between text-slate-400">
                  <span className="flex items-center space-x-1 text-slate-300">
                    <Calendar className="w-3 h-3 text-slate-500" />
                    <span>Captured:</span>
                  </span>
                  <span className="text-[10px] text-slate-300">
                    {new Date(item.captured_at).toLocaleString()}
                  </span>
                </div>
              )}

              {item.width && item.height && (
                <div className="flex items-center justify-between text-slate-500 text-[10px]">
                  <span>Dimensions: {item.width} x {item.height} px</span>
                  <span>{item.file_size_bytes ? (item.file_size_bytes / 1024).toFixed(1) : 0} KB</span>
                </div>
              )}
            </div>

          </div>
        ))}
      </div>
    </div>
  );
};
