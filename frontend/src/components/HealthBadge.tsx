import React from 'react';
import { useHealth } from '../hooks/useHealth';
import { Activity, AlertTriangle } from 'lucide-react';

export const HealthBadge: React.FC = () => {
  const { data, isLoading, isError, error } = useHealth();

  if (isLoading) {
    return (
      <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-slate-800 text-slate-400 text-xs font-mono border border-slate-700 animate-pulse">
        <Activity className="w-3.5 h-3.5 animate-spin" />
        <span>Checking API...</span>
      </div>
    );
  }

  if (isError || !data || data.status !== 'ok') {
    return (
      <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-rose-500/10 text-rose-400 text-xs font-mono border border-rose-500/30">
        <AlertTriangle className="w-3.5 h-3.5" />
        <span>Backend Disconnected ({error?.message || 'Error'})</span>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-mono border border-emerald-500/30">
      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
      <span className="font-semibold uppercase">{data.service}: {data.status}</span>
    </div>
  );
};
