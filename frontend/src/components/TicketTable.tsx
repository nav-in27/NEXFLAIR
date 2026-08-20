import React from 'react';
import { Ticket } from '../types/ticket';
import { TicketStatusBadge } from './TicketStatusBadge';
import { MapPin, HardHat, AlertTriangle, ArrowRight } from 'lucide-react';

interface Props {
  tickets: Ticket[];
  onSelectTicket: (ticket: Ticket) => void;
}

export const TicketTable: React.FC<Props> = ({ tickets, onSelectTicket }) => {
  if (tickets.length === 0) {
    return (
      <div className="p-8 text-center glass-panel rounded-2xl border border-slate-800 space-y-3">
        <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto" />
        <h4 className="text-sm font-bold text-white">No Tickets Found</h4>
        <p className="text-xs text-slate-400">No municipal evidence tickets match the active view criteria.</p>
      </div>
    );
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'CRITICAL': return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
      case 'HIGH': return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'MEDIUM': return 'bg-sky-500/20 text-sky-300 border-sky-500/40';
      default: return 'bg-slate-500/20 text-slate-300 border-slate-500/40';
    }
  };

  return (
    <div className="w-full overflow-x-auto glass-panel rounded-2xl border border-slate-800">
      <table className="w-full text-left border-collapse text-xs">
        <thead>
          <tr className="border-b border-slate-800/80 bg-slate-900/50 text-slate-400 font-mono text-[11px] uppercase tracking-wider">
            <th className="py-3.5 px-4 font-semibold">Ticket Ref</th>
            <th className="py-3.5 px-4 font-semibold">Complaint Type</th>
            <th className="py-3.5 px-4 font-semibold">Title & Location</th>
            <th className="py-3.5 px-4 font-semibold">Priority</th>
            <th className="py-3.5 px-4 font-semibold">Status</th>
            <th className="py-3.5 px-4 font-semibold">Assigned Field Officer</th>
            <th className="py-3.5 px-4 font-semibold text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/50 font-sans">
          {tickets.map((ticket) => (
            <tr key={ticket.id} className="hover:bg-slate-900/40 transition-colors group">
              <td className="py-3.5 px-4 font-mono font-bold text-sky-400">
                {ticket.ticket_number}
              </td>

              <td className="py-3.5 px-4">
                <span className="px-2 py-0.5 rounded bg-sky-500/10 text-sky-300 font-mono text-[11px] border border-sky-500/20">
                  {ticket.complaint_type}
                </span>
              </td>

              <td className="py-3.5 px-4 max-w-xs">
                <div className="font-semibold text-slate-100 truncate">{ticket.title}</div>
                <div className="text-[11px] text-slate-400 flex items-center space-x-1 mt-0.5">
                  <MapPin className="w-3 h-3 text-slate-500 flex-shrink-0" />
                  <span>{ticket.ward ? `${ticket.ward.name} (${ticket.ward.zone})` : 'Unassigned Ward'}</span>
                </div>
              </td>

              <td className="py-3.5 px-4">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border font-mono ${getPriorityColor(ticket.priority)}`}>
                  {ticket.priority}
                </span>
              </td>

              <td className="py-3.5 px-4">
                <TicketStatusBadge status={ticket.status} />
              </td>

              <td className="py-3.5 px-4">
                {ticket.assigned_worker ? (
                  <div className="flex items-center space-x-1.5 text-slate-200">
                    <HardHat className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
                    <span className="font-medium text-xs truncate">{ticket.assigned_worker.full_name}</span>
                  </div>
                ) : (
                  <span className="text-slate-500 italic text-[11px]">Unassigned</span>
                )}
              </td>

              <td className="py-3.5 px-4 text-right">
                <button
                  onClick={() => onSelectTicket(ticket)}
                  className="px-3 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/30 text-xs font-semibold inline-flex items-center space-x-1 transition-all"
                >
                  <span>Inspect</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
