import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Clock, AlertCircle, MapPin, ArrowRight, Loader2, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { fetchTickets } from '../../services/ticketApi';
import { Ticket } from '../../types/ticket';

export const WorkerDashboardPage: React.FC = () => {
  const { token, user } = useAuth();
  const navigate = useNavigate();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  const loadWorkerTasks = async () => {
    if (!token) return;
    setIsLoading(true);
    setError('');

    try {
      const data = await fetchTickets(token);
      setTickets(data);
    } catch (err: any) {
      setError(err.message || 'Unable to load assigned tasks.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadWorkerTasks();
  }, [token]);

  const assignedCount = tickets.filter(t => t.status === 'ASSIGNED' || t.status === 'OPEN').length;
  const inProgressCount = tickets.filter(t => t.status === 'IN_PROGRESS').length;
  const verificationCount = tickets.filter(t => ['PENDING_VERIFICATION', 'HUMAN_REVIEW', 'SUSPICIOUS'].includes(t.status)).length;

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 p-4 sm:p-8 max-w-4xl mx-auto space-y-6">
      
      {/* Officer Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-500">
              Field Officer Operations
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-200 text-slate-700">
              Active Shift
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Assigned Queue: {user?.full_name || 'Field Officer'}
          </h1>
        </div>

        <button
          onClick={loadWorkerTasks}
          className="btn-secondary"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh Queue</span>
        </button>
      </div>

      {/* 3 Shift Metric Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="civic-card p-5 text-center">
          <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 block font-mono">{assignedCount}</span>
          <span className="text-xs text-slate-500 mt-1 block">New Tasks</span>
        </div>

        <div className="civic-card p-5 text-center">
          <span className="text-2xl sm:text-3xl font-extrabold text-amber-700 block font-mono">{inProgressCount}</span>
          <span className="text-xs text-slate-500 mt-1 block">In Progress</span>
        </div>

        <div className="civic-card p-5 text-center">
          <span className="text-2xl sm:text-3xl font-extrabold text-emerald-700 block font-mono">{verificationCount}</span>
          <span className="text-xs text-slate-500 mt-1 block">Under Verification</span>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-md text-rose-700 text-xs font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={loadWorkerTasks} className="text-xs font-bold underline">Retry</button>
        </div>
      )}

      {/* Task List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Work Orders ({tickets.length})
          </h2>
          <span className="text-[11px] text-slate-400 font-mono">Sorted by municipal urgency</span>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-slate-500 civic-card">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-700" />
            <span className="text-xs font-mono">Loading assigned work orders...</span>
          </div>
        ) : tickets.length === 0 ? (
          <div className="p-12 text-center text-slate-500 civic-card space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-1" />
            <div className="font-bold text-slate-900 text-sm">No pending tasks assigned today.</div>
            <div className="text-xs text-slate-500">Check back later for new municipal dispatch orders.</div>
          </div>
        ) : (
          <div className="space-y-3">
            {tickets.map((task) => (
              <div
                key={task.id}
                className="civic-card civic-card-hover p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-slate-900">#{task.ticket_number}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                      task.status === 'IN_PROGRESS'
                        ? 'bg-amber-50 text-amber-800 border border-amber-200'
                        : ['VERIFIED', 'CITIZEN_CONFIRMED', 'CLOSED'].includes(task.status)
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-slate-100 text-slate-800 border border-slate-200'
                    }`}>
                      {task.status.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="font-bold text-slate-900 text-sm sm:text-base truncate">
                    {task.title}
                  </div>

                  <div className="flex items-center gap-4 text-xs text-slate-500 font-mono">
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-400" />
                      <span>{task.ward?.name || 'Central Ward'}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>{new Date(task.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => navigate(`/worker/tasks/${task.id}`)}
                  className="btn-primary shrink-0"
                >
                  <span>Open Task</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkerDashboardPage;
