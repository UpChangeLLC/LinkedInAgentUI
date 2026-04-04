import { useState, useCallback } from 'react';
import { mockResults } from '../data/mockResults';
import { streamAnalysis, mcpRun, previewProfile } from '../lib/mcp';
import type { PipelineEvent, ProfilePreview } from '../lib/mcp';
import { toMockResults } from '../lib/transform';
import type { MockResults } from '../data/mockResults';

type Page = 'landing' | 'intake' | 'previewing' | 'analyzing' | 'results' | 'error';

export interface PipelineProgress {
  /** 0-100 overall progress */
  progress: number;
  /** Current node being executed or last completed */
  currentNode: string;
  /** Human-readable status message */
  message: string;
  /** Events received so far */
  events: PipelineEvent[];
  /** Partial data extracted so far (name, title, skills count, score) */
  partialData: Record<string, any>;
  /** Total elapsed time in ms */
  elapsedMs: number;
}

const INITIAL_PROGRESS: PipelineProgress = {
  progress: 0,
  currentNode: '',
  message: 'Starting analysis...',
  events: [],
  partialData: {},
  elapsedMs: 0,
};

export function useAppState() {
  const [currentPage, setCurrentPage] = useState<Page>('landing');
  const [formData, setFormData] = useState<any>({});
  const [resultsBackend, setResultsBackend] = useState<any>(null);
  const [resultsComputed, setResultsComputed] = useState<MockResults>(mockResults);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [pipelineProgress, setPipelineProgress] = useState<PipelineProgress>(INITIAL_PROGRESS);
  const [previewData, setPreviewData] = useState<ProfilePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const goToIntake = useCallback(() => {
    setCurrentPage('intake');
    window.scrollTo(0, 0);
  }, []);

  // Submit form: fetch preview first, then show confirmation
  const submitForm = useCallback((data: any) => {
    setFormData(data);
    setPreviewLoading(true);
    setErrorMessage('');
    setCurrentPage('previewing');
    window.scrollTo(0, 0);

    const payload = {
      linkedin_url: data?.linkedinUrl || data?.linkedin_url || '',
      resume_text: data?.resumeText || data?.resume_text || '',
      ...(data?.githubUrl || data?.github_url ? { github_url: data?.githubUrl || data?.github_url } : {}),
      ...(data?.websiteUrl || data?.website_url ? { website_url: data?.websiteUrl || data?.website_url } : {}),
    };

    (async () => {
      try {
        const preview = await previewProfile(payload);
        setPreviewData(preview);
        setPreviewLoading(false);
      } catch (e: any) {
        // If preview fails, skip directly to full analysis
        console.warn('Preview failed, skipping to full analysis:', e?.message);
        setPreviewData(null);
        setPreviewLoading(false);
        startFullAnalysis(data);
      }
    })();
  }, []);

  // Confirm profile and start full analysis
  const confirmProfile = useCallback(() => {
    startFullAnalysis(formData);
  }, [formData]);

  // Reject profile — go back to intake
  const rejectProfile = useCallback(() => {
    setPreviewData(null);
    setCurrentPage('intake');
    window.scrollTo(0, 0);
  }, []);

  // Run the full pipeline (SSE streaming)
  const startFullAnalysis = useCallback((data: any) => {
    setCurrentPage('analyzing');
    setErrorMessage('');
    setPipelineProgress(INITIAL_PROGRESS);
    window.scrollTo(0, 0);

    // Build user_context from intake form answers if provided
    const userContext = data?.userContext || data?.user_context || null;
    const payload = {
      linkedin_url: data?.linkedinUrl || data?.linkedin_url || '',
      resume_text: data?.resumeText || data?.resume_text || '',
      ...(userContext ? { user_context: userContext } : {}),
      ...(data?.githubUrl || data?.github_url ? { github_url: data?.githubUrl || data?.github_url } : {}),
      ...(data?.websiteUrl || data?.website_url ? { website_url: data?.websiteUrl || data?.website_url } : {}),
    };
    const startTime = Date.now();

    (async () => {
      try {
        const resp = await streamAnalysis(payload, (event: PipelineEvent) => {
          setPipelineProgress((prev) => {
            const newEvents = [...prev.events, event];
            const partialData = event.partial_result && Object.keys(event.partial_result).length > 0
              ? { ...prev.partialData, ...event.partial_result }
              : prev.partialData;
            return {
              progress: event.progress || prev.progress,
              currentNode: event.node || prev.currentNode,
              message: event.info || prev.message,
              events: newEvents,
              partialData,
              elapsedMs: Date.now() - startTime,
            };
          });
        });

        if (resp?.status === 'ok') {
          setResultsBackend(resp);
          const transformed = toMockResults(resp?.result || {});
          setResultsComputed(transformed);
          setFormData((prev: any) => ({ ...prev, backend: resp }));
          setPipelineProgress((prev) => ({ ...prev, progress: 100, message: 'Analysis complete!' }));
          setCurrentPage('results');
        } else {
          setResultsBackend(null);
          setErrorMessage('The analysis service did not return a valid result. Please try again.');
          setCurrentPage('error');
        }
      } catch (e: any) {
        setResultsBackend(null);
        setErrorMessage(e?.message || 'The analysis service did not respond. Please try again.');
        setCurrentPage('error');
      }
      window.scrollTo(0, 0);
    })();
  }, []);

  const goToResults = useCallback(() => {
    setCurrentPage('results');
    window.scrollTo(0, 0);
  }, []);

  const goBack = useCallback(() => {
    if (currentPage === 'intake') setCurrentPage('landing');
    if (currentPage === 'previewing') setCurrentPage('intake');
    if (currentPage === 'results') setCurrentPage('landing');
    if (currentPage === 'error') setCurrentPage('landing');
  }, [currentPage]);

  const goToLanding = useCallback(() => {
    setCurrentPage('landing');
  }, []);

  const retrySubmit = useCallback(() => {
    if (formData?.linkedinUrl || formData?.linkedin_url) {
      submitForm(formData);
    } else {
      setCurrentPage('intake');
    }
  }, [formData, submitForm]);

  return {
    currentPage,
    formData,
    results: resultsComputed,
    resultsBackend,
    errorMessage,
    pipelineProgress,
    previewData,
    previewLoading,
    goToIntake,
    submitForm,
    confirmProfile,
    rejectProfile,
    goToResults,
    goBack,
    goToLanding,
    retrySubmit,
  };
}
