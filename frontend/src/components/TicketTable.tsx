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
      <div className="p-8 text-center civic-card space-y-2">
        <AlertTriangle className="w-6 h-6 text-amber-500 mx-auto" />
        <h4 className="text-xs font-bold text-slate-900 font-mono">NO COMPLAINTS FOUND</h4>
        <p className="text-xs text-slate-500">No municipal evidence tickets match the active view criteria.</p>
      </div>
    );
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'CRITICAL': return 'bg-rose-50 text-rose-800 border-rose-200';
      case 'HIGH': return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'MEDIUM': return 'bg-blue-50 text-blue-800 border-blue-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="w-full overflow-x-auto civic-card">
      <table className="w-full text-left border-collapse text-xs">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-500 font-mono text-[11px] uppercase tracking-wider">
            <th className="py-3 px-4 font-semibold">Ticket Ref</th>
            <th className="py-3 px-4 font-semibold">Complaint Type</th>
            <th className="py-3 px-4 font-semibold">Title & Location</th>
            <th className="py-3 px-4 font-semibold">Priority</th>
            <th className="py-3 px-4 font-semibold">Status</th>
            <th className="py-3 px-4 font-semibold">Assigned Field Officer</th>
            <th className="py-3 px-4 font-semibold text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 font-sans">
          {tickets.map((ticket) => (
            <tr key={ticket.id} className="hover:bg-slate-50/70 transition-colors">
              <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                #{ticket.ticket_number}
              </td>

              <td className="py-3.5 px-4">
                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[11px] border border-slate-200">
                  {ticket.complaint_type}
                </span>
              </td>

              <td className="py-3.5 px-4 max-w-xs">
                <div className="font-semibold text-slate-900 truncate">{ticket.title}</div>
                <div className="text-[11px] text-slate-500 flex items-center space-x-1 mt-0.5">
                  <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
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
                  <div className="flex items-center space-x-1.5 text-slate-800">
                    <HardHat className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                    <span className="font-medium text-xs truncate">{ticket.assigned_worker.full_name}</span>
                  </div>
                ) : (
                  <span className="text-slate-400 italic text-[11px]">Unassigned</span>
                )}
              </td>

              <td className="py-3.5 px-4 text-right">
                <button
                  onClick={() => onSelectTicket(ticket)}
                  className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold inline-flex items-center space-x-1 transition-colors"
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

export default TicketTable;
