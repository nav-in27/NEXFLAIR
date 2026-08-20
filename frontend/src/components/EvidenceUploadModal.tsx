import React, { useState } from 'react';
import { EvidenceType, SourceType } from '../types/evidence';
import { uploadEvidenceApi } from '../services/evidenceApi';
import { useAuth } from '../context/AuthContext';
import { X, Upload, Camera, AlertCircle, CheckCircle2, Loader2, Image as ImageIcon, ShieldAlert } from 'lucide-react';

interface Props {
  ticketId: string;
  onClose: () => void;
  onRefresh: () => void;
}

export const EvidenceUploadModal: React.FC<Props> = ({ ticketId, onClose, onRefresh }) => {
  const { token } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [evidenceType, setEvidenceType] = useState<EvidenceType>('BEFORE');
  const [sourceType, setSourceType] = useState<SourceType>('UPLOAD');
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      if (selected.size > 10 * 1024 * 1024) {
        setErrorMsg('File size exceeds maximum allowed limit of 10MB.');
        return;
      }
      setFile(selected);
      setPreviewUrl(URL.createObjectURL(selected));
      setErrorMsg(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !file) {
      setErrorMsg('Please select an evidence image file.');
      return;
    }

    setIsUploading(true);
    setErrorMsg(null);

    try {
      await uploadEvidenceApi(
        {
          ticket_id: ticketId,
          file,
          evidence_type: evidenceType,
          source_type: sourceType,
        },
        token
      );
      setUploadSuccess(true);
      setTimeout(() => {
        onRefresh();
        onClose();
      }, 1200);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('Evidence upload failed.');
      }
    } finally {
      setIsUploading(false);
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
            <Upload className="w-3.5 h-3.5" />
            <span>Civic Evidence Ingestion</span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">Submit Ticket Evidence</h2>
        </div>

        {/* Success Alert */}
        {uploadSuccess && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center space-x-2 animate-bounce">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>Evidence uploaded & SHA-256 hash computed successfully!</span>
          </div>
        )}

        {/* Error Alert */}
        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Evidence Type Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 block">Evidence Category</label>
            <div className="grid grid-cols-3 gap-2">
              {(['BEFORE', 'AFTER', 'LIVE_VERIFICATION'] as EvidenceType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setEvidenceType(type)}
                  className={`py-2 px-2.5 rounded-xl text-[11px] font-bold border transition-all truncate ${
                    evidenceType === type
                      ? 'bg-sky-500/20 text-sky-300 border-sky-500/50 shadow-sm'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Source Type Selection */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300">Ingestion Source Type</label>
              <span className="text-[10px] text-amber-400 font-mono flex items-center space-x-1">
                <ShieldAlert className="w-3 h-3" />
                <span>Strict Provenance Enforced</span>
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSourceType('UPLOAD')}
                className={`py-2 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center space-x-2 transition-all ${
                  sourceType === 'UPLOAD'
                    ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50'
                    : 'bg-slate-900 text-slate-400 border-slate-800'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>FILE UPLOAD</span>
              </button>

              <button
                type="button"
                onClick={() => setSourceType('LIVE_CAMERA')}
                className={`py-2 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center space-x-2 transition-all ${
                  sourceType === 'LIVE_CAMERA'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                    : 'bg-slate-900 text-slate-400 border-slate-800'
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                <span>LIVE CAMERA</span>
              </button>
            </div>

            <p className="text-[10px] text-slate-500 italic bg-slate-950 p-2 rounded-lg border border-slate-900">
              ⚠️ Provenance Note: Uploaded files are tagged with <strong className="text-indigo-400">UPLOAD</strong> source. Never pretend uploaded evidence is live camera evidence.
            </p>
          </div>

          {/* Image Upload Dropzone / File Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 block">Select Image File</label>
            <label className="border-2 border-dashed border-slate-800 hover:border-sky-500/50 rounded-2xl p-4 flex flex-col items-center justify-center cursor-pointer transition-colors bg-slate-950/60">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
                className="hidden"
              />
              {previewUrl ? (
                <div className="space-y-2 text-center w-full">
                  <img
                    src={previewUrl}
                    alt="Evidence Preview"
                    className="max-h-40 mx-auto rounded-xl border border-slate-800 object-cover"
                  />
                  <p className="text-xs font-mono text-sky-400 truncate max-w-xs mx-auto">{file?.name}</p>
                  <p className="text-[10px] text-slate-500">
                    Size: {file ? (file.size / (1024 * 1024)).toFixed(2) : 0} MB • Click to replace
                  </p>
                </div>
              ) : (
                <div className="text-center space-y-2 py-4">
                  <ImageIcon className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-xs font-medium text-slate-300">Click or drop evidence photo here</p>
                  <p className="text-[10px] font-mono text-slate-500">JPG, PNG, WEBP (Max 10MB)</p>
                </div>
              )}
            </label>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUploading || !file}
              className="px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-bold text-xs shadow-md shadow-sky-500/20 transition-all disabled:opacity-40 flex items-center space-x-1.5"
            >
              {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              <span>Upload Evidence</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
