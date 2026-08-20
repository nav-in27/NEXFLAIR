import React, { useState, useEffect } from 'react';
import { CreateTicketPayload } from '../types/ticket';
import { X, Plus, AlertCircle, Loader2, Navigation } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { createTicket } from '../services/ticketApi';

interface Props {
  wardId: string;
  onClose: () => void;
  onRefresh: () => void;
}

export const CreateTicketModal: React.FC<Props> = ({ wardId, onClose, onRefresh }) => {
  const { token } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [complaintType] = useState('STAGNANT_WATER');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('HIGH');

  const [latitude, setLatitude] = useState<number | undefined>(undefined);
  const [longitude, setLongitude] = useState<number | undefined>(undefined);
  const [accuracy, setAccuracy] = useState<number | undefined>(undefined);
  const [gpsCaptured, setGpsCaptured] = useState<boolean>(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLatitude(pos.coords.latitude);
          setLongitude(pos.coords.longitude);
          setAccuracy(Math.round(pos.coords.accuracy));
          setGpsCaptured(true);
        },
        () => {
          setGpsError('Live device location unavailable. Administrative ward lookup will process complaint.');
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (!title.trim()) {
      setErrorMsg('Please enter a complaint title.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const payload: CreateTicketPayload = {
      complaint_type: complaintType,
      title: title.trim(),
      description: description.trim() || undefined,
      latitude,
      longitude,
      accuracy_meters: accuracy,
      location_source: gpsCaptured ? 'device_gps' : 'unavailable',
      location_status: gpsCaptured ? 'GPS_CAPTURED' : 'GPS_UNAVAILABLE',
      ward_id: wardId,
      priority,
    };

    try {
      await createTicket(payload, token);
      onRefresh();
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('Failed to log ticket.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
      <div className="glass-panel w-full max-w-lg rounded-3xl border border-slate-800 p-6 sm:p-8 space-y-6 shadow-2xl relative my-8">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-6 top-6 p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="space-y-1">
          <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-sky-500/10 text-sky-400 text-xs font-semibold border border-sky-500/20">
            <Plus className="w-3.5 h-3.5" />
            <span>New Municipal Ticket</span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">Log Stagnant Water Grievance</h2>
        </div>

        {/* Error Notification */}
        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Automatic Location Capture Panel */}
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-1 text-slate-300">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-200 flex items-center gap-1">
                <Navigation className="w-3.5 h-3.5 text-sky-400" />
                Automatic Location Capture
              </span>
              {gpsCaptured && (
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  GPS CAPTURED
                </span>
              )}
            </div>

            {gpsCaptured ? (
              <div className="text-[11px] font-mono text-slate-400 pt-1">
                {latitude?.toFixed(4)}° N, {longitude?.toFixed(4)}° E (±{accuracy} m) • Ward Derived Server-Side
              </div>
            ) : (
              <div className="text-[11px] text-slate-400 italic pt-1">
                {gpsError || 'Capturing live device GPS coordinates...'}
              </div>
            )}
          </div>

          {/* Title */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300 block">Grievance Title</label>
            <input
              type="text"
              required
              placeholder="e.g. Deep Stagnant Water Accumulation near Market Gate"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500"
            />
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300 block">Description Details</label>
            <textarea
              rows={3}
              placeholder="Describe standing water volume, location landmarks, and vector breeding risk..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 resize-none"
            />
          </div>

          {/* Priority */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300 block">Priority Level</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-white focus:outline-none focus:border-sky-500"
            >
              <option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
              <option value="CRITICAL">CRITICAL</option>
            </select>
          </div>

          {/* Submit */}
          <div className="pt-3 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-bold text-xs shadow-md shadow-sky-500/20 transition-all disabled:opacity-50 flex items-center space-x-1.5"
            >
              {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              <span>Create Ticket</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};

export default CreateTicketModal;
