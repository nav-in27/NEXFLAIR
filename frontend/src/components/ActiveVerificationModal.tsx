import React, { useState, useEffect, useRef } from 'react';
import { Ticket } from '../types/ticket';
import { VerificationSession } from '../types/verification';
import { submitVerificationApi } from '../services/verificationApi';
import { useAuth } from '../context/AuthContext';
import { X, Camera, Upload, Clock, AlertCircle, CheckCircle2, Loader2, ShieldAlert, Sparkles, Image as ImageIcon } from 'lucide-react';

interface Props {
  ticket: Ticket;
  session: VerificationSession;
  onClose: () => void;
  onRefresh: () => void;
}

export const ActiveVerificationModal: React.FC<Props> = ({ ticket, session, onClose, onRefresh }) => {
  const { token } = useAuth();
  const [sourceMode, setSourceMode] = useState<'LIVE_CAMERA' | 'UPLOAD'>('LIVE_CAMERA');
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number>(15 * 60);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Camera WebRTC Stream Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // 1. Expiration Timer Countdown
  useEffect(() => {
    const expiresAtMs = new Date(session.expires_at).getTime();
    const interval = setInterval(() => {
      const nowMs = new Date().getTime();
      const diffSec = Math.max(0, Math.floor((expiresAtMs - nowMs) / 1000));
      setTimeLeftSeconds(diffSec);
      if (diffSec <= 0) {
        clearInterval(interval);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [session.expires_at]);

  // 2. Camera Stream Ingestion
  useEffect(() => {
    let stream: MediaStream | null = null;

    if (sourceMode === 'LIVE_CAMERA') {
      navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'environment' } })
        .then((s) => {
          stream = s;
          if (videoRef.current) {
            videoRef.current.srcObject = s;
          }
          setCameraActive(true);
          setCameraError(null);
        })
        .catch(() => {
          setCameraActive(false);
          setCameraError('Browser camera unavailable or permission denied. Switched to DEMO UPLOAD MODE.');
          setSourceMode('UPLOAD');
        });
    } else {
      setCameraActive(false);
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [sourceMode]);

  // Capture Snapshot from Video Element
  const handleCaptureSnapshot = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `live_snapshot_${Date.now()}.jpg`, { type: 'image/jpeg' });
        setCapturedFile(file);
        setPreviewUrl(URL.createObjectURL(blob));
      }
    }, 'image/jpeg', 0.92);
  };

  // Handle Demo File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setCapturedFile(selected);
      setPreviewUrl(URL.createObjectURL(selected));
      setErrorMsg(null);
    }
  };

  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !capturedFile) {
      setErrorMsg('Please capture a live camera snapshot or upload an evidence image.');
      return;
    }

    if (timeLeftSeconds <= 0) {
      setErrorMsg('Verification session has expired. Please start a new session.');
      return;
    }

    setIsSubmitting(true);
    setIsProcessingAI(true);
    setErrorMsg(null);

    try {
      await submitVerificationApi(
        {
          session_id: session.id,
          file: capturedFile,
          source_type: sourceMode,
          latitude: ticket.latitude,
          longitude: ticket.longitude,
        },
        token
      );
      setSubmitSuccess(true);
      setTimeout(() => {
        onRefresh();
        onClose();
      }, 1500);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('Verification submission failed.');
      }
    } finally {
      setIsSubmitting(false);
      setIsProcessingAI(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
      <div className="glass-panel w-full max-w-2xl rounded-3xl border border-sky-500/30 p-6 sm:p-8 space-y-6 shadow-2xl relative my-8 max-h-[90vh] overflow-y-auto">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-6 top-6 p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header & Expiry Clock */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4 pr-10">
          <div>
            <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-sky-500/10 text-sky-400 text-xs font-semibold border border-sky-500/20 mb-1">
              <Camera className="w-3.5 h-3.5" />
              <span>Active Verification Challenge</span>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">{ticket.ticket_number} Verification</h2>
          </div>

          <div className="px-3.5 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-center space-x-2 font-mono text-sm font-bold shadow-inner">
            <Clock className="w-4 h-4 animate-spin text-amber-400" />
            <span>EXPIRES: {formatTime(timeLeftSeconds)}</span>
          </div>
        </div>

        {/* Challenge Instructions Box */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-sky-950/40 to-indigo-950/40 border border-sky-500/30 space-y-1 text-xs">
          <div className="font-bold text-sky-300 flex items-center space-x-1.5">
            <Sparkles className="w-4 h-4 text-sky-400" />
            <span>Challenge Instruction:</span>
          </div>
          <p className="text-slate-200 text-xs font-medium pl-5">
            "{session.challenge_text || 'Capture the reported area for verification.'}"
          </p>
        </div>

        {/* Alerts */}
        {submitSuccess && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center space-x-2 animate-bounce">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span>Verification evidence submitted successfully! Ticket updated to PENDING_VERIFICATION.</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Mode Toggle Tabs */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-300">Verification Source Mode</label>
            {sourceMode === 'UPLOAD' && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-amber-500/10 text-amber-300 border border-amber-500/30">
                DEMO MODE
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setSourceMode('LIVE_CAMERA')}
              className={`py-2.5 px-3 rounded-xl text-xs font-bold border flex items-center justify-center space-x-2 transition-all ${
                sourceMode === 'LIVE_CAMERA'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-md shadow-emerald-500/10'
                  : 'bg-slate-900 text-slate-400 border-slate-800'
              }`}
            >
              <Camera className="w-4 h-4" />
              <span>LIVE CAMERA STREAM</span>
            </button>

            <button
              type="button"
              onClick={() => setSourceMode('UPLOAD')}
              className={`py-2.5 px-3 rounded-xl text-xs font-bold border flex items-center justify-center space-x-2 transition-all ${
                sourceMode === 'UPLOAD'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-md shadow-amber-500/10'
                  : 'bg-slate-900 text-slate-400 border-slate-800'
              }`}
            >
              <Upload className="w-4 h-4" />
              <span>DEMO UPLOAD MODE</span>
            </button>
          </div>

          {sourceMode === 'UPLOAD' && (
            <p className="text-[11px] text-amber-300/90 italic bg-amber-950/30 p-2.5 rounded-xl border border-amber-500/20 flex items-center space-x-2">
              <ShieldAlert className="w-4 h-4 flex-shrink-0 text-amber-400" />
              <span>
                <strong>DEMO MODE ACTIVE:</strong> Files uploaded in demo mode are tagged as <code className="font-mono text-amber-200">UPLOAD</code>. MeiKaan never claims uploaded evidence is live.
              </span>
            </p>
          )}
        </div>

        {/* Active Capture / Upload Area */}
        <div className="space-y-3">
          {sourceMode === 'LIVE_CAMERA' ? (
            <div className="space-y-3">
              <div className="aspect-video w-full rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 relative flex items-center justify-center">
                {previewUrl ? (
                  <img src={previewUrl} alt="Captured Snapshot" className="w-full h-full object-cover" />
                ) : (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                )}

                {cameraError && (
                  <div className="absolute inset-0 bg-slate-950/90 p-4 flex flex-col items-center justify-center text-center space-y-2">
                    <Camera className="w-8 h-8 text-amber-400" />
                    <p className="text-xs text-amber-300">{cameraError}</p>
                  </div>
                )}
              </div>

              {cameraActive && !previewUrl && (
                <button
                  type="button"
                  onClick={handleCaptureSnapshot}
                  className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-xs shadow-md shadow-emerald-500/20 flex items-center justify-center space-x-2"
                >
                  <Camera className="w-4 h-4" />
                  <span>Capture Live Snapshot</span>
                </button>
              )}

              {previewUrl && (
                <button
                  type="button"
                  onClick={() => {
                    setPreviewUrl(null);
                    setCapturedFile(null);
                  }}
                  className="w-full py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold"
                >
                  Retake Live Snapshot
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <label className="border-2 border-dashed border-slate-800 hover:border-amber-500/50 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors bg-slate-950/60">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                />
                {previewUrl ? (
                  <div className="space-y-2 text-center w-full">
                    <img src={previewUrl} alt="Demo Preview" className="max-h-44 mx-auto rounded-xl border border-slate-800 object-cover" />
                    <p className="text-xs font-mono text-amber-300 truncate max-w-xs mx-auto">{capturedFile?.name}</p>
                    <p className="text-[10px] text-slate-500">Click to change file</p>
                  </div>
                ) : (
                  <div className="text-center space-y-2 py-4">
                    <ImageIcon className="w-8 h-8 text-amber-400/80 mx-auto" />
                    <p className="text-xs font-medium text-slate-300">Select Demo Evidence Photo (JPEG, PNG, WEBP)</p>
                    <p className="text-[10px] font-mono text-amber-400">DEMO MODE ONLY • Tagged as UPLOAD</p>
                  </div>
                )}
              </label>
            </div>
          )}
        </div>

        {/* Submit Verification Action */}
        <form onSubmit={handleSubmit} className="pt-2">
          <button
            type="submit"
            disabled={isSubmitting || !capturedFile || timeLeftSeconds <= 0}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-sky-500/25 transition-all flex items-center justify-center space-x-2 disabled:opacity-40"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{isProcessingAI ? 'Processing Verification Payload...' : 'Submitting Evidence...'}</span>
              </>
            ) : (
              <>
                <ShieldAlert className="w-4 h-4" />
                <span>Submit Verification Payload</span>
              </>
            )}
          </button>
        </form>

      </div>
    </div>
  );
};
