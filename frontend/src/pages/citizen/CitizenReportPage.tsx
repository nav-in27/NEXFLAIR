import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2, Droplets, Construction, Trees, CheckCircle2, AlertCircle, Camera, Loader2, MapPin, Navigation, ShieldAlert, Upload } from 'lucide-react';
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
      id: 'WASTE',
      name: 'Waste Management',
      description: 'Missed collection, illegal dumping.',
      icon: Trash2,
      priorityBadge: null,
    },
    {
      id: 'WATER_SEWAGE',
      name: 'Water & Sewage',
      description: 'Leaks, pressure issues, blockages.',
      icon: Droplets,
      priorityBadge: 'HIGH PRIORITY AREA',
    },
    {
      id: 'ROAD_DEFECT',
      name: 'Road Defect',
      description: 'Potholes, damaged signs, lighting.',
      icon: Construction,
      priorityBadge: null,
    },
    {
      id: 'INFRASTRUCTURE',
      name: 'Public Infrastructure',
      description: 'Parks, buildings, public spaces.',
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
          explanation: `Location captured (Accuracy: ±${Math.round(pos.coords.accuracy)} m). Administrative ward automatically detected.`
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
    // Automatically prompt for location on initial page load
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
        explanation: `Location telemetry captured from live camera (Accuracy: ±${camGps.accuracy_meters} m).`,
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
    <div className="min-h-screen bg-[#f9fafb] text-slate-900 font-sans pb-20">
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 space-y-12">
        
        {/* HEADER GREETING */}
        <div className="space-y-2">
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-slate-950">
            Good afternoon.
          </h1>
          <p className="text-xl font-bold text-slate-800">
            What would you like to report?
          </p>
        </div>

        {/* 4 CATEGORY OPTIONS GRID */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {categories.map((cat) => {
            const IconComp = cat.icon;
            const isSelected = selectedCategory === cat.id;

            return (
              <div
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`relative cursor-pointer rounded-2xl p-6 transition-all border flex flex-col justify-between h-44 ${
                  isSelected
                    ? 'bg-[#0047bb] border-[#0047bb] text-white shadow-lg'
                    : 'bg-white border-slate-200 hover:border-slate-300 text-slate-900 shadow-2xs'
                }`}
              >
                {/* Optional Priority Badge */}
                {cat.priorityBadge && (
                  <div className="absolute top-4 right-4">
                    <span className={`px-2 py-0.5 text-[9px] font-bold tracking-wider uppercase rounded ${
                      isSelected ? 'bg-rose-600 text-white' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {cat.priorityBadge}
                    </span>
                  </div>
                )}

                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  isSelected ? 'bg-white/10 text-white' : 'bg-blue-50 text-[#0047bb]'
                }`}>
                  <IconComp className="w-5 h-5" />
                </div>

                <div className="space-y-1">
                  <h3 className={`font-bold text-base ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                    {cat.name}
                  </h3>
                  <p className={`text-xs ${isSelected ? 'text-blue-100' : 'text-slate-500'}`}>
                    {cat.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* SUCCESS MODAL / MESSAGE */}
        {submittedTicketNumber ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 max-w-xl mx-auto text-center space-y-6 shadow-sm">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-slate-900">Complaint Submitted!</h2>
              <p className="text-xs text-slate-500">
                Your report has been received and queued for ward assignment based on your location.
              </p>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm font-bold text-[#0047bb]">
                Ticket #{submittedTicketNumber}
              </div>
            </div>

            <div className="flex justify-center gap-3">
              <button
                onClick={() => navigate(`/track?ticket=${submittedTicketNumber}`)}
                className="px-6 py-2.5 bg-[#0047bb] hover:bg-[#003ca0] text-white text-xs font-bold rounded-lg transition-all"
              >
                Track Status
              </button>
              <button
                onClick={() => {
                  setSubmittedTicketNumber('');
                  setTitle('');
                  setDescription('');
                  setPhotoPreview('');
                }}
                className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg transition-all"
              >
                Report Another
              </button>
            </div>
          </div>
        ) : (
          /* REPORT FORM SECTION */
          <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6 shadow-sm max-w-4xl">
            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3">
              Report Details ({categories.find(c => c.id === selectedCategory)?.name})
            </h2>

            {error && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* AUTOMATIC GEOLOCATION CAPTURE PANEL */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Navigation className="w-4 h-4 text-[#0047bb]" />
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Automatic Location & Ward Verification
                  </h3>
                </div>
                {gpsState.status === 'GPS_CAPTURED' && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    📍 Location Captured
                  </span>
                )}
              </div>

              {gpsState.status === 'CAPTURING' && (
                <div className="flex items-center space-x-2 text-xs text-slate-600 py-2">
                  <Loader2 className="w-4 h-4 animate-spin text-[#0047bb]" />
                  <span>Requesting high-accuracy device location...</span>
                </div>
              )}

              {gpsState.status === 'GPS_CAPTURED' && (
                <div className="space-y-1 bg-white p-3.5 rounded-xl border border-slate-200 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2 font-mono">
                    <span className="font-bold text-slate-900">
                      {gpsState.latitude?.toFixed(4)}° N, {gpsState.longitude?.toFixed(4)}° E
                    </span>
                    <span className="text-slate-500 font-semibold">
                      Accuracy: ±{gpsState.accuracy_meters} m
                    </span>
                  </div>
                  <div className="text-[11px] text-emerald-700 font-medium pt-1 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Ward automatically detected from your GPS coordinates</span>
                  </div>
                </div>
              )}

              {(gpsState.status === 'GPS_PERMISSION_DENIED' || gpsState.status === 'GPS_UNAVAILABLE') && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 space-y-3 text-xs text-rose-800">
                  <div className="flex items-center gap-2 font-bold text-rose-900">
                    <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Location access was not granted</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-rose-700">
                    MEIKAAN uses your current location to identify the affected civic area and verify resolution. Without GPS, your complaint can still be submitted, but location-based verification may require additional review.
                  </p>
                  <div className="flex items-center space-x-3 pt-1">
                    <button
                      type="button"
                      onClick={requestDeviceLocation}
                      className="px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white font-bold rounded-lg text-xs transition-all shadow-2xs"
                    >
                      Try Again
                    </button>
                    <button
                      type="button"
                      onClick={() => setGpsState({ status: 'CONTINUE_WITHOUT_GPS', explanation: 'Submitted without device GPS.' })}
                      className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-semibold rounded-lg text-xs transition-all"
                    >
                      Continue Without GPS
                    </button>
                  </div>
                </div>
              )}

              {gpsState.status === 'CONTINUE_WITHOUT_GPS' && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center justify-between">
                  <span>⚠️ Submitting without live device GPS. Subject to manual administrative review.</span>
                  <button
                    type="button"
                    onClick={requestDeviceLocation}
                    className="text-xs font-bold underline text-amber-900 hover:text-amber-950"
                  >
                    Enable Location
                  </button>
                </div>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              
              {/* Left Column Inputs */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Issue Title / Location Summary
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Stagnant water leak near Main St Community Center"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#0047bb] focus:ring-1 focus:ring-[#0047bb]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Description & Observations
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Describe the severity, duration, or any hazardous conditions..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#0047bb] focus:ring-1 focus:ring-[#0047bb]"
                  />
                </div>
              </div>

              {/* Right Column Photo Upload */}
              <div className="space-y-4">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Attach Photo Evidence
                </label>

                {photoPreview ? (
                  <div className="relative rounded-2xl overflow-hidden border border-slate-200 h-64 bg-slate-100 shadow-inner">
                    <img src={photoPreview} alt="Evidence preview" className="w-full h-full object-cover" />
                    <div className="absolute top-3 left-3 px-3 py-1 bg-black/70 backdrop-blur-xs text-white text-[10px] font-bold rounded-lg uppercase tracking-wider flex items-center gap-1.5 shadow-sm">
                      {photoSource === 'CAMERA' ? (
                        <>
                          <Camera className="w-3 h-3 text-blue-400" />
                          <span>Live Camera Capture</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-3 h-3 text-emerald-400" />
                          <span>Gallery Upload</span>
                        </>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setPhotoPreview('');
                      }}
                      className="absolute top-3 right-3 px-3 py-1.5 bg-white/95 hover:bg-white text-slate-900 text-xs font-bold rounded-xl shadow-md border border-slate-200 transition-all"
                    >
                      Change Photo
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 h-64">
                    {/* Option 1: Live Camera Capture */}
                    <button
                      type="button"
                      onClick={() => setShowCameraModal(true)}
                      className="border-2 border-dashed border-blue-200 hover:border-blue-500 bg-blue-50/40 hover:bg-blue-50/90 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all group shadow-2xs"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-blue-100/80 text-blue-700 flex items-center justify-center mb-3 group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
                        <Camera className="w-6 h-6" />
                      </div>
                      <span className="text-xs font-bold text-slate-900 block">TAKE PHOTO</span>
                      <span className="text-[10px] text-slate-500 mt-1 block">Live Camera / Webcam</span>
                    </button>

                    {/* Option 2: Gallery Upload */}
                    <label className="border-2 border-dashed border-slate-300 hover:border-slate-500 bg-slate-50 hover:bg-slate-100 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all group shadow-2xs">
                      <div className="w-12 h-12 rounded-2xl bg-slate-200/80 text-slate-700 flex items-center justify-center mb-3 group-hover:scale-110 group-hover:bg-slate-700 group-hover:text-white transition-all shadow-sm">
                        <Upload className="w-6 h-6" />
                      </div>
                      <span className="text-xs font-bold text-slate-900 block">UPLOAD PHOTO</span>
                      <span className="text-[10px] text-slate-500 mt-1 block">From Device / Gallery</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handlePhotoSelect}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}

                {/* Camera Capture Modal */}
                <CameraCaptureModal
                  isOpen={showCameraModal}
                  onClose={() => setShowCameraModal(false)}
                  onCapture={handleCameraCapture}
                  onFallbackUpload={() => {
                    // Triggers fallback upload prompt
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

            {/* Submit Button */}
            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-8 py-3.5 bg-[#0047bb] hover:bg-[#003ca0] text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Submitting Report...</span>
                  </>
                ) : (
                  <span>Submit Complaint Report</span>
                )}
              </button>
            </div>
          </form>
        )}

        {/* RECENT AREA REPORTS SECTION */}
        <div className="pt-8 border-t border-slate-200 space-y-4">
          <h2 className="text-base font-bold text-slate-900">
            Recent Area Reports
          </h2>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between shadow-2xs hover:bg-slate-50 transition-colors">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <span className="text-sm font-bold text-slate-900 block">
                  Pothole Repaired on Main St.
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  MK-10480 • 2 hours ago
                </span>
              </div>
            </div>

            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
              Resolved
            </span>
          </div>
        </div>

      </main>

    </div>
  );
};

export default CitizenReportPage;
