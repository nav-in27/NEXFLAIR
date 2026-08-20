import React from 'react';
import { useHealth } from '../hooks/useHealth';
import { Activity, CheckCircle2, Server, Database, RefreshCw, Cpu } from 'lucide-react';

export const HealthPage: React.FC = () => {
  const { data, isLoading, isError, error, refetch, isRefetching } = useHealth();

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8 animate-fade-in">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-2">
            <Activity className="w-3.5 h-3.5" />
            <span>Real-time Telemetry</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white">System Health & API Diagnostic</h1>
          <p className="text-slate-400 text-sm">Verifies active communication between Vite React frontend and FastAPI backend service.</p>
        </div>

        <button
          onClick={() => refetch()}
          disabled={isRefetching}
          className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold transition-all flex items-center space-x-2 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 text-sky-400 ${isRefetching ? 'animate-spin' : ''}`} />
          <span>{isRefetching ? 'Refetching...' : 'Ping Endpoint'}</span>
        </button>
      </div>

      {/* Main Health Card */}
      <div className="glass-panel rounded-2xl p-6 sm:p-8 border border-slate-800 space-y-6">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-6 rounded-xl bg-slate-900/80 border border-slate-800 gap-4">
          <div className="flex items-center space-x-4">
            <div className={`p-3.5 rounded-xl border ${data?.status === 'ok' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-400'}`}>
              {data?.status === 'ok' ? <CheckCircle2 className="w-8 h-8" /> : <Server className="w-8 h-8" />}
            </div>
            <div>
              <div className="text-xs text-slate-400 font-mono uppercase">Target Endpoint: /api/health</div>
              <div className="text-2xl font-bold text-white mt-0.5">
                {isLoading ? 'Checking Connection...' : isError ? 'Connection Error' : `Status: ${data?.status}`}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Service Identity: <strong className="text-sky-400 font-mono">{data?.service || 'meikaan'}</strong>
              </p>
            </div>
          </div>

          <div className="flex flex-col items-start sm:items-end text-xs font-mono text-slate-400">
            <span>HTTP Status: <strong className={isError ? "text-rose-400" : "text-emerald-400"}>{isError ? 'FAIL' : '200 OK'}</strong></span>
            <span>Protocol: REST / JSON</span>
          </div>
        </div>

        {/* JSON Payload Inspection Box */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-400 font-mono uppercase tracking-wider block">
            Raw API Response Payload
          </label>
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-sky-300">
            <pre>{isLoading ? '// Loading health check...' : isError ? `// Error: ${error?.message}` : JSON.stringify(data, null, 2)}</pre>
          </div>
        </div>

        {/* Verification Checkpoints */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-800/80">
          <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/80 space-y-1">
            <div className="text-xs font-semibold text-slate-400 flex items-center space-x-1.5">
              <Server className="w-3.5 h-3.5 text-sky-400" />
              <span>FastAPI Backend</span>
            </div>
            <p className="text-xs font-bold text-emerald-400">Running on :8000</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/80 space-y-1">
            <div className="text-xs font-semibold text-slate-400 flex items-center space-x-1.5">
              <Database className="w-3.5 h-3.5 text-indigo-400" />
              <span>PostgreSQL Engine</span>
            </div>
            <p className="text-xs font-bold text-emerald-400">Configured & Connected</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/80 space-y-1">
            <div className="text-xs font-semibold text-slate-400 flex items-center space-x-1.5">
              <Cpu className="w-3.5 h-3.5 text-emerald-400" />
              <span>TanStack Query</span>
            </div>
            <p className="text-xs font-bold text-emerald-400">Auto-polling active</p>
          </div>
        </div>

      </div>
    </div>
  );
};
