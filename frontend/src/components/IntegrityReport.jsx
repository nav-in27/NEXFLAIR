import React, { useState } from 'react';
import { 
  ShieldCheck, AlertOctagon, CheckCircle2, Copy, ExternalLink, 
  Eye, FileText, Cpu, Clock, Camera, Edit3, Award, Hash, MapPin
} from 'lucide-react';

export default function IntegrityReport({ report, onOpenCertificate, onBackToUpload }) {
  const [copiedHash, setCopiedHash] = useState(false);
  const [showElaView, setShowElaView] = useState(false);

  if (!report) return null;

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'VERIFIED':
        return (
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold text-sm">
            <CheckCircle2 className="w-4 h-4" />
            <span>AUTHENTIC & UNALTERED</span>
          </div>
        );
      case 'SUSPECT':
        return (
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold text-sm">
            <AlertOctagon className="w-4 h-4" />
            <span>SUSPICIOUS ANOMALIES DETECTED</span>
          </div>
        );
      default:
        return (
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 font-bold text-sm">
            <AlertOctagon className="w-4 h-4" />
            <span>TAMPERED EVIDENCE</span>
          </div>
        );
    }
  };

  const getScoreColor = (score) => {
    if (score >= 85) return 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10';
    if (score >= 60) return 'text-amber-400 border-amber-500/40 bg-amber-500/10';
    return 'text-rose-400 border-rose-500/40 bg-rose-500/10';
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8 animate-fade-in">
      
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button 
            onClick={onBackToUpload}
            className="text-xs font-semibold text-sky-400 hover:underline flex items-center space-x-1 mb-1"
          >
            ← Upload another file
          </button>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">Forensic Integrity Audit Report</h2>
          <p className="text-xs text-slate-400 font-mono mt-0.5">Record ID: {report.id}</p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => onOpenCertificate(report)}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-sky-500/20 transition-all flex items-center space-x-2"
          >
            <Award className="w-4 h-4" />
            <span>View Integrity Certificate</span>
          </button>
        </div>
      </div>

      {/* Overview Metric Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Integrity Status Card */}
        <div className="glass-panel rounded-2xl p-6 border border-slate-800 flex flex-col justify-between">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Integrity Classification</div>
          <div className="my-4">
            {getStatusBadge(report.integrity_status)}
          </div>
          <p className="text-xs text-slate-400">
            {report.is_tampered 
              ? "Potential digital modifications or missing metadata tags flagged." 
              : "Cryptographic hash verified and no edit artifacts detected."}
          </p>
        </div>

        {/* Holistic Score Gauge Card */}
        <div className="glass-panel rounded-2xl p-6 border border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Forensic Trust Score</div>
            <div className="text-4xl font-extrabold text-white mt-2">
              {report.integrity_score.toFixed(1)} <span className="text-xl text-slate-400 font-normal">/ 100</span>
            </div>
            <p className="text-xs text-slate-400 mt-2">Calculated from ELA noise & EXIF tags</p>
          </div>
          <div className={`w-20 h-20 rounded-full border-4 flex items-center justify-center font-bold text-xl ${getScoreColor(report.integrity_score)}`}>
            {Math.round(report.integrity_score)}%
          </div>
        </div>

        {/* Ledger Block Index Card */}
        <div className="glass-panel rounded-2xl p-6 border border-slate-800 flex flex-col justify-between">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Audit Chain Block</div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-3xl font-extrabold text-white font-mono">#{report.block_index}</span>
              <span className="text-xs px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 font-mono">Immutable</span>
            </div>
            <p className="text-xs text-slate-400 font-mono truncate mt-2">Prev: {report.previous_block_hash.slice(0, 16)}...</p>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">Timestamp: {new Date(report.created_at).toLocaleString()}</p>
        </div>

      </div>

      {/* Computer Vision & Error Level Analysis (ELA) Visualizer */}
      {report.ela_result_image_url && (
        <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                <Cpu className="w-5 h-5 text-sky-400" />
                <span>Error Level Analysis (ELA) Forensic Heatmap</span>
              </h3>
              <p className="text-xs text-slate-400">
                Highlights JPEG compression artifacts. Uniform noise indicates an unaltered image; high-contrast white bright spots highlight edited or spliced pixels.
              </p>
            </div>

            <button
              onClick={() => setShowElaView(!showElaView)}
              className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-all flex items-center space-x-2"
            >
              <Eye className="w-4 h-4 text-sky-400" />
              <span>{showElaView ? "Show Original Image" : "Show ELA Heatmap View"}</span>
            </button>
          </div>

          <div className="relative rounded-xl overflow-hidden bg-slate-950 max-h-96 flex items-center justify-center p-4 border border-slate-800">
            <img
              src={showElaView ? report.ela_result_image_url : `/uploads/${report.id}_${report.filename}`}
              alt="Evidence visualization"
              className="max-h-80 object-contain rounded-lg shadow-xl"
              onError={(e) => {
                // Fallback image handling
                e.target.style.display = 'none';
              }}
            />
            <div className="absolute top-4 left-4 px-3 py-1 rounded-md bg-slate-900/90 text-xs font-mono text-slate-300 border border-slate-700">
              {showElaView ? "🔬 ELA Re-compression Heatmap" : "📷 Original Evidence Upload"}
            </div>
          </div>

          {report.ela_mean_error !== null && (
            <div className="flex items-center justify-between text-xs text-slate-400 font-mono bg-slate-900/50 p-3 rounded-xl border border-slate-800">
              <span>Mean Error Level Variance: <strong className="text-white">{report.ela_mean_error}</strong></span>
              <span>Tolerance Threshold: &lt; 15.0</span>
            </div>
          )}
        </div>
      )}

      {/* Cryptographic Hashes & Merkle Root Section */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
        <h3 className="text-lg font-bold text-white flex items-center space-x-2 border-b border-slate-800 pb-3">
          <Hash className="w-5 h-5 text-indigo-400" />
          <span>Cryptographic Proof Hashes</span>
        </h3>

        <div className="space-y-3 font-mono text-xs">
          <div>
            <span className="text-slate-400 block mb-1">SHA-256 Payload Digest</span>
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-sky-300 flex items-center justify-between break-all">
              <span>{report.sha256_hash}</span>
              <button
                onClick={() => copyToClipboard(report.sha256_hash)}
                className="ml-2 p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex-shrink-0"
                title="Copy SHA-256 Hash"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div>
            <span className="text-slate-400 block mb-1">Merkle Tree Root Hash</span>
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-indigo-300 break-all">
              {report.merkle_root}
            </div>
          </div>
        </div>

        {copiedHash && (
          <p className="text-xs text-emerald-400 font-semibold animate-pulse">SHA-256 Hash copied to clipboard!</p>
        )}
      </div>

      {/* EXIF Metadata & Device Info Grid */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
        <h3 className="text-lg font-bold text-white flex items-center space-x-2 border-b border-slate-800 pb-3">
          <Camera className="w-5 h-5 text-emerald-400" />
          <span>EXIF Forensic Metadata Inspection</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
            <div className="text-slate-400 text-xs font-medium flex items-center space-x-1.5">
              <Clock className="w-3.5 h-3.5 text-sky-400" />
              <span>Capture Timestamp</span>
            </div>
            <p className="text-sm font-bold text-white">{report.capture_date || "Not Available in EXIF"}</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
            <div className="text-slate-400 text-xs font-medium flex items-center space-x-1.5">
              <Camera className="w-3.5 h-3.5 text-indigo-400" />
              <span>Device Model</span>
            </div>
            <p className="text-sm font-bold text-white">{report.device_model || "Generic / Unspecified"}</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
            <div className="text-slate-400 text-xs font-medium flex items-center space-x-1.5">
              <Edit3 className="w-3.5 h-3.5 text-rose-400" />
              <span>Editing Software Footprint</span>
            </div>
            <p className={`text-sm font-bold ${report.editing_software ? "text-rose-400" : "text-emerald-400"}`}>
              {report.editing_software || "None Detected (Native)"}
            </p>
          </div>

        </div>
      </div>

    </div>
  );
}
