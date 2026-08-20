import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Clock, Camera, Upload, CheckCircle2, AlertCircle, XCircle, Loader2, Play, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { fetchTicketById, startWorkerTaskApi } from '../../services/ticketApi';
import { startVerificationApi, submitVerificationApi } from '../../services/verificationApi';
import { Ticket } from '../../types/ticket';
import { VerificationSession } from '../../types/verification';
import { CameraCaptureModal, CameraGpsData } from '../../components/CameraCaptureModal';

function calculateHaversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export const WorkerTaskDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const navigate = useNavigate();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  const [isStartingTask, setIsStartingTask] = useState<boolean>(false);
  const [showVerifyModal, setShowVerifyModal] = useState<boolean>(false);
  const [showCameraModal, setShowCameraModal] = useState<boolean>(false);

  const [sourceType, setSourceType] = useState<'LIVE_CAMERA' | 'UPLOAD'>('LIVE_CAMERA');
  const [evidencePhoto, setEvidencePhoto] = useState<string>('');
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);

  // Live Evidence Location State
  const [evLoc, setEvLoc] = useState<{
    latitude?: number;
    longitude?: number;
    accuracy_meters?: number;
    captured_at?: string;
    status: 'IDLE' | 'CAPTURING' | 'CAPTURED' | 'FAILED';
  }>({ status: 'IDLE' });

  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [verifyStatusText, setVerifyStatusText] = useState<string>('');
  const [verifyResult, setVerifyResult] = useState<VerificationSession | null>(null);

  const loadTicket = async () => {
    if (!id || !token) return;
    setIsLoading(true);
    setError('');

    try {
      const data = await fetchTicketById(id, token);
      setTicket(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load task details.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setEvidencePhoto('');
    setEvidenceFile(null);
    setVerifyResult(null);
    setEvLoc({ status: 'IDLE' });
    setError('');
    loadTicket();
  }, [id, token]);

  const handleStartTask = async () => {
    if (!ticket || !token) return;
    setIsStartingTask(true);
    setError('');

    const captureLocationAndStart = (lat?: number, lon?: number, acc?: number) => {
      startWorkerTaskApi(
        ticket.id,
        {
          latitude: lat,
          longitude: lon,
          accuracy_meters: acc,
          captured_at: new Date().toISOString(),
          location_source: lat ? 'device_gps' : 'unavailable',
        },
        token
      )
        .then((updated) => {
          setTicket(updated);
        })
        .catch((err) => {
          setError(err.message || 'Failed to record task start location.');
        })
        .finally(() => {
          setIsStartingTask(false);
        });
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => captureLocationAndStart(pos.coords.latitude, pos.coords.longitude, Math.round(pos.coords.accuracy)),
        () => {
          setError('LOCATION ACCESS REQUIRED: Please enable device location permissions to start this task.');
          setIsStartingTask(false);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    } else {
      setError('LOCATION ACCESS REQUIRED: Geolocation is not supported by this browser.');
      setIsStartingTask(false);
    }
  };

  const captureEvidenceLocation = () => {
    setEvLoc({ status: 'CAPTURING' });
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setEvLoc({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy_meters: Math.round(pos.coords.accuracy),
            captured_at: new Date(pos.timestamp).toISOString(),
            status: 'CAPTURED',
          });
        },
        () => {
          setEvLoc({ status: 'FAILED' });
          setError('GPS signal unavailable. Verification will evaluate visual evidence.');
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    } else {
      setEvLoc({ status: 'FAILED' });
    }
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>, source: 'LIVE_CAMERA' | 'UPLOAD') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSourceType(source);
    setEvidenceFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setEvidencePhoto(reader.result as string);
    };
    reader.readAsDataURL(file);

    captureEvidenceLocation();
  };

  const handleCameraCapture = (file: File, previewUrl: string, camGps?: CameraGpsData) => {
    setSourceType('LIVE_CAMERA');
    setEvidenceFile(file);
    setEvidencePhoto(previewUrl);

    if (camGps && camGps.status === 'GPS_CAPTURED' && camGps.latitude !== undefined && camGps.longitude !== undefined) {
      setEvLoc({
        latitude: camGps.latitude,
        longitude: camGps.longitude,
        accuracy_meters: camGps.accuracy_meters,
        captured_at: camGps.captured_at,
        status: 'CAPTURED',
      });
    } else {
      captureEvidenceLocation();
    }
  };

  const handleSubmitVerification = async () => {
    if (!ticket || !token || !evidenceFile) return;
    setIsVerifying(true);
    setError('');

    try {
      setVerifyStatusText('1/2. Starting verification session...');
      const session = await startVerificationApi(ticket.id, token);

      setVerifyStatusText('2/2. Running AI forensic verification...');
      const res = await submitVerificationApi(
        {
          session_id: session.id,
          file: evidenceFile,
          source_type: sourceType,
          latitude: evLoc.latitude,
          longitude: evLoc.longitude,
          accuracy_meters: evLoc.accuracy_meters,
          location_source: evLoc.status === 'CAPTURED' ? 'device_gps' : 'unavailable',
        },
        token
      );
      setVerifyResult(res);
      await loadTicket();
    } catch (err: any) {
      setError(err.message || 'Verification check failed.');
    } finally {
      setIsVerifying(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#fcfcfd] text-slate-900 flex items-center justify-center p-6">
        <Loader2 className="w-8 h-8 animate-spin text-slate-900" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="min-h-screen bg-[#fcfcfd] text-slate-900 p-6 max-w-xl mx-auto text-center space-y-4 pt-12">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-xl font-bold text-slate-900">Task Not Found</h2>
        <button onClick={() => navigate('/worker/dashboard')} className="px-4 py-2 bg-[#0b1d30] text-white font-bold rounded-xl text-xs">
          Return to Tasks
        </button>
      </div>
    );
  }

  // Calculate distance between complaint location & evidence location
  let distanceMeters: number | null = null;
  if (ticket.latitude && ticket.longitude && evLoc.latitude && evLoc.longitude) {
    distanceMeters = calculateHaversineMeters(ticket.latitude, ticket.longitude, evLoc.latitude, evLoc.longitude);
  }

  return (
    <div className="min-h-screen bg-[#fcfcfd] text-slate-900 p-4 sm:p-8 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <button onClick={() => navigate('/worker/dashboard')} className="p-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-xl shadow-xs">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="font-mono text-sm font-extrabold text-slate-900">Task #{ticket.ticket_number}</span>
        <div className="w-9"></div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Complaint Info Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{ticket.complaint_type.replace('_', ' ')}</span>
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
            ['VERIFIED', 'CITIZEN_CONFIRMED', 'CLOSED'].includes(ticket.status)
              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
              : 'bg-amber-100 text-amber-800 border border-amber-200'
          }`}>
            {ticket.status.replace('_', ' ')}
          </span>
        </div>

        <h1 className="font-serif text-2xl font-extrabold text-slate-900 tracking-tight">{ticket.title}</h1>

        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 border-t border-slate-100 pt-3">
          <div className="flex items-center gap-1 font-semibold text-slate-800">
            <MapPin className="w-4 h-4 text-slate-700" />
            <span>{ticket.ward?.name || 'Ward 14 - Malleshwaram'}</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="w-4 h-4 text-slate-400" />
            <span>Assigned {new Date(ticket.created_at).toLocaleDateString()}</span>
          </div>
        </div>

        {ticket.worker_start_timestamp && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Task Started • Live Location Captured {ticket.worker_start_accuracy ? `(±${ticket.worker_start_accuracy} m)` : ''}</span>
          </div>
        )}

        {ticket.description && (
          <div className="bg-slate-50 rounded-xl p-4 text-xs text-slate-700 border border-slate-200/80">
            <span className="font-bold text-slate-900 block mb-1">Citizen Report Details:</span>
            "{ticket.description}"
          </div>
        )}
      </div>

      {/* Start Task Action if not started */}
      {(ticket.status === 'ASSIGNED' || ticket.status === 'OPEN') && (
        <button
          onClick={handleStartTask}
          disabled={isStartingTask}
          className="w-full py-4 bg-[#0047bb] hover:bg-[#003ca0] text-white font-bold text-base rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isStartingTask ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Capturing Device Location & Starting...</span>
            </>
          ) : (
            <>
              <Play className="w-5 h-5" />
              <span>START TASK</span>
            </>
          )}
        </button>
      )}

      {/* Original Complaint Photo */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Original Complaint Scene</h3>
        <div className="rounded-xl overflow-hidden bg-slate-100 border border-slate-200 min-h-[14rem] flex items-center justify-center relative">
          {(() => {
            const beforeEv = ticket.evidences?.find(e => e.evidence_type === 'BEFORE');
            if (!beforeEv || !beforeEv.file_path) {
              return (
                <div className="text-center p-6 text-slate-400">
                  <Camera className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <span className="text-xs font-semibold block text-slate-500">Citizen reported location (No initial photo attached)</span>
                </div>
              );
            }
            const imgUrl = beforeEv.file_path.startsWith('http') || beforeEv.file_path.startsWith('/') ? beforeEv.file_path : `/${beforeEv.file_path}`;
            return (
              <img
                src={imgUrl}
                alt="Original complaint scene"
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.currentTarget;
                  target.style.display = 'none';
                  const parent = target.parentElement;
                  if (parent && !parent.querySelector('.img-load-error')) {
                    const errDiv = document.createElement('div');
                    errDiv.className = 'img-load-error p-6 text-center text-rose-600 text-xs font-medium space-y-1';
                    errDiv.innerHTML = `<span class="block font-bold">Failed to load evidence image</span><span class="text-[11px] text-slate-500 font-mono block">${imgUrl}</span>`;
                    parent.appendChild(errDiv);
                  }
                }}
              />
            );
          })()}
        </div>
      </div>

      {/* Primary Submit Resolution Button */}
      {ticket.status === 'IN_PROGRESS' && (
        <button
          onClick={() => setShowVerifyModal(true)}
          className="w-full py-4 bg-[#0b1d30] hover:bg-[#162e48] text-white font-bold text-base rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
        >
          <Camera className="w-5 h-5" />
          <span>SUBMIT RESOLUTION EVIDENCE</span>
        </button>
      )}

      {/* Verification Modal */}
      {showVerifyModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-serif text-lg font-bold text-slate-900">Verify Work at Assigned Location</h3>
                <p className="text-xs text-slate-500">Capture resolution evidence at the assigned complaint location.</p>
              </div>
              <button onClick={() => setShowVerifyModal(false)} className="text-slate-400 hover:text-slate-900 text-xs font-semibold">
                Close
              </button>
            </div>

            {evidencePhoto ? (
              <div className="space-y-3">
                <div className="relative rounded-2xl overflow-hidden border border-slate-200 h-48 bg-slate-100">
                  <img src={evidencePhoto} alt="Resolution photo" className="w-full h-full object-cover" />
                  <button
                    onClick={() => {
                      setEvidencePhoto('');
                      setEvidenceFile(null);
                    }}
                    className="absolute top-2 right-2 px-3 py-1 bg-white/90 text-slate-900 text-xs font-semibold rounded-lg border border-slate-200 shadow-xs"
                  >
                    Retake Photo
                  </button>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                  <div className="flex justify-between items-center font-bold text-slate-900">
                    <span>Evidence Capture Mode:</span>
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-mono text-[10px]">
                      {sourceType === 'LIVE_CAMERA' ? '📷 LIVE CAMERA' : '📁 GALLERY UPLOAD'}
                    </span>
                  </div>

                  {evLoc.status === 'CAPTURED' ? (
                    <div className="flex justify-between items-center text-slate-700 font-mono text-[11px] pt-1 border-t border-slate-200/60">
                      <span>Device GPS Location:</span>
                      <span className="font-bold text-slate-900">
                        {evLoc.latitude?.toFixed(4)}°, {evLoc.longitude?.toFixed(4)}° (±{evLoc.accuracy_meters} m)
                      </span>
                    </div>
                  ) : (
                    <div className="text-[11px] text-amber-700 italic pt-1">
                      Capturing evidence GPS coordinates...
                    </div>
                  )}
                </div>

                {/* Location Matching Status & Feedback */}
                {distanceMeters !== null && (
                  (() => {
                    const ticketAcc = ticket?.accuracy_meters ?? 15;
                    const devAcc = evLoc.accuracy_meters ?? 15;
                    const isRoughCoverage = ticketAcc > 1000 || devAcc > 1000;
                    const maxAllowedM = isRoughCoverage ? Math.max(ticketAcc, 5000) : Math.max(50, ticketAcc + devAcc);
                    const isMismatch = distanceMeters > maxAllowedM;

                    if (isRoughCoverage) {
                      return (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
                          <div className="flex items-center gap-1.5 font-bold text-amber-950">
                            <MapPin className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>Approximate Location Signal (±{Math.round(ticketAcc)}m)</span>
                          </div>
                          <p className="text-[11px] leading-relaxed text-amber-800">
                            Complaint was reported with approximate network/cellular coordinates. MEIKAAN will verify work resolution primarily using visual scene matching.
                          </p>
                        </div>
                      );
                    }

                    if (isMismatch) {
                      return (
                        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 space-y-1">
                          <div className="flex items-center gap-1.5 font-bold text-rose-950">
                            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                            <span>⚠ LOCATION MISMATCH DETECTED</span>
                          </div>
                          <p className="text-[11px] leading-relaxed text-rose-800">
                            You appear to be approximately <strong>{distanceMeters} meters</strong> away from the reported complaint location (tolerance: ±{Math.round(maxAllowedM)}m). Evidence will be submitted and evaluated with visual matching.
                          </p>
                        </div>
                      );
                    }

                    return (
                      <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Location matches complaint site ({distanceMeters}m, ±{Math.round(maxAllowedM)}m tolerance).</span>
                      </div>
                    );
                  })()
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {/* Option 1: Live Camera / Webcam Capture */}
                <button
                  type="button"
                  onClick={() => setShowCameraModal(true)}
                  className="p-6 border-2 border-dashed border-blue-200 hover:border-blue-500 rounded-2xl bg-blue-50/40 hover:bg-blue-50/90 text-center cursor-pointer flex flex-col items-center justify-center transition-all group shadow-2xs"
                >
                  <div className="w-12 h-12 rounded-2xl bg-blue-100/80 text-blue-700 flex items-center justify-center mb-2 group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
                    <Camera className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-bold text-slate-900 block">TAKE PHOTO</span>
                  <span className="text-[10px] text-slate-500 mt-1 block">Live Camera / Webcam</span>
                </button>

                {/* Option 2: Gallery / File Upload */}
                <label className="p-6 border-2 border-dashed border-slate-300 hover:border-slate-500 rounded-2xl bg-slate-50 hover:bg-slate-100 text-center cursor-pointer flex flex-col items-center justify-center transition-all group shadow-2xs">
                  <div className="w-12 h-12 rounded-2xl bg-slate-200/80 text-slate-700 flex items-center justify-center mb-2 group-hover:scale-110 group-hover:bg-slate-700 group-hover:text-white transition-all shadow-sm">
                    <Upload className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-bold text-slate-900 block">UPLOAD PHOTO</span>
                  <span className="text-[10px] text-slate-500 mt-1 block">From Device / Gallery</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => handlePhotoSelect(e, 'UPLOAD')}
                    className="hidden"
                  />
                </label>
              </div>
            )}

            {/* Worker Camera Modal */}
            <CameraCaptureModal
              isOpen={showCameraModal}
              onClose={() => setShowCameraModal(false)}
              onCapture={handleCameraCapture}
              onFallbackUpload={() => {
                const inputEl = document.createElement('input');
                inputEl.type = 'file';
                inputEl.accept = 'image/jpeg,image/png,image/webp';
                inputEl.onchange = (ev: any) => handlePhotoSelect(ev, 'UPLOAD');
                inputEl.click();
              }}
              title="Worker Resolution Evidence Capture"
            />

            {verifyResult ? (
              <div className={`p-5 border rounded-2xl text-left space-y-4 ${
                verifyResult.integrity_status === 'VERIFIED'
                  ? 'bg-emerald-50 border-emerald-200'
                  : verifyResult.integrity_status === 'HUMAN_REVIEW'
                    ? 'bg-amber-50 border-amber-200'
                    : 'bg-rose-50 border-rose-200'
              }`}>
                <div className="flex flex-col items-center justify-center text-center pb-4 border-b border-slate-200/60">
                  {verifyResult.integrity_status === 'VERIFIED' ? (
                    <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                  ) : verifyResult.integrity_status === 'HUMAN_REVIEW' ? (
                    <AlertCircle className="w-10 h-10 text-amber-600 mx-auto" />
                  ) : (
                    <XCircle className="w-10 h-10 text-rose-600 mx-auto" />
                  )}
                  
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-600 mt-3">Verification Decision</div>
                  <span className={`inline-block mt-2 px-4 py-1 rounded-full text-xs font-bold ${
                    verifyResult.integrity_status === 'VERIFIED'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : verifyResult.integrity_status === 'HUMAN_REVIEW'
                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                        : 'bg-rose-100 text-rose-800 border border-rose-300'
                  }`}>
                    {verifyResult.integrity_status === 'VERIFIED'
                      ? '✓ VERIFIED'
                      : verifyResult.integrity_status === 'HUMAN_REVIEW'
                        ? '⚠ HUMAN REVIEW'
                        : verifyResult.integrity_status === 'SUSPICIOUS'
                          ? '🚨 SUSPICIOUS EVIDENCE'
                          : '✕ CLOSURE NOT VERIFIED'}
                  </span>
                </div>

                {verifyResult.detailed_result ? (
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between items-center bg-white p-2.5 rounded border border-slate-100">
                      <span className="font-semibold text-slate-700">Evidence Quality:</span>
                      <span className="font-bold text-slate-900">
                        {verifyResult.detailed_result.evidence_quality != null
                          ? `${verifyResult.detailed_result.evidence_quality.toFixed(1)} / 100`
                          : `${(verifyResult.integrity_score ?? 100).toFixed(1)} / 100`}
                      </span>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-slate-100 space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-slate-700">Location Verification:</span>
                        <span className={`font-bold ${
                          ['GPS_PASS', 'PASS'].includes(verifyResult.detailed_result.location?.status)
                            ? 'text-emerald-700'
                            : ['GPS_BORDERLINE', 'BORDERLINE', 'GPS_UNAVAILABLE', 'UNAVAILABLE', 'UNUSABLE'].includes(verifyResult.detailed_result.location?.status)
                              ? 'text-amber-700'
                              : 'text-rose-700'
                        }`}>
                          {['GPS_PASS', 'PASS'].includes(verifyResult.detailed_result.location?.status)
                            ? '✓ PASS'
                            : ['GPS_BORDERLINE', 'BORDERLINE'].includes(verifyResult.detailed_result.location?.status)
                              ? '⚠ BORDERLINE'
                              : ['GPS_UNAVAILABLE', 'UNAVAILABLE', 'UNUSABLE'].includes(verifyResult.detailed_result.location?.status)
                                ? '⚠ APPROXIMATE'
                                : '✕ FAIL'}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-100 text-[11px] text-slate-600">
                        <div>
                          <span className="text-slate-400 block text-[10px]">Distance</span>
                          <span className="font-bold text-slate-800">
                            {verifyResult.detailed_result.location?.distance_meters != null
                              ? `${verifyResult.detailed_result.location.distance_meters} m`
                              : 'N/A'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Device Accuracy</span>
                          <span className="font-bold text-slate-800">
                            {verifyResult.detailed_result.location?.accuracy_meters != null
                              ? `±${verifyResult.detailed_result.location.accuracy_meters} m`
                              : '±15 m'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Tolerance</span>
                          <span className="font-bold text-slate-800">
                            {verifyResult.detailed_result.location?.tolerance_meters != null
                              ? `±${verifyResult.detailed_result.location.tolerance_meters} m`
                              : '±200 m'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-between items-center bg-white p-2.5 rounded border border-slate-100">
                      <span className="font-semibold text-slate-700">Scene Match:</span>
                      <span className={`font-bold ${
                        ['STRONG_MATCH', 'WEAK_MATCH', 'PASS', 'CONSISTENT'].includes(verifyResult.detailed_result.scene?.status)
                          ? 'text-emerald-700'
                          : ['UNCERTAIN', 'BORDERLINE'].includes(verifyResult.detailed_result.scene?.status)
                            ? 'text-amber-700'
                            : 'text-rose-700'
                      }`}>
                        {['STRONG_MATCH', 'WEAK_MATCH', 'PASS', 'CONSISTENT'].includes(verifyResult.detailed_result.scene?.status)
                          ? '✓ STRONG MATCH'
                          : ['UNCERTAIN', 'BORDERLINE'].includes(verifyResult.detailed_result.scene?.status)
                            ? '⚠ UNCERTAIN'
                            : '✕ DIFFERENT SCENE'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center bg-white p-2.5 rounded border border-slate-100">
                      <span className="font-semibold text-slate-700">Issue Resolved:</span>
                      <span className={`font-bold ${
                        ['RESOLVED', 'SUPPORTED', 'MATCH'].includes(verifyResult.detailed_result.issue?.status)
                          ? 'text-emerald-700'
                          : ['PARTIAL_REDUCTION', 'PARTIAL', 'MANUAL_REVIEW'].includes(verifyResult.detailed_result.issue?.status)
                            ? 'text-amber-700'
                            : 'text-rose-700'
                      }`}>
                        {['RESOLVED', 'SUPPORTED', 'MATCH'].includes(verifyResult.detailed_result.issue?.status)
                          ? '✓ RESOLVED'
                          : ['PARTIAL_REDUCTION', 'PARTIAL'].includes(verifyResult.detailed_result.issue?.status)
                            ? '⚠ PARTIAL'
                            : verifyResult.detailed_result.issue?.status === 'MANUAL_REVIEW'
                              ? '⚠ MANUAL REVIEW'
                              : '✕ STILL PRESENT'}
                      </span>
                    </div>
                    <div className="mt-3 p-3 bg-white border border-slate-200 rounded-lg text-slate-700 italic">
                      {verifyResult.detailed_result.reason || 'Evidence verification complete.'}
                    </div>
                  </div>
                ) : (
                  verifyResult.integrity_score != null && (
                    <div className="text-xs text-slate-500 mt-1 text-center">
                      Evidence Integrity Score: <span className="font-bold text-slate-700">{verifyResult.integrity_score.toFixed(1)}</span> / 100
                    </div>
                  )
                )}

                <button
                  onClick={() => {
                    setShowVerifyModal(false);
                    navigate('/worker/dashboard');
                  }}
                  className="w-full py-3 bg-[#0b1d30] text-white font-bold rounded-xl text-xs transition-all shadow-sm"
                >
                  Back to Task Queue
                </button>
              </div>
            ) : (
              <button
                onClick={handleSubmitVerification}
                disabled={!evidencePhoto || isVerifying}
                className="w-full py-3.5 bg-[#0b1d30] hover:bg-[#162e48] disabled:bg-slate-300 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{verifyStatusText || 'Checking submitted evidence...'}</span>
                  </>
                ) : (
                  <span>SUBMIT FOR VERIFICATION</span>
                )}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkerTaskDetailPage;
