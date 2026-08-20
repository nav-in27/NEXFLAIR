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
    <div className="min-h-screen bg-[#fcfcfd] text-slate-900 p-4 sm:p-8 max-w-4xl mx-auto space-y-6">
      {/* Greeting Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider block">Field Officer Portal</span>
          <h1 className="font-serif text-3xl font-extrabold text-slate-900 tracking-tight">
            Good morning, {user?.full_name || 'Officer'}
          </h1>
        </div>

        <button
          onClick={loadWorkerTasks}
          className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-slate-200 shadow-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Today's Work Summary Cards */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Today's Work Summary</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 text-center shadow-xs">
            <span className="text-3xl font-extrabold text-slate-900 block">{assignedCount}</span>
            <span className="text-xs font-semibold text-slate-500 mt-1 block">Assigned</span>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 text-center shadow-xs">
            <span className="text-3xl font-extrabold text-amber-600 block">{inProgressCount}</span>
            <span className="text-xs font-semibold text-slate-500 mt-1 block">In Progress</span>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 text-center shadow-xs">
            <span className="text-3xl font-extrabold text-emerald-600 block">{verificationCount}</span>
            <span className="text-xs font-semibold text-slate-500 mt-1 block">Awaiting Verification</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={loadWorkerTasks} className="text-xs font-bold underline">Retry</button>
        </div>
      )}

      {/* Task List */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">My Assigned Tasks</h2>

        {isLoading ? (
          <div className="p-12 text-center text-slate-500 bg-white rounded-2xl border border-slate-200">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-700" />
            <span className="text-xs font-medium">Loading task queue...</span>
          </div>
        ) : tickets.length === 0 ? (
          <div className="p-12 text-center text-slate-500 bg-white rounded-2xl border border-slate-200 shadow-xs">
            <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
            <div className="font-bold text-slate-900 text-base">No tasks assigned today.</div>
            <div className="text-xs text-slate-500 mt-1">Check back later for new municipal field assignments.</div>
          </div>
        ) : (
          <div className="space-y-3">
            {tickets.map((task) => (
              <div
                key={task.id}
                className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-slate-700">#{task.ticket_number}</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      task.status === 'IN_PROGRESS'
                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                        : ['VERIFIED', 'CITIZEN_CONFIRMED', 'CLOSED'].includes(task.status)
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : 'bg-blue-100 text-blue-800 border border-blue-200'
                    }`}>
                      {task.status.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="font-bold text-slate-900 text-base">{task.title}</div>

                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-700" />
                      <span>{task.ward?.name || 'Central Ward'}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{new Date(task.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => navigate(`/worker/tasks/${task.id}`)}
                  className="w-full sm:w-auto px-5 py-2.5 bg-[#0b1d30] hover:bg-[#162e48] text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 shrink-0 shadow-xs"
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
