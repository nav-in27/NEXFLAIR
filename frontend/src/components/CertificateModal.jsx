import React from 'react';
import { ShieldCheck, X, Printer, CheckCircle2, Award, Lock, FileText } from 'lucide-react';

export default function CertificateModal({ report, onClose }) {
  if (!report) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-3xl glass-panel rounded-3xl border border-slate-700/80 overflow-hidden shadow-2xl bg-slate-900 text-slate-100">
        
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center space-x-2 text-xs font-semibold text-sky-400">
            <Award className="w-4 h-4" />
            <span>AUTHENTICATED CIVIC EVIDENCE CERTIFICATE</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-white font-bold text-xs flex items-center space-x-1.5 transition-all shadow-md shadow-sky-500/20"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save PDF</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Certificate Content Body */}
        <div className="p-8 sm:p-10 space-y-6 text-center print:p-0 print:text-black">
          
          {/* Certificate Header Banner */}
          <div className="space-y-3">
            <div className="inline-flex p-3 rounded-2xl bg-sky-500/10 border border-sky-500/30 text-sky-400">
              <ShieldCheck className="w-12 h-12" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight uppercase">
              Certificate of Evidence Integrity
            </h1>
            <p className="text-xs text-sky-400 font-mono tracking-widest uppercase">
              MEIKAAN Civic Evidence Verification Protocol
            </p>
          </div>

          <div className="h-px w-full bg-gradient-to-r from-transparent via-slate-700 to-transparent"></div>

          {/* Certificate Assertion Text */}
          <div className="max-w-xl mx-auto space-y-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
            <p>
              This official document certifies that the civic evidence payload titled 
              <strong className="text-white font-semibold"> "{report.filename}"</strong> has been processed through cryptographic hashing and Error Level Analysis.
            </p>
          </div>

          {/* Key Certificate Metrics Box */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/80 p-4 rounded-2xl border border-slate-800 text-left font-mono text-xs">
            <div>
              <span className="text-slate-500 text-[10px] block uppercase">Record ID</span>
              <span className="text-white font-bold text-xs truncate block">{report.id.slice(0, 12)}...</span>
            </div>

            <div>
              <span className="text-slate-500 text-[10px] block uppercase">Status</span>
              <span className={`font-bold text-xs ${report.integrity_status === 'VERIFIED' ? 'text-emerald-400' : 'text-rose-400'}`}>
                {report.integrity_status}
              </span>
            </div>

            <div>
              <span className="text-slate-500 text-[10px] block uppercase">Trust Score</span>
              <span className="text-sky-400 font-bold text-xs">{report.integrity_score.toFixed(1)} / 100</span>
            </div>

            <div>
              <span className="text-slate-500 text-[10px] block uppercase">Block Index</span>
              <span className="text-indigo-400 font-bold text-xs">#{report.block_index}</span>
            </div>
          </div>

          {/* Cryptographic Hashes Box */}
          <div className="bg-slate-950/90 p-4 rounded-2xl border border-slate-800 text-left font-mono text-xs space-y-2">
            <div>
              <span className="text-slate-500 text-[10px] block uppercase">SHA-256 Payload Hash</span>
              <span className="text-sky-300 break-all text-[11px]">{report.sha256_hash}</span>
            </div>
            <div>
              <span className="text-slate-500 text-[10px] block uppercase">Merkle Tree Root Hash</span>
              <span className="text-indigo-300 break-all text-[11px]">{report.merkle_root}</span>
            </div>
          </div>

          {/* Footer Seals */}
          <div className="pt-4 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-800">
            <div className="flex items-center space-x-1">
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              <span>Immutable Chain Proof Verified</span>
            </div>
            <div>Issued: {new Date(report.created_at).toLocaleDateString()}</div>
          </div>

        </div>

      </div>
    </div>
  );
}
