import { useEffect, useState, useCallback } from 'react';
import { mockResults } from '../data/mockResults';
import { streamAnalysis, previewProfile, fetchCachedResult } from '../lib/mcp';
import type { PipelineEvent, ProfilePreview } from '../lib/mcp';
import { toMockResults } from '../lib/transform';
import { hashLinkedInUrl } from '../lib/urlHash';
import {
  activateDummySubscription,
  buildOAuthCompletePayload,
  buildSignupPayload,
  completeOAuthSignup,
  consumeOAuthRedirect,
  consumePendingOAuthSignup,
  getStoredSignupSession,
  restoreSignupSession,
  saveSignupSession,
  savePendingOAuthSignup,
  startOAuth,
  submitSignup,
  type OAuthProvider,
  type StoredSignupSession,
} from '../lib/signup';
import type { MockResults } from '../data/mockResults';

type Page =
  | 'landing'
  | 'intake'
  | 'previewing'
  | 'analyzing'
  | 'results'
  | 'signup'
  | 'error'
  | 'cached-prompt'
  | 'career-chat';

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

const FREE_PREVIEW_MS = 60_000;

interface PendingOAuthSignup {
  formData: any;
  resultsBackend: any;
  resultsComputed: MockResults;
}

export function useAppState() {
  const [currentPage, setCurrentPage] = useState<Page>('landing');
  const [formData, setFormData] = useState<any>({});
  const [resultsBackend, setResultsBackend] = useState<any>(null);
  const [resultsComputed, setResultsComputed] = useState<MockResults>(mockResults);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [pipelineProgress, setPipelineProgress] = useState<PipelineProgress>(INITIAL_PROGRESS);
  const [previewData, setPreviewData] = useState<ProfilePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [cachedResult, setCachedResult] = useState<any>(null);
  const [cachedResultAge, setCachedResultAge] = useState<string | null>(null);
  const [careerMentorSeedContext, setCareerMentorSeedContext] = useState<string | undefined>(undefined);
  const [careerChatReturnPage, setCareerChatReturnPage] = useState<'landing' | 'results'>('landing');
  const [signupSubmitting, setSignupSubmitting] = useState(false);
  const [signupError, setSignupError] = useState<string>('');
  const [signupCompleted, setSignupCompleted] = useState(false);
  const [signupId, setSignupId] = useState<string | null>(null);
  const [signupSession, setSignupSession] = useState<StoredSignupSession | null>(null);
  const [subscriptionActive, setSubscriptionActive] = useState(false);
  const [paywallLocked, setPaywallLocked] = useState(false);
  const [paywallDeadlineMs, setPaywallDeadlineMs] = useState<number | null>(null);

  const startFreePreviewWindow = useCallback((isSubscribed: boolean) => {
    if (isSubscribed) {
      setPaywallLocked(false);
      setPaywallDeadlineMs(null);
      return;
    }
    setPaywallLocked(false);
    setPaywallDeadlineMs(Date.now() + FREE_PREVIEW_MS);
  }, []);

  useEffect(() => {
    const oauthResponse = consumeOAuthRedirect();
    if (oauthResponse?.access_token) {
      const session = saveSignupSession(oauthResponse);
      const pending = consumePendingOAuthSignup<PendingOAuthSignup>();
      if (pending) {
        setFormData(pending.formData || {});
        setResultsBackend(pending.resultsBackend || null);
        setResultsComputed(pending.resultsComputed || mockResults);
      }
      if (session) {
        setSignupSession(session);
        setSignupCompleted(true);
        setSignupId(session.signupId);
        setSubscriptionActive(session.subscriptionActive);
        startFreePreviewWindow(session.subscriptionActive);
        setCurrentPage('results');
      }
      if (session?.accessToken && pending) {
        (async () => {
          try {
            const resp = await completeOAuthSignup(
              buildOAuthCompletePayload(
                session.accessToken,
                pending.formData || {},
                pending.resultsBackend || null,
                pending.resultsComputed as unknown as Record<string, any>
              )
            );
            saveSignupSession({ ...resp, access_token: session.accessToken });
          } catch {
            // The user is authenticated; metadata sync can be retried on next signup flow.
          }
        })();
      }
      return;
    }

    const stored = getStoredSignupSession();
    if (!stored?.accessToken) return;
    setSignupSession(stored);
    setSignupCompleted(true);
    setSignupId(stored.signupId);
    setSubscriptionActive(stored.subscriptionActive);
    if (stored.subscriptionActive) {
      setPaywallLocked(false);
      setPaywallDeadlineMs(null);
    }

    (async () => {
      try {
        const restored = await restoreSignupSession({ accessToken: stored.accessToken });
        const session = saveSignupSession(restored);
        if (session) {
          setSignupSession(session);
          setSignupCompleted(true);
          setSignupId(session.signupId);
          setSubscriptionActive(session.subscriptionActive);
          if (session.subscriptionActive) {
            setPaywallLocked(false);
            setPaywallDeadlineMs(null);
          }
        }
      } catch {
        // Keep the local session for demo continuity; production should force re-auth.
      }
    })();
  }, [startFreePreviewWindow]);

  useEffect(() => {
    if (subscriptionActive) {
      setPaywallLocked(false);
      setPaywallDeadlineMs(null);
      return;
    }
    if (!paywallDeadlineMs) return;

    const remaining = paywallDeadlineMs - Date.now();
    if (remaining <= 0) {
      setPaywallLocked(true);
      if (currentPage === 'career-chat') setCurrentPage('results');
      return;
    }

    const timer = window.setTimeout(() => {
      setPaywallLocked(true);
      if (currentPage === 'career-chat') setCurrentPage('results');
    }, remaining);
    return () => window.clearTimeout(timer);
  }, [currentPage, paywallDeadlineMs, subscriptionActive]);

  const goToIntake = useCallback(() => {
    setCurrentPage('intake');
    window.scrollTo(0, 0);
  }, []);

  // Submit form: check cache first, then fetch preview or show confirmation
  const submitForm = useCallback((data: any) => {
    setFormData(data);
    setPreviewLoading(true);
    setErrorMessage('');
    setSignupError('');
    setSignupCompleted(false);
    setSignupId(null);
    setCachedResult(null);
    setCachedResultAge(null);
    window.scrollTo(0, 0);

    const linkedinUrl = data?.linkedinUrl || data?.linkedin_url || '';

    const payload = {
      linkedin_url: linkedinUrl,
      resume_text: data?.resumeText || data?.resume_text || '',
      ...(data?.githubUrl || data?.github_url ? { github_url: data?.githubUrl || data?.github_url } : {}),
      ...(data?.websiteUrl || data?.website_url ? { website_url: data?.websiteUrl || data?.website_url } : {}),
    };

    (async () => {
      // Check for cached results first
      if (linkedinUrl) {
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
          setSignupError('');
          if (signupCompleted) startFreePreviewWindow(subscriptionActive);
          setCurrentPage(signupCompleted ? 'results' : 'signup');
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
  }, [signupCompleted, startFreePreviewWindow, subscriptionActive]);

  // Use cached result — skip pipeline entirely
  const useCachedResult = useCallback(() => {
    if (cachedResult) {
      const transformed = toMockResults(cachedResult);
      setResultsComputed(transformed);
      setResultsBackend({ status: 'ok', result: cachedResult });
      setFormData((prev: any) => ({ ...prev, backend: { status: 'ok', result: cachedResult } }));
      setSignupError('');
      if (signupCompleted) startFreePreviewWindow(subscriptionActive);
      setCurrentPage(signupCompleted ? 'results' : 'signup');
      window.scrollTo(0, 0);
    }
  }, [cachedResult, signupCompleted, startFreePreviewWindow, subscriptionActive]);

  // Skip cache — run fresh analysis via normal preview flow
  const skipCachedResult = useCallback(() => {
    setCachedResult(null);
    setCachedResultAge(null);
    setPreviewLoading(true);
    setCurrentPage('previewing');
    window.scrollTo(0, 0);

    const linkedinUrl = formData?.linkedinUrl || formData?.linkedin_url || '';
    const payload = {
      linkedin_url: linkedinUrl,
      resume_text: formData?.resumeText || formData?.resume_text || '',
      ...(formData?.githubUrl || formData?.github_url ? { github_url: formData?.githubUrl || formData?.github_url } : {}),
      ...(formData?.websiteUrl || formData?.website_url ? { website_url: formData?.websiteUrl || formData?.website_url } : {}),
    };

    (async () => {
      try {
        const preview = await previewProfile(payload);
        setPreviewData(preview);
        setPreviewLoading(false);
      } catch (e: any) {
        console.warn('Preview failed, skipping to full analysis:', e?.message);
        setPreviewData(null);
        setPreviewLoading(false);
        startFullAnalysis(formData);
      }
    })();
  }, [formData]);

  const goToResults = useCallback(() => {
    if (signupCompleted) startFreePreviewWindow(subscriptionActive);
    setCurrentPage(signupCompleted ? 'results' : 'signup');
    window.scrollTo(0, 0);
  }, [signupCompleted, startFreePreviewWindow, subscriptionActive]);

  const goToLanding = useCallback(() => {
    setCareerMentorSeedContext(undefined);
    setSignupError('');
    setCurrentPage('landing');
  }, []);

  const goToCareerChat = useCallback((assessmentSummary?: string, from: 'landing' | 'results' = 'landing') => {
    if (!signupCompleted) {
      setCurrentPage('signup');
      window.scrollTo(0, 0);
      return;
    }
    if (paywallLocked && !subscriptionActive) {
      setCurrentPage('results');
      window.scrollTo(0, 0);
      return;
    }
    setCareerMentorSeedContext(assessmentSummary);
    setCareerChatReturnPage(from);
    setCurrentPage('career-chat');
    window.scrollTo(0, 0);
  }, [paywallLocked, signupCompleted, subscriptionActive]);

  const goBackFromCareerChat = useCallback(() => {
    setCareerMentorSeedContext(undefined);
    setCurrentPage(careerChatReturnPage === 'results' ? 'results' : 'landing');
    window.scrollTo(0, 0);
  }, [careerChatReturnPage]);

  const goBack = useCallback(() => {
    if (currentPage === 'intake') setCurrentPage('landing');
    if (currentPage === 'previewing') setCurrentPage('intake');
    if (currentPage === 'cached-prompt') setCurrentPage('intake');
    if (currentPage === 'results') setCurrentPage('landing');
    if (currentPage === 'signup') setCurrentPage('intake');
    if (currentPage === 'error') setCurrentPage('landing');
    if (currentPage === 'career-chat') goBackFromCareerChat();
  }, [currentPage, goBackFromCareerChat]);

  const completeSignup = useCallback((details: {
    fullName: string;
    email: string;
    password: string;
    phone?: string;
    company?: string;
    roleTitle?: string;
    marketingOptIn: boolean;
  }) => {
    setSignupSubmitting(true);
    setSignupError('');

    (async () => {
      try {
        const payload = buildSignupPayload(
          details,
          formData,
          resultsBackend,
          resultsComputed as unknown as Record<string, any>
        );
        const resp = await submitSignup(payload);
        const session = saveSignupSession(resp);
        setSignupSession(session);
        setSignupId(resp.signup_id || null);
        setSignupCompleted(true);
        const isSubscribed = Boolean(resp.subscription_active);
        setSubscriptionActive(isSubscribed);
        startFreePreviewWindow(isSubscribed);
        setFormData((prev: any) => ({
          ...prev,
          signup: {
            fullName: details.fullName.trim(),
            email: details.email.trim(),
            signupId: resp.signup_id || null,
            persisted: resp.persisted !== false,
          },
        }));
        setCurrentPage('results');
        window.scrollTo(0, 0);
      } catch (e: any) {
        setSignupError(e?.message || 'Could not save signup details. Please try again.');
      } finally {
        setSignupSubmitting(false);
      }
    })();
  }, [formData, resultsBackend, resultsComputed, startFreePreviewWindow]);

  const restoreSignupByEmail = useCallback((email: string, password: string) => {
    setSignupSubmitting(true);
    setSignupError('');

    (async () => {
      try {
        const resp = await restoreSignupSession({ email, password });
        const session = saveSignupSession(resp);
        if (session) {
          setSignupSession(session);
          setSignupId(session.signupId);
          setSubscriptionActive(session.subscriptionActive);
          startFreePreviewWindow(session.subscriptionActive);
        }
        setSignupCompleted(true);
        setFormData((prev: any) => ({
          ...prev,
          signup: {
            email: resp.email || email.trim(),
            fullName: resp.full_name || '',
            signupId: resp.signup_id || null,
            persisted: resp.persisted !== false,
          },
        }));
        setCurrentPage('results');
        window.scrollTo(0, 0);
      } catch (e: any) {
        setSignupError(e?.message || 'Could not restore your account.');
      } finally {
        setSignupSubmitting(false);
      }
    })();
  }, [startFreePreviewWindow]);

  const continueWithOAuth = useCallback((provider: OAuthProvider) => {
    setSignupSubmitting(true);
    setSignupError('');
    savePendingOAuthSignup({
      formData,
      resultsBackend,
      resultsComputed,
    } satisfies PendingOAuthSignup);

    (async () => {
      try {
        const authUrl = await startOAuth(provider);
        window.location.assign(authUrl);
      } catch (e: any) {
        setSignupError(e?.message || `Could not start ${provider} sign-in.`);
        setSignupSubmitting(false);
      }
    })();
  }, [formData, resultsBackend, resultsComputed]);

  const activateSubscription = useCallback(() => {
    const token = signupSession?.accessToken;
    if (!token) {
      setSignupError('Please sign up or restore your account before subscribing.');
      setCurrentPage('signup');
      return;
    }

    setSignupSubmitting(true);
    setSignupError('');
    (async () => {
      try {
        const resp = await activateDummySubscription(token);
        const session = saveSignupSession({
          ...resp,
          access_token: token,
          email: resp.email || signupSession.email,
          full_name: resp.full_name || signupSession.fullName,
          signup_id: resp.signup_id || signupSession.signupId,
        });
        if (session) {
          setSignupSession(session);
          setSubscriptionActive(session.subscriptionActive);
          if (session.subscriptionActive) {
            setPaywallLocked(false);
            setPaywallDeadlineMs(null);
          }
        } else {
          setSubscriptionActive(Boolean(resp.subscription_active));
          if (resp.subscription_active) {
            setPaywallLocked(false);
            setPaywallDeadlineMs(null);
          }
        }
      } catch (e: any) {
        setSignupError(e?.message || 'Could not activate subscription.');
      } finally {
        setSignupSubmitting(false);
      }
    })();
  }, [signupSession]);

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
    signupSubmitting,
    signupError,
    signupCompleted,
    signupId,
    signupSession,
    subscriptionActive,
    paywallLocked,
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
    completeSignup,
    restoreSignupByEmail,
    continueWithOAuth,
    activateSubscription,
    goToCareerChat,
    goBackFromCareerChat,
    careerMentorSeedContext,
  };
}
