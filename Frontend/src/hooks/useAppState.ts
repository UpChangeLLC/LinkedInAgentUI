import { useEffect, useState, useCallback, useRef } from 'react';
import { mockResults } from '../data/mockResults';
import { streamAnalysis, previewProfile, fetchCachedResult } from '../lib/mcp';
import type { PipelineEvent, ProfilePreview } from '../lib/mcp';
import { toMockResults } from '../lib/transform';
import { hashLinkedInUrl } from '../lib/urlHash';
import {
  buildOAuthCompletePayload,
  buildSignupPayload,
  clearStoredSignupSession,
  confirmPaymentCheckout,
  createPaymentCheckout,
  completeOAuthSignup,
  consumeOAuthRedirect,
  consumePendingOAuthSignup,
  getStoredSignupSession,
  restoreSignupSession,
  saveSignupSession,
  saveSignupAssessment,
  savePendingOAuthSignup,
  startOAuth,
  submitSignup,
  PAYWALL_DEADLINE_KEY,
  type OAuthProvider,
  type SignupResponse,
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
  | 'subscriptions'
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
  authEntryPoint?: 'landing' | 'intake';
}

export function useAppState() {
  const restoreAttemptedRef = useRef(false);
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
  const [dashboardRevealSeen, setDashboardRevealSeen] = useState(true);
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
  const [authEntryPoint, setAuthEntryPoint] = useState<'landing' | 'intake'>('intake');
  const [subscriptionReturnPage, setSubscriptionReturnPage] = useState<Page>('landing');
  const [continueToSubscriptionsAfterAuth, setContinueToSubscriptionsAfterAuth] = useState(false);
  const [authRestoring, setAuthRestoring] = useState(true);
  const [signupInitialMode, setSignupInitialMode] = useState<'login' | 'signup'>('login');

  const startFreePreviewWindow = useCallback((isSubscribed: boolean) => {
    if (isSubscribed) {
      setPaywallLocked(false);
      setPaywallDeadlineMs(null);
      try {
        localStorage.removeItem(PAYWALL_DEADLINE_KEY);
      } catch {
        /* ignore */
      }
      return;
    }
    try {
      const saved = Number(localStorage.getItem(PAYWALL_DEADLINE_KEY) || 0);
      if (saved > Date.now()) {
        setPaywallLocked(false);
        setPaywallDeadlineMs(saved);
        return;
      }
      if (saved && saved <= Date.now()) {
        setPaywallLocked(true);
        setPaywallDeadlineMs(saved);
        return;
      }
    } catch {
      /* ignore */
    }
    const deadline = Date.now() + FREE_PREVIEW_MS;
    setPaywallLocked(false);
    setPaywallDeadlineMs(deadline);
    try {
      localStorage.setItem(PAYWALL_DEADLINE_KEY, String(deadline));
    } catch {
      /* ignore */
    }
  }, []);

  const showSavedResult = useCallback((
    result: Record<string, any>,
    age: string | null,
    directToDashboard: boolean,
    isSubscribed = subscriptionActive
  ) => {
    setCachedResult(result);
    setCachedResultAge(age);
    if (!directToDashboard) {
      setCurrentPage('cached-prompt');
      window.scrollTo(0, 0);
      return;
    }

    const transformed = toMockResults(result);
    setResultsComputed(transformed);
    setResultsBackend({ status: 'ok', result });
    setFormData((prev: any) => ({ ...prev, backend: { status: 'ok', result } }));
    setDashboardRevealSeen(true);
    startFreePreviewWindow(Boolean(isSubscribed));
    setCurrentPage('results');
    window.scrollTo(0, 0);
  }, [startFreePreviewWindow, subscriptionActive]);

  useEffect(() => {
    if (restoreAttemptedRef.current) return;
    restoreAttemptedRef.current = true;

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
        if (oauthResponse.latest_assessment_result) {
          showSavedResult(
            oauthResponse.latest_assessment_result,
            oauthResponse.latest_assessment_created_at || null,
            false,
            oauthResponse.subscription_active
          );
        } else if (pending?.formData && (pending.formData?.linkedinUrl || pending.formData?.linkedin_url)) {
          startFullAnalysis(pending.formData, true, session.accessToken);
        } else {
          setCurrentPage('intake');
        }
      }
      const hasMeaningfulPendingMetadata = Boolean(
        pending?.resultsBackend?.result ||
        pending?.formData?.linkedinUrl ||
        pending?.formData?.linkedin_url ||
        pending?.formData?.resumeText ||
        pending?.formData?.resume_text
      );
      if (session?.accessToken && pending && hasMeaningfulPendingMetadata) {
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
      setAuthRestoring(false);
      return;
    }

    const stored = getStoredSignupSession();
    if (!stored?.accessToken) {
      setAuthRestoring(false);
      return;
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
            try {
              localStorage.removeItem(PAYWALL_DEADLINE_KEY);
            } catch {
              /* ignore */
            }
          } else {
            try {
              const savedDeadline = Number(localStorage.getItem(PAYWALL_DEADLINE_KEY) || 0);
              if (savedDeadline) setPaywallDeadlineMs(savedDeadline);
              if (savedDeadline && savedDeadline <= Date.now()) setPaywallLocked(true);
            } catch {
              /* ignore */
            }
          }
          if (restored.latest_assessment_result) {
            showSavedResult(
              restored.latest_assessment_result,
              restored.latest_assessment_created_at || null,
              true,
              restored.subscription_active
            );
          } else {
            setCurrentPage('landing');
          }
        }
      } catch {
        clearStoredSignupSession();
        setSignupSession(null);
        setSignupCompleted(false);
        setSignupId(null);
        setSubscriptionActive(false);
        setPaywallLocked(false);
        setPaywallDeadlineMs(null);
        setCurrentPage('landing');
      } finally {
        setAuthRestoring(false);
      }
    })();
  }, [showSavedResult, startFreePreviewWindow]);

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
    setAuthEntryPoint('intake');
    setCurrentPage('intake');
    window.scrollTo(0, 0);
  }, []);

  const goToLogin = useCallback(() => {
    setAuthEntryPoint('landing');
    setSignupInitialMode('login');
    setSignupError('');
    setFormData({});
    setCachedResult(null);
    setCachedResultAge(null);
    setCurrentPage('signup');
    window.scrollTo(0, 0);
  }, []);

  const goToSubscriptions = useCallback(() => {
    setSignupError('');
    setSubscriptionReturnPage(currentPage === 'results' ? 'results' : 'landing');
    setCurrentPage('subscriptions');
    window.scrollTo(0, 0);
  }, [currentPage]);

  // Submit form: check cache first, then fetch preview or show confirmation
  const submitForm = useCallback((data: any) => {
    setFormData(data);
    setPreviewLoading(true);
    setErrorMessage('');
    setSignupError('');
    setCachedResult(null);
    setCachedResultAge(null);
    window.scrollTo(0, 0);

    if (!signupCompleted) {
      setAuthEntryPoint('intake');
      setSignupInitialMode('signup');
      setPreviewLoading(false);
      setCurrentPage('signup');
      return;
    }

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
  }, [signupCompleted]);

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
  const startFullAnalysis = useCallback((data: any, authenticatedOverride = false, accessTokenOverride?: string | null) => {
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
          setDashboardRevealSeen(false);
          const assessmentAccessToken = accessTokenOverride || signupSession?.accessToken;
          if (assessmentAccessToken) {
            void saveSignupAssessment(
              buildOAuthCompletePayload(
                assessmentAccessToken,
                data,
                resp,
                transformed as unknown as Record<string, any>
              )
            ).catch(() => {
              // Result display should not fail if account metadata sync is unavailable.
            });
          }
          setPipelineProgress((prev) => ({ ...prev, progress: 100, message: 'Analysis complete!' }));
          setSignupError('');
          const canShowResults = authenticatedOverride || signupCompleted;
          if (canShowResults) startFreePreviewWindow(subscriptionActive);
          setCurrentPage(canShowResults ? 'results' : 'signup');
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
  }, [signupCompleted, signupSession?.accessToken, startFreePreviewWindow, subscriptionActive]);

  // Use cached result — skip pipeline entirely
  const useCachedResult = useCallback(() => {
    if (cachedResult) {
      setSignupError('');
      showSavedResult(cachedResult, cachedResultAge, true, subscriptionActive);
    }
  }, [cachedResult, cachedResultAge, showSavedResult, subscriptionActive]);

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

  const logout = useCallback(() => {
    clearStoredSignupSession();
    setSignupSession(null);
    setSignupCompleted(false);
    setSignupId(null);
    setSubscriptionActive(false);
    setPaywallLocked(false);
    setPaywallDeadlineMs(null);
    setCachedResult(null);
    setCachedResultAge(null);
    setDashboardRevealSeen(true);
    setCareerMentorSeedContext(undefined);
    setSignupError('');
    setCurrentPage('landing');
    window.scrollTo(0, 0);
  }, []);

  const goToCareerChat = useCallback((assessmentSummary?: string, from: 'landing' | 'results' = 'landing') => {
    if (!signupCompleted) {
      setSignupInitialMode('login');
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
    if (currentPage === 'signup') setCurrentPage(authEntryPoint === 'landing' ? 'landing' : 'intake');
    if (currentPage === 'subscriptions') setCurrentPage(subscriptionReturnPage);
    if (currentPage === 'error') setCurrentPage('landing');
    if (currentPage === 'career-chat') goBackFromCareerChat();
  }, [authEntryPoint, currentPage, goBackFromCareerChat, subscriptionReturnPage]);

  const continueAfterAuth = useCallback(async (resp: SignupResponse, data: any) => {
    if (continueToSubscriptionsAfterAuth) {
      setContinueToSubscriptionsAfterAuth(false);
      setCurrentPage('subscriptions');
      window.scrollTo(0, 0);
      return;
    }

    if (resp.latest_assessment_result && Object.keys(resp.latest_assessment_result).length > 0) {
      showSavedResult(
        resp.latest_assessment_result,
        resp.latest_assessment_created_at || null,
        false,
        resp.subscription_active
      );
      return;
    }

    const linkedinUrl = data?.linkedinUrl || data?.linkedin_url || '';
    if (!linkedinUrl) {
      setCurrentPage('intake');
      window.scrollTo(0, 0);
      return;
    }

    if (linkedinUrl) {
      try {
        const urlHash = await hashLinkedInUrl(linkedinUrl);
        const cached = await fetchCachedResult(urlHash);
        if (cached.status === 'hit' && cached.result) {
          showSavedResult(cached.result, cached.created_at || null, false, resp.subscription_active);
          return;
        }
      } catch {
        // Cache lookup should not block a fresh analysis.
      }
    }

    startFullAnalysis(data, true, resp.access_token || null);
  }, [authEntryPoint, continueToSubscriptionsAfterAuth, showSavedResult, startFullAnalysis]);

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
        setFormData((prev: any) => ({
          ...prev,
          signup: {
            fullName: details.fullName.trim(),
            email: details.email.trim(),
            signupId: resp.signup_id || null,
            persisted: resp.persisted !== false,
          },
        }));
        await continueAfterAuth(resp, formData);
      } catch (e: any) {
        setSignupError(e?.message || 'Could not save signup details. Please try again.');
      } finally {
        setSignupSubmitting(false);
      }
    })();
  }, [continueAfterAuth, formData, resultsBackend, resultsComputed]);

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
        await continueAfterAuth(resp, formData);
      } catch (e: any) {
        setSignupError(e?.message || 'Could not restore your account.');
      } finally {
        setSignupSubmitting(false);
      }
    })();
  }, [continueAfterAuth, formData]);

  const continueWithOAuth = useCallback((provider: OAuthProvider) => {
    setSignupSubmitting(true);
    setSignupError('');
    savePendingOAuthSignup({
      formData,
      resultsBackend,
      resultsComputed,
      authEntryPoint,
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
  }, [authEntryPoint, formData, resultsBackend, resultsComputed]);

  const activateSubscription = useCallback((planId = 'monthly', paymentMethod: Record<string, unknown> = {}) => {
    const token = signupSession?.accessToken;
    if (!token) {
      setAuthEntryPoint('landing');
      setSignupInitialMode('signup');
      setContinueToSubscriptionsAfterAuth(true);
      setSignupError('Please create an account or log in before choosing a subscription.');
      setCurrentPage('signup');
      return;
    }

    setSignupSubmitting(true);
    setSignupError('');
    (async () => {
      try {
        const checkout = await createPaymentCheckout(token, planId);
        const resp = await confirmPaymentCheckout({
          accessToken: token,
          sessionId: checkout.session_id,
          paymentMethod,
        });
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
    authRestoring,
    signupInitialMode,
    signupSubmitting,
    signupError,
    signupCompleted,
    signupId,
    signupSession,
    subscriptionActive,
    paywallLocked,
    dashboardRevealSeen,
    cachedResult,
    cachedResultAge,
    goToIntake,
    goToLogin,
    goToSubscriptions,
    submitForm,
    confirmProfile,
    rejectProfile,
    useCachedResult,
    skipCachedResult,
    goToResults,
    goBack,
    goToLanding,
    logout,
    retrySubmit,
    completeSignup,
    restoreSignupByEmail,
    continueWithOAuth,
    activateSubscription,
    markDashboardRevealSeen: () => setDashboardRevealSeen(true),
    goToCareerChat,
    goBackFromCareerChat,
    careerMentorSeedContext,
  };
}
