import { useState, useCallback, useRef } from 'react';
import { mockResults } from '../data/mockResults';
import { streamAnalysis, mcpRun, previewProfile, fetchCachedResult } from '../lib/mcp';
import type { PipelineEvent, ProfilePreview } from '../lib/mcp';
import { toMockResults } from '../lib/transform';
import { hashLinkedInUrl } from '../lib/urlHash';
import type { MockResults } from '../data/mockResults';

type Page = 'landing' | 'intake' | 'previewing' | 'analyzing' | 'results' | 'error' | 'cached-prompt';

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
  const [currentPage, setCurrentPage] = useState<Page>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('linkedin_url') || params.get('linkedin_error') || params.get('start_analysis')) {
      return 'intake';
    }
    return 'landing';
  });
  const [formData, setFormData] = useState<any>({});
  const [resultsBackend, setResultsBackend] = useState<any>(null);
  const [resultsComputed, setResultsComputed] = useState<MockResults>(mockResults);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [errorType, setErrorType] = useState<string>('');
  const [pipelineProgress, setPipelineProgress] = useState<PipelineProgress>(INITIAL_PROGRESS);
  const [previewData, setPreviewData] = useState<ProfilePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [cachedResult, setCachedResult] = useState<any>(null);
  const [cachedResultAge, setCachedResultAge] = useState<string | null>(null);

  // AbortController for request deduplication — cancels previous in-flight request
  const abortRef = useRef<AbortController | null>(null);
  // SSE event throttle refs — batch events via requestAnimationFrame
  const pendingEventsRef = useRef<PipelineEvent[]>([]);
  const rafIdRef = useRef<number>(0);
  const freshAbort = useCallback(() => {
    // Cancel any pending RAF when aborting
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = 0;
      pendingEventsRef.current = [];
    }
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    return ac;
  }, []);

  const goToIntake = useCallback(() => {
    setCurrentPage('intake');
    window.scrollTo(0, 0);
  }, []);

  // Submit form: check cache first, then fetch preview or show confirmation
  const submitForm = useCallback((data: any) => {
    const ac = freshAbort();
    setFormData(data);
    setPreviewLoading(true);
    setErrorMessage('');
    setCachedResult(null);
    setCachedResultAge(null);
    window.scrollTo(0, 0);

    const linkedinUrl = data?.linkedinUrl || data?.linkedin_url || '';
    const bypassCache = Boolean(data?._bypassCache);

    const payload = {
      linkedin_url: linkedinUrl,
      resume_text: data?.resumeText || data?.resume_text || '',
      ...(data?.linkedinOAuthProfile || data?.linkedin_oauth_profile
        ? { linkedin_oauth_profile: data?.linkedinOAuthProfile || data?.linkedin_oauth_profile }
        : {}),
      ...(data?.githubUrl || data?.github_url ? { github_url: data?.githubUrl || data?.github_url } : {}),
      ...(data?.websiteUrl || data?.website_url ? { website_url: data?.websiteUrl || data?.website_url } : {}),
    };

    (async () => {
      try {
        // Check for cached results first unless caller requests a fresh run
        if (linkedinUrl && !bypassCache) {
          try {
            const urlHash = await hashLinkedInUrl(linkedinUrl);
            const cached = await fetchCachedResult(urlHash);
            if (cached.status === 'hit' && cached.result) {
              setCachedResult(cached.result);
              setCachedResultAge(cached.created_at || null);
              setPreviewLoading(false);
              setCurrentPage('cached-prompt');
              return;
            }
          } catch {
            // Cache check failed, proceed with normal flow
          }
        }

        // No cache hit — proceed with preview
        setCurrentPage('previewing');
        try {
          const preview = await previewProfile(payload, ac.signal);
          setPreviewData(preview);
          setPreviewLoading(false);
        } catch (e: any) {
          if (e?.name === 'AbortError') return; // Intentional cancellation
          // If preview fails, skip directly to full analysis
          console.warn('Preview failed, skipping to full analysis:', e?.message);
          setPreviewData(null);
          setPreviewLoading(false);
          startFullAnalysis(data);
        }
      } catch (e: any) {
        if (e?.name === 'AbortError') return; // Intentional cancellation
      }
    })();
  }, [freshAbort]);

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
    const ac = freshAbort();
    setCurrentPage('analyzing');
    setErrorMessage('');
    setPipelineProgress(INITIAL_PROGRESS);
    window.scrollTo(0, 0);

    // Build user_context from intake form answers if provided
    const userContext = data?.userContext || data?.user_context || null;
    const payload = {
      linkedin_url: data?.linkedinUrl || data?.linkedin_url || '',
      resume_text: data?.resumeText || data?.resume_text || '',
      ...(data?.linkedinOAuthProfile || data?.linkedin_oauth_profile
        ? { linkedin_oauth_profile: data?.linkedinOAuthProfile || data?.linkedin_oauth_profile }
        : {}),
      ...(userContext ? { user_context: userContext } : {}),
      ...(data?.githubUrl || data?.github_url ? { github_url: data?.githubUrl || data?.github_url } : {}),
      ...(data?.websiteUrl || data?.website_url ? { website_url: data?.websiteUrl || data?.website_url } : {}),
    };
    const startTime = Date.now();

    (async () => {
      try {
        const resp = await streamAnalysis(payload, (event: PipelineEvent) => {
          // Buffer events and flush via requestAnimationFrame to avoid render thrashing
          pendingEventsRef.current.push(event);
          if (!rafIdRef.current) {
            rafIdRef.current = requestAnimationFrame(() => {
              const batch = pendingEventsRef.current;
              pendingEventsRef.current = [];
              rafIdRef.current = 0;
              if (batch.length === 0) return;
              setPipelineProgress((prev) => {
                let events = prev.events;
                let partialData = prev.partialData;
                let progress = prev.progress;
                let currentNode = prev.currentNode;
                let message = prev.message;
                for (const evt of batch) {
                  events = [...events, evt];
                  if (evt.partial_result && Object.keys(evt.partial_result).length > 0) {
                    partialData = { ...partialData, ...evt.partial_result };
                  }
                  progress = evt.progress || progress;
                  currentNode = evt.node || currentNode;
                  message = evt.info || message;
                }
                return { progress, currentNode, message, events, partialData, elapsedMs: Date.now() - startTime };
              });
            });
          }
        }, ac.signal);

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
        if (e?.name === 'AbortError') return; // Intentional cancellation
        setResultsBackend(null);
        setErrorMessage(e?.message || 'The analysis service did not respond. Please try again.');
        setErrorType(e?.errorType || '');
        setCurrentPage('error');
      }
      window.scrollTo(0, 0);
    })();
  }, []);

  // Use cached result — skip pipeline entirely
  const useCachedResult = useCallback(() => {
    if (cachedResult) {
      const transformed = toMockResults(cachedResult);
      setResultsComputed(transformed);
      setResultsBackend({ status: 'ok', result: cachedResult });
      setFormData((prev: any) => ({ ...prev, backend: { status: 'ok', result: cachedResult } }));
      setCurrentPage('results');
      window.scrollTo(0, 0);
    }
  }, [cachedResult]);

  // Skip cache — run fresh analysis via normal preview flow
  const skipCachedResult = useCallback(() => {
    const ac = freshAbort();
    setCachedResult(null);
    setCachedResultAge(null);
    setPreviewLoading(true);
    setCurrentPage('previewing');
    window.scrollTo(0, 0);

    const linkedinUrl = formData?.linkedinUrl || formData?.linkedin_url || '';
    const payload = {
      linkedin_url: linkedinUrl,
      resume_text: formData?.resumeText || formData?.resume_text || '',
      ...(formData?.linkedinOAuthProfile || formData?.linkedin_oauth_profile
        ? { linkedin_oauth_profile: formData?.linkedinOAuthProfile || formData?.linkedin_oauth_profile }
        : {}),
      ...(formData?.githubUrl || formData?.github_url ? { github_url: formData?.githubUrl || formData?.github_url } : {}),
      ...(formData?.websiteUrl || formData?.website_url ? { website_url: formData?.websiteUrl || formData?.website_url } : {}),
    };

    (async () => {
      try {
        const preview = await previewProfile(payload, ac.signal);
        setPreviewData(preview);
        setPreviewLoading(false);
      } catch (e: any) {
        if (e?.name === 'AbortError') return; // Intentional cancellation
        console.warn('Preview failed, skipping to full analysis:', e?.message);
        setPreviewData(null);
        setPreviewLoading(false);
        startFullAnalysis(formData);
      }
    })();
  }, [formData]);

  const goToResults = useCallback(() => {
    setCurrentPage('results');
    window.scrollTo(0, 0);
  }, []);

  const goBack = useCallback(() => {
    if (currentPage === 'intake') setCurrentPage('landing');
    if (currentPage === 'previewing') setCurrentPage('intake');
    if (currentPage === 'cached-prompt') setCurrentPage('intake');
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
    errorType,
    pipelineProgress,
    previewData,
    previewLoading,
    cachedResult,
    cachedResultAge,
    goToIntake,
    submitForm,
    confirmProfile,
    rejectProfile,
    useCachedResult,
    skipCachedResult,
    goToResults,
    goBack,
    goToLanding,
    retrySubmit,
  };
}
