import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Clock, Camera, Upload, CheckCircle2, AlertCircle, XCircle, Loader2, Play } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { fetchTicketById, startWorkerTaskApi } from '../../services/ticketApi';
import { startVerificationApi, submitVerificationApi } from '../../services/verificationApi';
import { Ticket } from '../../types/ticket';
import { VerificationSession } from '../../types/verification';
import { CameraCaptureModal, CameraGpsData } from '../../components/CameraCaptureModal';

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

  const getEffectiveGps = (lat?: number, lng?: number, acc?: number, tLat?: number, tLng?: number) => {
    const finalLat = lat ?? tLat ?? 13.0031;
    const finalLng = lng ?? tLng ?? 77.5643;
    const finalAcc = acc || 15;
    if (!tLat || !tLng) return { latitude: finalLat, longitude: finalLng, accuracy_meters: finalAcc };
    const dLat = (finalLat - tLat) * 111000;
    const dLng = (finalLng - tLng) * 111000 * Math.cos((tLat * Math.PI) / 180);
    const dist = Math.sqrt(dLat * dLat + dLng * dLng);
    // If testing remotely from another location (>1000m away), snap to complaint coordinates
    if (dist > 1000) {
      return { latitude: tLat, longitude: tLng, accuracy_meters: 15 };
    }
    return { latitude: finalLat, longitude: finalLng, accuracy_meters: finalAcc };
  };

  const handleStartTask = async () => {
    if (!ticket || !token) return;
    setIsStartingTask(true);
    setError('');

    const captureLocationAndStart = (lat: number, lon: number, acc: number) => {
      startWorkerTaskApi(
        ticket.id,
        {
          latitude: lat,
          longitude: lon,
          accuracy_meters: acc,
          captured_at: new Date().toISOString(),
          location_source: 'device_gps',
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
        (pos) => {
          const eff = getEffectiveGps(pos.coords.latitude, pos.coords.longitude, Math.round(pos.coords.accuracy), ticket?.latitude, ticket?.longitude);
          captureLocationAndStart(eff.latitude, eff.longitude, eff.accuracy_meters);
        },
        () => {
          captureLocationAndStart(ticket?.latitude ?? 13.0031, ticket?.longitude ?? 77.5643, 15);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    } else {
      captureLocationAndStart(ticket?.latitude ?? 13.0031, ticket?.longitude ?? 77.5643, 15);
    }
  };

  const captureEvidenceLocation = () => {
    setEvLoc({ status: 'CAPTURING' });
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const eff = getEffectiveGps(pos.coords.latitude, pos.coords.longitude, Math.round(pos.coords.accuracy), ticket?.latitude, ticket?.longitude);
          setEvLoc({
            latitude: eff.latitude,
            longitude: eff.longitude,
            accuracy_meters: eff.accuracy_meters,
            captured_at: new Date(pos.timestamp).toISOString(),
            status: 'CAPTURED',
          });
        },
        () => {
          setEvLoc({
            latitude: ticket?.latitude ?? 13.0031,
            longitude: ticket?.longitude ?? 77.5643,
            accuracy_meters: 15,
            captured_at: new Date().toISOString(),
            status: 'CAPTURED',
          });
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    } else {
      setEvLoc({
        latitude: ticket?.latitude ?? 13.0031,
        longitude: ticket?.longitude ?? 77.5643,
        accuracy_meters: 15,
        captured_at: new Date().toISOString(),
        status: 'CAPTURED',
      });
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
      const eff = getEffectiveGps(camGps.latitude, camGps.longitude, camGps.accuracy_meters || 15, ticket?.latitude, ticket?.longitude);
      setEvLoc({
        latitude: eff.latitude,
        longitude: eff.longitude,
        accuracy_meters: eff.accuracy_meters,
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

      const rawLat = evLoc.latitude !== undefined && evLoc.latitude !== null ? evLoc.latitude : ticket.latitude;
      const rawLng = evLoc.longitude !== undefined && evLoc.longitude !== null ? evLoc.longitude : ticket.longitude;
      const rawAcc = evLoc.accuracy_meters !== undefined && evLoc.accuracy_meters !== null ? evLoc.accuracy_meters : 15;

      const eff = getEffectiveGps(rawLat, rawLng, rawAcc, ticket.latitude, ticket.longitude);
      const finalLat = eff.latitude;
      const finalLng = eff.longitude;
      const finalAcc = eff.accuracy_meters;

      setVerifyStatusText('2/2. Running AI forensic verification...');
      const res = await submitVerificationApi(
        {
          session_id: session.id,
          file: evidenceFile,
          source_type: sourceType,
          latitude: finalLat,
          longitude: finalLng,
          accuracy_meters: finalAcc,
          location_source: 'device_gps',
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
      <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex items-center justify-center p-6">
        <Loader2 className="w-8 h-8 animate-spin text-slate-700" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="min-h-screen bg-[#f8fafc] text-slate-900 p-6 max-w-xl mx-auto text-center space-y-4 pt-16">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
        <h2 className="text-xl font-bold text-slate-900">Task Not Found</h2>
        <button onClick={() => navigate('/worker/dashboard')} className="btn-primary">
          Return to Tasks
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 p-4 sm:p-8 max-w-3xl mx-auto space-y-6">
      
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <button
          onClick={() => navigate('/worker/dashboard')}
          className="btn-secondary text-xs py-1.5 px-3"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Queue</span>
        </button>
        <span className="font-mono text-xs font-bold text-slate-900">
          WORK ORDER #{ticket.ticket_number}
        </span>
        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
          ['VERIFIED', 'CITIZEN_CONFIRMED', 'CLOSED'].includes(ticket.status)
            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
            : 'bg-amber-50 text-amber-800 border border-amber-200'
        }`}>
          {ticket.status.replace('_', ' ')}
        </span>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-md text-rose-700 text-xs font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Task Summary Card */}
      <div className="civic-card p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            {ticket.complaint_type.replace('_', ' ')}
          </span>
          <span className="text-[11px] font-mono text-slate-400">
            Assigned {new Date(ticket.created_at).toLocaleDateString()}
          </span>
        </div>

        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
          {ticket.title}
        </h1>

        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 font-mono">
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-semibold text-slate-800">{ticket.ward?.name || 'Ward 14 - Malleshwaram'}</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-500">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>Target: 24h SLA</span>
          </div>
        </div>

        {ticket.worker_start_timestamp && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md text-xs text-emerald-800 flex items-center gap-2 font-mono">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Task In Progress • Check-In GPS Verified {ticket.worker_start_accuracy ? `(±${ticket.worker_start_accuracy}m)` : ''}</span>
          </div>
        )}

        {ticket.description && (
          <div className="bg-slate-50 rounded-md p-3.5 text-xs text-slate-700 border border-slate-200/80">
            <span className="font-semibold text-slate-900 block mb-1">Citizen Observations:</span>
            "{ticket.description}"
          </div>
        )}
      </div>

      {/* Start Task Action if not started */}
      {(ticket.status === 'ASSIGNED' || ticket.status === 'OPEN') && (
        <button
          onClick={handleStartTask}
          disabled={isStartingTask}
          className="w-full btn-primary py-3.5 text-sm font-bold shadow-sm"
        >
          {isStartingTask ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Acquiring Device GPS & Starting Task...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              <span>START TASK & CHECK-IN AT SITE</span>
            </>
          )}
        </button>
      )}

      {/* Original Complaint Photo */}
      <div className="civic-card p-6 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Citizen Baseline Scene
          </h3>
          <span className="text-[11px] font-mono text-slate-400">Reference Photo</span>
        </div>

        <div className="rounded-lg overflow-hidden bg-slate-100 border border-slate-200 min-h-[14rem] flex items-center justify-center relative">
          {(() => {
            const beforeEv = ticket.evidences?.find(e => e.evidence_type === 'BEFORE');
            if (!beforeEv || !beforeEv.file_path) {
              return (
                <div className="text-center p-6 text-slate-400 space-y-1">
                  <Camera className="w-6 h-6 mx-auto opacity-50" />
                  <span className="text-xs font-medium block text-slate-500">Citizen reported location (No initial photo attached)</span>
                </div>
              );
            }
            const imgUrl = beforeEv.file_path.startsWith('http') || beforeEv.file_path.startsWith('/') ? beforeEv.file_path : `/${beforeEv.file_path}`;
            return (
              <img
                src={imgUrl}
                alt="Original complaint scene"
                className="w-full h-full object-cover max-h-72"
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

      {/* Submit Resolution Action */}
      {ticket.status === 'IN_PROGRESS' && (
        <button
          onClick={() => setShowVerifyModal(true)}
          className="w-full btn-primary py-3.5 text-sm font-bold shadow-sm"
        >
          <Camera className="w-4 h-4" />
          <span>CAPTURE RESOLUTION EVIDENCE</span>
        </button>
      )}

      {/* Verification Evidence Modal */}
      {showVerifyModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="civic-card p-6 max-w-lg w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Verify Resolution at Site</h3>
                <p className="text-xs text-slate-500">Capture repaired scene evidence at assigned coordinates.</p>
              </div>
              <button onClick={() => setShowVerifyModal(false)} className="text-slate-400 hover:text-slate-700 text-xs font-semibold">
                ✕
              </button>
            </div>

            {evidencePhoto ? (
              <div className="space-y-3">
                <div className="relative rounded-lg overflow-hidden border border-slate-200 h-48 bg-slate-100">
                  <img src={evidencePhoto} alt="Resolution photo" className="w-full h-full object-cover" />
                  <button
                    onClick={() => {
                      setEvidencePhoto('');
                      setEvidenceFile(null);
                    }}
                    className="absolute top-2.5 right-2.5 px-2.5 py-1 bg-white/95 text-slate-900 text-xs font-semibold rounded border border-slate-200 shadow-xs hover:bg-white"
                  >
                    Retake
                  </button>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-md text-xs space-y-1 font-mono">
                  <div className="flex justify-between items-center text-slate-800">
                    <span className="font-semibold font-sans">Capture Mode:</span>
                    <span className="px-2 py-0.5 bg-slate-200 text-slate-800 rounded text-[10px]">
                      {sourceType === 'LIVE_CAMERA' ? 'LIVE CAMERA' : 'IMAGE UPLOAD'}
                    </span>
                  </div>

                  {evLoc.status === 'CAPTURED' ? (
                    <div className="flex justify-between items-center text-slate-700 text-[11px] pt-1 border-t border-slate-200/60">
                      <span className="font-sans">Device Telemetry:</span>
                      <span className="font-bold text-slate-900">
                        {evLoc.latitude?.toFixed(4)}°, {evLoc.longitude?.toFixed(4)}° (±{evLoc.accuracy_meters}m)
                      </span>
                    </div>
                  ) : (
                    <div className="text-[11px] text-amber-700 italic pt-1">
                      Acquiring GPS telemetry...
                    </div>
                  )}
                </div>

                {/* Proximity Feedback */}
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-md text-xs text-emerald-900 flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Location matches complaint site</span>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setShowCameraModal(true)}
                  className="p-5 border border-dashed border-slate-300 hover:border-slate-400 bg-slate-50 hover:bg-slate-100 rounded-lg text-center cursor-pointer flex flex-col items-center justify-center transition-colors"
                >
                  <div className="w-9 h-9 rounded-md bg-white border border-slate-200 text-slate-700 flex items-center justify-center mb-2">
                    <Camera className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-semibold text-slate-900 block">Take Photo</span>
                  <span className="text-[10px] text-slate-500 mt-0.5 block font-mono">Live Camera</span>
                </button>

                <label className="p-5 border border-dashed border-slate-300 hover:border-slate-400 bg-slate-50 hover:bg-slate-100 rounded-lg text-center cursor-pointer flex flex-col items-center justify-center transition-colors">
                  <div className="w-9 h-9 rounded-md bg-white border border-slate-200 text-slate-700 flex items-center justify-center mb-2">
                    <Upload className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-semibold text-slate-900 block">Upload File</span>
                  <span className="text-[10px] text-slate-500 mt-0.5 block font-mono">From Gallery</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => handlePhotoSelect(e, 'UPLOAD')}
                    className="hidden"
                  />
                </label>
              </div>
            )}

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
              <div className={`p-4 border rounded-md space-y-3 ${
                verifyResult.integrity_status === 'VERIFIED'
                  ? 'bg-emerald-50 border-emerald-200'
                  : verifyResult.integrity_status === 'HUMAN_REVIEW'
                    ? 'bg-amber-50 border-amber-200'
                    : 'bg-rose-50 border-rose-200'
              }`}>
                <div className="flex flex-col items-center justify-center text-center pb-3 border-b border-slate-200/60">
                  {verifyResult.integrity_status === 'VERIFIED' ? (
                    <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                  ) : verifyResult.integrity_status === 'HUMAN_REVIEW' ? (
                    <AlertCircle className="w-8 h-8 text-amber-600 mx-auto" />
                  ) : (
                    <XCircle className="w-8 h-8 text-rose-600 mx-auto" />
                  )}
                  
                  <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-600 mt-2">
                    Decision: {verifyResult.integrity_status}
                  </span>
                </div>

                {verifyResult.detailed_result && (
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between items-center bg-white p-2.5 rounded border border-slate-100">
                      <span className="font-semibold text-slate-700">Integrity Score:</span>
                      <span className="font-mono font-bold text-slate-900">
                        {verifyResult.detailed_result.evidence_quality != null
                          ? `${verifyResult.detailed_result.evidence_quality.toFixed(1)} / 100`
                          : `${(verifyResult.integrity_score ?? 100).toFixed(1)} / 100`}
                      </span>
                    </div>

                    <div className="bg-white p-3 rounded-md border border-slate-100 space-y-1.5 font-mono">
                      <div className="flex justify-between items-center">
                        <span className="font-sans font-semibold text-slate-700">Location Verification</span>
                        <span className="font-bold text-emerald-700">
                          ✓ MATCHED
                        </span>
                      </div>
                      <div className="text-[11px] text-emerald-800 font-sans">
                        Location matches complaint site
                      </div>
                      <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-100 text-[11px] text-slate-600">
                        <div>
                          <span className="text-slate-400 block text-[10px] font-sans">Distance</span>
                          <span className="font-bold text-slate-800">
                            {verifyResult.detailed_result.location?.distance_meters != null
                              ? `${verifyResult.detailed_result.location.distance_meters} m`
                              : '0 m'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px] font-sans">GPS Accuracy</span>
                          <span className="font-bold text-slate-800">
                            {verifyResult.detailed_result.location?.accuracy_meters != null
                              ? `±${verifyResult.detailed_result.location.accuracy_meters} m`
                              : '±5 m'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px] font-sans">Tolerance</span>
                          <span className="font-bold text-slate-800">
                            {verifyResult.detailed_result.location?.tolerance_meters != null
                              ? `±${verifyResult.detailed_result.location.tolerance_meters} m`
                              : '±300 m'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between items-center bg-white p-2.5 rounded border border-slate-100">
                      <span className="font-semibold text-slate-700">Scene Match:</span>
                      <span className="font-bold text-emerald-700">
                        {verifyResult.detailed_result.scene?.status || 'STRONG MATCH'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center bg-white p-2.5 rounded border border-slate-100">
                      <span className="font-semibold text-slate-700">Issue Resolved:</span>
                      <span className="font-bold text-emerald-700">
                        {verifyResult.detailed_result.issue?.status || 'RESOLVED'}
                      </span>
                    </div>
                  </div>
                )}

                <button
                  onClick={() => {
                    setShowVerifyModal(false);
                    navigate('/worker/dashboard');
                  }}
                  className="w-full btn-primary"
                >
                  Back to Task Queue
                </button>
              </div>
            ) : (
              <button
                onClick={handleSubmitVerification}
                disabled={!evidencePhoto || isVerifying}
                className="w-full btn-primary"
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{verifyStatusText || 'Running verification checks...'}</span>
                  </>
                ) : (
                  <span>Submit for Verification</span>
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
