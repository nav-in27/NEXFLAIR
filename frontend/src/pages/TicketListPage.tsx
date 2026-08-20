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
    <div className="w-full max-w-6xl mx-auto space-y-6 animate-fade-in p-4 sm:p-6">
      
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 civic-card p-6">
        <div className="space-y-1">
          <div className="inline-flex items-center space-x-1.5 text-slate-500 text-xs font-mono font-semibold">
            <FileText className="w-3.5 h-3.5" />
            <span>MUNICIPAL GRIEVANCE REGISTRY</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Civic Evidence Tickets</h1>
          <p className="text-xs text-slate-500">
            {user?.role === 'FIELD_WORKER' 
              ? 'Assigned tickets for field evidence capture and resolution.' 
              : 'Master municipal registry of citizen complaints and forensic proofs.'}
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={loadTickets}
            className="btn-secondary px-3"
            title="Refresh Tickets"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          {user?.role === 'ADMIN' && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-primary"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log Ticket</span>
            </button>
          )}
        </div>
      </div>

      {/* Filters & Search */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        
        {/* Search */}
        <div className="sm:col-span-2 relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search by ticket #, title, or category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="civic-input pl-9 text-xs font-mono"
          />
        </div>

        {/* Status Filter */}
        <div className="relative">
          <Filter className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="civic-input pl-9 text-xs font-mono"
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
        <div className="p-3.5 rounded-md bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Ticket Table Component */}
      {isLoading ? (
        <div className="civic-card p-12 text-center text-slate-400 font-mono text-xs">
          Loading ticket repository...
        </div>
      ) : (
        <TicketTable 
          tickets={filteredTickets} 
          onSelectTicket={(ticket) => setSelectedTicket(ticket)} 
        />
      )}

      {/* Modals */}
      {selectedTicket && (
        <TicketDetailsModal
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
          onRefresh={() => {
            setSelectedTicket(null);
            loadTickets();
          }}
        />
      )}

      {showCreateModal && (
        <CreateTicketModal
          wardId={sampleWardId}
          onClose={() => setShowCreateModal(false)}
          onRefresh={() => {
            setShowCreateModal(false);
            loadTickets();
          }}
        />
      )}

    </div>
  );
};

export default TicketListPage;
