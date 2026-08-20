import React, { useState, useEffect } from 'react';
import { Database, Search, ShieldCheck, CheckCircle2, AlertOctagon, RefreshCw, Lock, Link, FileText } from 'lucide-react';

export default function AuditLedger({ onSelectReport }) {
  const [ledgerData, setLedgerData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [verifyResult, setVerifyResult] = useState(null);
  const [verifying, setVerifying] = useState(false);

  const fetchLedger = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/audit/ledger');
      if (res.ok) {
        const data = await res.json();
        setLedgerData(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLedger();
  }, []);

  const handleVerifyHash = async (hashOrId) => {
    setVerifying(true);
    setVerifyResult(null);
    try {
      const res = await fetch('/api/v1/evidence/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sha256_hash: hashOrId }),
      });
      if (res.ok) {
        const data = await res.json();
        setVerifyResult(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setVerifying(false);
    }
  };

  const filteredBlocks = ledgerData?.blocks?.filter(block => 
    block.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    block.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
    block.sha256_hash.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-2">
            <Lock className="w-3.5 h-3.5" />
            <span>Immutable Audit Chain</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white">Civic Evidence Ledger</h1>
          <p className="text-slate-400 text-sm">Transparent cryptographic proof registry of all audited evidence files.</p>
        </div>

        <button
          onClick={fetchLedger}
          className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-bold transition-all flex items-center space-x-2"
        >
          <RefreshCw className={`w-4 h-4 text-sky-400 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Ledger</span>
        </button>
      </div>

      {/* Chain Status Bar */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="p-3.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-base font-bold text-white">Merkle Audit Chain Status:</h3>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold">
                {ledgerData?.is_chain_valid ? "VALID & UNBROKEN" : "INTEGRITY WARNING"}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Total Recorded Evidence Blocks: <strong className="text-white font-mono">{ledgerData?.total_records || 0}</strong>
            </p>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search hash, ID, or filename..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono"
          />
        </div>
      </div>

      {/* Verification Query Result Banner */}
      {verifyResult && (
        <div className={`p-4 rounded-xl border flex items-center justify-between text-xs ${
          verifyResult.is_authentic 
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
            : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
        }`}>
          <div className="flex items-center space-x-3">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <div>
              <span className="font-bold uppercase">{verifyResult.status}: </span>
              <span>{verifyResult.message}</span>
            </div>
          </div>
          {verifyResult.record && (
            <button
              onClick={() => onSelectReport(verifyResult.record)}
              className="px-3 py-1 rounded bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs border border-slate-700"
            >
              View Full Report
            </button>
          )}
        </div>
      )}

      {/* Ledger Table */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/90 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">Block #</th>
                <th className="px-6 py-4">Evidence File</th>
                <th className="px-6 py-4">SHA-256 Hash</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Score</th>
                <th className="px-6 py-4">Timestamp</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800/60 font-mono">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-500">
                    Loading evidence audit blocks...
                  </td>
                </tr>
              ) : filteredBlocks.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-500 font-sans">
                    No evidence records found in the audit ledger.
                  </td>
                </tr>
              ) : (
                filteredBlocks.map((block) => (
                  <tr key={block.id} className="hover:bg-slate-900/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-sky-400">#{block.block_index}</td>
                    <td className="px-6 py-4 font-sans font-semibold text-white max-w-xs truncate">{block.filename}</td>
                    <td className="px-6 py-4 text-slate-400 font-mono text-[11px]">
                      {block.sha256_hash.slice(0, 16)}...{block.sha256_hash.slice(-8)}
                    </td>
                    <td className="px-6 py-4 font-sans">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        block.integrity_status === 'VERIFIED'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}>
                        {block.integrity_status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-white font-bold">{block.integrity_score.toFixed(1)}</td>
                    <td className="px-6 py-4 text-slate-400 text-[11px]">
                      {new Date(block.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-6 py-4 text-right font-sans">
                      <button
                        onClick={() => handleVerifyHash(block.sha256_hash)}
                        className="px-3 py-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 text-xs font-semibold transition-all"
                      >
                        Verify Block
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
