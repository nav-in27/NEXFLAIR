import React, { useState, useEffect } from 'react';
import { Ticket } from '../types/ticket';
import { fetchTickets } from '../services/ticketApi';
import { useAuth } from '../context/AuthContext';
import { TicketTable } from '../components/TicketTable';
import { TicketDetailsModal } from '../components/TicketDetailsModal';
import { CreateTicketModal } from '../components/CreateTicketModal';
import { FileText, Plus, Search, Filter, RefreshCw, AlertCircle } from 'lucide-react';

export const TicketListPage: React.FC = () => {
  const { token, user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const loadTickets = async () => {
    if (!token) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await fetchTickets(token);
      setTickets(data);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('Failed to load tickets.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, [token]);

  const filteredTickets = tickets.filter((t) => {
    const matchesSearch = 
      t.ticket_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.complaint_type.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const sampleWardId = tickets.length > 0 ? tickets[0].ward_id : 'ward-101-uuid';

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 animate-fade-in">
      
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 glass-panel p-6 rounded-2xl border border-slate-800">
        <div className="space-y-1">
          <div className="inline-flex items-center space-x-2 text-sky-400 text-xs font-mono font-semibold">
            <FileText className="w-4 h-4" />
            <span>Municipal Grievance Workflow</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Civic Evidence Tickets</h1>
          <p className="text-xs text-slate-400">
            {user?.role === 'FIELD_WORKER' 
              ? 'Showing assigned tickets for field evidence collection.' 
              : 'Complete civic evidence ticket pipeline.'}
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={loadTickets}
            className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition-colors"
            title="Refresh Tickets"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          {user?.role === 'ADMIN' && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-sky-500/20 transition-all flex items-center space-x-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Log Ticket</span>
            </button>
          )}
        </div>
      </div>

      {/* Filters & Search */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        {/* Search */}
        <div className="sm:col-span-2 relative">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
          <input
            type="text"
            placeholder="Search by ticket ref, title, or complaint type..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 font-mono"
          />
        </div>

        {/* Status Filter */}
        <div className="relative">
          <Filter className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white font-mono focus:outline-none focus:border-sky-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="OPEN">OPEN</option>
            <option value="ASSIGNED">ASSIGNED</option>
            <option value="IN_PROGRESS">IN_PROGRESS</option>
            <option value="PENDING_VERIFICATION">PENDING_VERIFICATION</option>
            <option value="VERIFIED">VERIFIED</option>
            <option value="HUMAN_REVIEW">HUMAN_REVIEW</option>
            <option value="SUSPICIOUS">SUSPICIOUS</option>
            <option value="CLOSED">CLOSED</option>
          </select>
        </div>

      </div>

      {/* Error Alert */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Ticket Table Component */}
      {isLoading ? (
        <div className="p-12 text-center glass-panel rounded-2xl border border-slate-800">
          <RefreshCw className="w-6 h-6 text-sky-400 animate-spin mx-auto mb-2" />
          <p className="text-xs font-mono text-slate-400">Loading tickets from PostgreSQL database...</p>
        </div>
      ) : (
        <TicketTable
          tickets={filteredTickets}
          onSelectTicket={(t) => setSelectedTicket(t)}
        />
      )}

      {/* Details Modal */}
      {selectedTicket && (
        <TicketDetailsModal
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
          onRefresh={loadTickets}
        />
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <CreateTicketModal
          wardId={sampleWardId}
          onClose={() => setShowCreateModal(false)}
          onRefresh={loadTickets}
        />
      )}

    </div>
  );
};
