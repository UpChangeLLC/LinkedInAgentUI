import React, { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Download, Share2, FileText, Award, Loader2, ExternalLink, CheckCircle2 } from 'lucide-react';

interface ExportSectionProps {
  runId: string;
  results: {
    score: number;
    personalProfile?: {
      name: string;
      title: string;
      industry?: string;
    };
    riskBand?: string;
  };
}

const API_BASE = (import.meta as any).env?.VITE_MCP_BASE_URL || '';

async function downloadBlob(url: string, fallbackFilename: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download failed: ${response.statusText}`);
  }
  const blob = await response.blob();

  // Extract filename from content-disposition if available
  const disposition = response.headers.get('content-disposition');
  let filename = fallbackFilename;
  if (disposition) {
    const match = disposition.match(/filename="?([^";\n]+)"?/);
    if (match) filename = match[1];
  }

  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(objectUrl);
}

export function ExportSection({ runId, results }: ExportSectionProps) {
  const [pdfLoading, setPdfLoading] = useState(false);
  const [certLoading, setCertLoading] = useState(false);
  const [pdfDone, setPdfDone] = useState(false);
  const [certDone, setCertDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [certPreview, setCertPreview] = useState<string | null>(null);

  const name = results.personalProfile?.name || 'You';
  const title = results.personalProfile?.title || '';

  // Load certificate preview thumbnail
  useEffect(() => {
    if (!runId) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`${API_BASE}/api/certificates/${runId}`);
        if (!response.ok) return;
        const blob = await response.blob();
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        setCertPreview(url);
      } catch {
        // Preview is optional — silently ignore errors
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [runId]);

  const handleDownloadPdf = useCallback(async () => {
    if (!runId) return;
    setError(null);
    setPdfLoading(true);
    setPdfDone(false);
    try {
      await downloadBlob(
        `${API_BASE}/api/reports/${runId}/pdf`,
        `AI_Resilience_Report_${name.replace(/\s+/g, '_')}.pdf`
      );
      setPdfDone(true);
      setTimeout(() => setPdfDone(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to download PDF report.');
    } finally {
      setPdfLoading(false);
    }
  }, [runId, name]);

  const handleDownloadCert = useCallback(async () => {
    if (!runId) return;
    setError(null);
    setCertLoading(true);
    setCertDone(false);
    try {
      await downloadBlob(
        `${API_BASE}/api/certificates/${runId}`,
        `AI_Resilience_Certificate_${name.replace(/\s+/g, '_')}.png`
      );
      setCertDone(true);
      setTimeout(() => setCertDone(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to download certificate.');
    } finally {
      setCertLoading(false);
    }
  }, [runId, name]);

  const handleShareLinkedIn = useCallback(() => {
    const certUrl = `${window.location.origin}/api/certificates/${runId}`;
    const text = encodeURIComponent(
      `I scored ${results.score} on the AI Resilience Score assessment! ${name} - ${title}. Check your own AI readiness:`
    );
    const shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(certUrl)}&summary=${text}`;
    window.open(shareUrl, '_blank', 'noopener,noreferrer');
  }, [runId, results.score, name, title]);

  if (!runId) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-linkedin/10 flex items-center justify-center">
            <FileText className="w-5 h-5 text-linkedin" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">Export & Share</h3>
            <p className="text-sm text-gray-500">Download your report or share your certificate</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* PDF Report */}
          <button
            onClick={handleDownloadPdf}
            disabled={pdfLoading}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pdfLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : pdfDone ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            ) : (
              <Download className="w-4 h-4 text-linkedin" />
            )}
            {pdfDone ? 'Downloaded!' : 'Full Report (PDF)'}
          </button>

          {/* Certificate Download */}
          <button
            onClick={handleDownloadCert}
            disabled={certLoading}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {certLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : certDone ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            ) : (
              <Award className="w-4 h-4 text-linkedin" />
            )}
            {certDone ? 'Downloaded!' : 'Certificate (PNG)'}
          </button>

          {/* Share on LinkedIn */}
          <button
            onClick={handleShareLinkedIn}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-linkedin text-white hover:bg-linkedin-dark transition-colors text-sm font-medium"
          >
            <Share2 className="w-4 h-4" />
            Share on LinkedIn
            <ExternalLink className="w-3 h-3 opacity-70" />
          </button>
        </div>
      </div>

      {/* Certificate Preview */}
      {certPreview && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Certificate Preview</h4>
          <div className="rounded-lg overflow-hidden border border-gray-100 shadow-sm">
            <img
              src={certPreview}
              alt="AI Resilience Certificate"
              className="w-full h-auto"
            />
          </div>
        </div>
      )}
    </motion.div>
  );
}
