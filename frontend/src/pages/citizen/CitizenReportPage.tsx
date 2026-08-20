import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2, Droplets, AlertTriangle, Trees, CheckCircle2, AlertCircle, Camera, Loader2, MapPin, Navigation, ShieldAlert, Upload, ArrowRight, RefreshCw } from 'lucide-react';
import { createPublicCitizenReport } from '../../services/ticketApi';
import { CameraCaptureModal, CameraGpsData } from '../../components/CameraCaptureModal';

interface GpsState {
  latitude?: number;
  longitude?: number;
  accuracy_meters?: number;
  captured_at?: string;
  status: 'IDLE' | 'CAPTURING' | 'GPS_CAPTURED' | 'GPS_PERMISSION_DENIED' | 'GPS_UNAVAILABLE' | 'CONTINUE_WITHOUT_GPS';
  explanation?: string;
}

export const CitizenReportPage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState<string>('WATER_SEWAGE');
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [photoSource, setPhotoSource] = useState<'CAMERA' | 'GALLERY'>('GALLERY');
  const [showCameraModal, setShowCameraModal] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [submittedTicketNumber, setSubmittedTicketNumber] = useState<string>('');

  const [gpsState, setGpsState] = useState<GpsState>({ status: 'IDLE' });

  const categories = [
    {
      id: 'WATER_SEWAGE',
      name: 'Water & Sewage',
      description: 'Leaks, drainage, water supply contamination.',
      icon: Droplets,
      priorityBadge: 'HIGH PRIORITY',
    },
    {
      id: 'ROAD_DEFECT',
      name: 'Road Infrastructure',
      description: 'Potholes, broken asphalt, damaged signage.',
      icon: AlertTriangle,
      priorityBadge: null,
    },
    {
      id: 'WASTE',
      name: 'Waste & Sanitation',
      description: 'Illegal dumping, overflow, missed collection.',
      icon: Trash2,
      priorityBadge: null,
    },
    {
      id: 'INFRASTRUCTURE',
      name: 'Public Assets',
      description: 'Parks, lighting, damaged public structures.',
      icon: Trees,
      priorityBadge: null,
    },
  ];

  const requestDeviceLocation = () => {
    if (!navigator.geolocation) {
      setGpsState({
        status: 'GPS_UNAVAILABLE',
        explanation: 'Browser does not support Geolocation API.'
      });
      return;
    }

    setGpsState({ status: 'CAPTURING' });

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsState({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy_meters: Math.round(pos.coords.accuracy),
          captured_at: new Date(pos.timestamp).toISOString(),
          status: 'GPS_CAPTURED',
          explanation: `Location telemetry acquired (±${Math.round(pos.coords.accuracy)}m accuracy).`
        });
      },
      (err) => {
        let statusStr: 'GPS_PERMISSION_DENIED' | 'GPS_UNAVAILABLE' = 'GPS_UNAVAILABLE';
        let explainStr = 'Location access failed or timed out.';
        if (err.code === err.PERMISSION_DENIED) {
          statusStr = 'GPS_PERMISSION_DENIED';
          explainStr = 'Location access was not granted by browser/device.';
        }
        setGpsState({
          status: statusStr,
          explanation: explainStr
        });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  useEffect(() => {
    requestDeviceLocation();
  }, []);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
        setPhotoSource('GALLERY');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCameraCapture = (_file: File, previewUrl: string, camGps?: CameraGpsData) => {
    setPhotoPreview(previewUrl);
    setPhotoSource('CAMERA');
    if (camGps && camGps.status === 'GPS_CAPTURED' && camGps.latitude && camGps.longitude) {
      setGpsState({
        latitude: camGps.latitude,
        longitude: camGps.longitude,
        accuracy_meters: camGps.accuracy_meters,
        captured_at: camGps.captured_at,
        status: 'GPS_CAPTURED',
        explanation: `Location telemetry captured from live camera (±${camGps.accuracy_meters}m).`,
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const categoryObj = categories.find((c) => c.id === selectedCategory);
      const reportTitle = title.trim() || `${categoryObj?.name || 'Civic'} Issue`;
      const fullDescription = description.trim() ? `${reportTitle} - ${description.trim()}` : reportTitle;

      const res = await createPublicCitizenReport({
        complaint_type: selectedCategory,
        description: fullDescription,
        latitude: gpsState.latitude,
        longitude: gpsState.longitude,
        accuracy_meters: gpsState.accuracy_meters,
        captured_at: gpsState.captured_at,
        location_source: gpsState.status === 'GPS_CAPTURED' ? 'device_gps' : 'unavailable',
        location_status: gpsState.status === 'GPS_CAPTURED' ? 'GPS_CAPTURED' : 'GPS_UNAVAILABLE',
        photo_base64: photoPreview || undefined,
      });

      setSubmittedTicketNumber(res.ticket_number);
    } catch (err: any) {
      setError(err.message || 'Failed to submit report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans pb-20">
      
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        
        {/* Page Header */}
        <div className="border-b border-slate-200 pb-5">
          <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-500 block mb-1">
            Municipal Defect Registry
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Report a civic problem
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Complaints are recorded with GPS telemetry and assigned to ward field teams for verified resolution.
          </p>
        </div>

        {/* SUCCESS CONFIRMATION MODAL */}
        {submittedTicketNumber ? (
          <div className="civic-card p-8 text-center space-y-5 max-w-lg mx-auto">
            <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto border border-emerald-200">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-xl font-bold text-slate-900">Complaint Registered</h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                Your report has been assigned a cryptographic ticket. You can track physical progress and forensic verification anytime.
              </p>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-md font-mono text-sm font-bold text-slate-900 mt-3">
                Ticket #{submittedTicketNumber}
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-3 pt-2">
              <button
                onClick={() => navigate(`/track?ticket=${submittedTicketNumber}`)}
                className="btn-primary"
              >
                <span>Track Complaint Status</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setSubmittedTicketNumber('');
                  setTitle('');
                  setDescription('');
                  setPhotoPreview('');
                }}
                className="btn-secondary"
              >
                Submit Another Report
              </button>
            </div>
          </div>
        ) : (
          /* REPORT FORM */
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {error && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-md text-rose-700 text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* STEP 1: CATEGORY SELECTION */}
            <div className="civic-card p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  1. Issue Category
                </h2>
                <span className="text-[11px] text-slate-400 font-mono">Select matching civic domain</span>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                {categories.map((cat) => {
                  const IconComp = cat.icon;
                  const isSelected = selectedCategory === cat.id;

                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`text-left p-4 rounded-lg border transition-all flex items-start gap-3.5 ${
                        isSelected
                          ? 'bg-slate-900 border-slate-900 text-white shadow-sm'
                          : 'bg-white border-slate-200 hover:border-slate-300 text-slate-900'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-700'
                      }`}>
                        <IconComp className="w-4 h-4" />
                      </div>

                      <div className="space-y-0.5 flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-bold block ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                            {cat.name}
                          </span>
                          {cat.priorityBadge && (
                            <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold ${
                              isSelected ? 'bg-rose-500 text-white' : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}>
                              {cat.priorityBadge}
                            </span>
                          )}
                        </div>
                        <p className={`text-[11px] leading-relaxed ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                          {cat.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* STEP 2: LOCATION TELEMETRY */}
            <div className="civic-card p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                  <Navigation className="w-3.5 h-3.5 text-blue-600" />
                  <span>2. Location Telemetry</span>
                </h2>
                {gpsState.status === 'GPS_CAPTURED' && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    GPS ACQUIRED
                  </span>
                )}
              </div>

              {gpsState.status === 'CAPTURING' && (
                <div className="flex items-center gap-2 text-xs text-slate-600 py-1 font-mono">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-700" />
                  <span>Acquiring precise geographic coordinates...</span>
                </div>
              )}

              {gpsState.status === 'GPS_CAPTURED' && (
                <div className="bg-slate-50 border border-slate-200 rounded-md p-3.5 text-xs font-mono space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-slate-800">
                    <span className="font-semibold">
                      LAT: {gpsState.latitude?.toFixed(5)}° N, LNG: {gpsState.longitude?.toFixed(5)}° E
                    </span>
                    <span className="text-slate-500">
                      Accuracy: ±{gpsState.accuracy_meters}m
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-sans flex items-center justify-between pt-1 border-t border-slate-200/60">
                    <span className="flex items-center gap-1 text-emerald-700">
                      <MapPin className="w-3 h-3 text-emerald-600" />
                      Ward automatically assigned based on coordinates
                    </span>
                    <button
                      type="button"
                      onClick={requestDeviceLocation}
                      className="text-slate-600 hover:text-slate-900 font-sans text-xs underline flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Recalibrate
                    </button>
                  </div>
                </div>
              )}

              {(gpsState.status === 'GPS_PERMISSION_DENIED' || gpsState.status === 'GPS_UNAVAILABLE') && (
                <div className="bg-slate-50 border border-slate-200 rounded-md p-4 space-y-2 text-xs text-slate-700">
                  <div className="flex items-center gap-2 font-semibold text-slate-900">
                    <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Location signal unavailable</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-500">
                    Device location helps assign the correct municipal ward automatically. You can retry or proceed with default ward routing.
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={requestDeviceLocation}
                      className="btn-secondary text-xs py-1 px-3"
                    >
                      Retry GPS
                    </button>
                    <button
                      type="button"
                      onClick={() => setGpsState({ status: 'CONTINUE_WITHOUT_GPS', explanation: 'Submitted without device GPS.' })}
                      className="text-slate-600 hover:text-slate-900 text-xs underline px-2 py-1"
                    >
                      Continue without GPS
                    </button>
                  </div>
                </div>
              )}

              {gpsState.status === 'CONTINUE_WITHOUT_GPS' && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-600 flex items-center justify-between">
                  <span>Location not captured. Report will be routed through central intake.</span>
                  <button
                    type="button"
                    onClick={requestDeviceLocation}
                    className="text-xs font-semibold text-blue-700 hover:underline"
                  >
                    Acquire GPS
                  </button>
                </div>
              )}
            </div>

            {/* STEP 3: DETAILS & PHOTO EVIDENCE */}
            <div className="civic-card p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  3. Description & Initial Evidence
                </h2>
                <span className="text-[11px] text-slate-400 font-mono">Baseline evidence image</span>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                
                {/* Inputs */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Location / Defect Title
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Water leak near Ward 14 Health Center"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="civic-input"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Observations & Additional Context
                    </label>
                    <textarea
                      rows={4}
                      placeholder="Describe the severity, duration, or any hazardous conditions for the field team..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="civic-input resize-none"
                    />
                  </div>
                </div>

                {/* Evidence Image Upload / Camera */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Initial Photo Evidence
                  </label>

                  {photoPreview ? (
                    <div className="relative rounded-lg overflow-hidden border border-slate-200 h-52 bg-slate-100">
                      <img src={photoPreview} alt="Evidence preview" className="w-full h-full object-cover" />
                      <div className="absolute top-2.5 left-2.5 px-2.5 py-1 bg-black/75 text-white text-[10px] font-mono rounded font-medium flex items-center gap-1.5">
                        {photoSource === 'CAMERA' ? (
                          <>
                            <Camera className="w-3 h-3 text-blue-400" />
                            <span>Camera Capture</span>
                          </>
                        ) : (
                          <>
                            <Upload className="w-3 h-3 text-emerald-400" />
                            <span>Image Upload</span>
                          </>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setPhotoPreview('')}
                        className="absolute top-2.5 right-2.5 px-2.5 py-1 bg-white/95 text-slate-900 text-xs font-semibold rounded border border-slate-200 shadow-xs hover:bg-white"
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 h-52">
                      <button
                        type="button"
                        onClick={() => setShowCameraModal(true)}
                        className="border border-dashed border-slate-300 hover:border-slate-400 bg-slate-50 hover:bg-slate-100/80 rounded-lg p-4 flex flex-col items-center justify-center text-center transition-colors"
                      >
                        <div className="w-9 h-9 rounded-md bg-white border border-slate-200 text-slate-700 flex items-center justify-center mb-2">
                          <Camera className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-semibold text-slate-900 block">Take Photo</span>
                        <span className="text-[10px] text-slate-500 mt-0.5 block font-mono">Live Camera</span>
                      </button>

                      <label className="border border-dashed border-slate-300 hover:border-slate-400 bg-slate-50 hover:bg-slate-100/80 rounded-lg p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-colors">
                        <div className="w-9 h-9 rounded-md bg-white border border-slate-200 text-slate-700 flex items-center justify-center mb-2">
                          <Upload className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-semibold text-slate-900 block">Upload File</span>
                        <span className="text-[10px] text-slate-500 mt-0.5 block font-mono">JPG, PNG</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={handlePhotoSelect}
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
                      inputEl.onchange = (ev: any) => handlePhotoSelect(ev);
                      inputEl.click();
                    }}
                    title="Citizen Report Evidence Capture"
                  />
                </div>

              </div>
            </div>

            {/* SUBMIT BUTTON */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-400 font-mono">
                Cryptographic timestamp & hash assigned upon submission
              </span>

              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Submitting Complaint...</span>
                  </>
                ) : (
                  <span>Submit Complaint</span>
                )}
              </button>
            </div>

          </form>
        )}

      </main>

    </div>
  );
};

export default CitizenReportPage;
