import { useEffect, useState, useCallback, useRef } from 'react';
import { mockResults } from '../data/mockResults';
import { streamAnalysis, previewProfile, fetchCachedResult, RerunLockedError } from '../lib/mcp';
import type { PipelineEvent, ProfilePreview } from '../lib/mcp';
import { toMockResults } from '../lib/transform';
import { hashLinkedInUrl } from '../lib/urlHash';
import { clearDraft } from '../lib/surveyDraft';
import { trackEvent } from '../lib/analytics';
import type { SurveyResponse } from '../lib/survey';
import type { ScrapeStatus } from '../components/survey/SurveyProgressBar';
import {
  buildAssessmentPayload,
  buildSignupPayload,
  clearStoredSignupSession,
  confirmPaymentCheckout,
  createPaymentCheckout,
  getStoredSignupSession,
  isAuthRestoreError,
  refreshSignupSession,
  requestPasswordReset,
  resendVerification,
  restoreSignupSession,
  resetPassword,
  saveSignupSession,
  saveSignupAssessment,
  submitSignup,
  verifyEmail,
  PAYWALL_DEADLINE_KEY,
  type SignupResponse,
  type StoredSignupSession,
} from '../lib/signup';
import type { MockResults } from '../data/mockResults';

type Page =
  | 'landing'
  | 'intake'
  | 'survey'
  | 'signup-during-onboarding'
  | 'awaiting-score'
  | 'previewing'
  | 'analyzing'
  | 'results'
  | 'signup'
  | 'subscriptions'
  | 'error'
  | 'cached-prompt'
  | 'career-chat'
  | 'settings-notifications';

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

export interface AuthNotice {
  kind: 'success' | 'error';
  message: string;
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
  const [scrapeStatus, setScrapeStatus] = useState<ScrapeStatus>('idle');
  const [surveyResponses, setSurveyResponses] = useState<SurveyResponse | null>(null);
  const [rerunLockedUntil, setRerunLockedUntil] = useState<string | null | undefined>(undefined);
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
  // Email verification (soft nag) + password-reset deep-link state.
  const [authNotice, setAuthNotice] = useState<AuthNotice | null>(null);
  const [passwordResetToken, setPasswordResetToken] = useState<string | null>(null);

  // ---- Onboarding funnel instrumentation (G4 gate: survey completion >85%,
  // signup conversion >35%). Emit one event per stage so the backend can
  // compute conversion rates. "Started/shown" events fire on page entry;
  // "completed" events fire from the explicit submit handlers below. ----
  const lastFunnelPage = useRef<Page | null>(null);
  const signupShownInOnboarding = useRef(false);
  const prevSignupCompleted = useRef(signupCompleted);

  useEffect(() => {
    const PAGE_EVENTS: Partial<Record<Page, string>> = {
      survey: 'funnel_survey_started',
      'signup-during-onboarding': 'funnel_signup_shown',
    };
    if (lastFunnelPage.current !== currentPage) {
      if (currentPage === 'signup-during-onboarding') signupShownInOnboarding.current = true;
      const evt = PAGE_EVENTS[currentPage];
      if (evt) trackEvent(evt);
      lastFunnelPage.current = currentPage;
    }
  }, [currentPage]);

  // Mid-onboarding signup conversion: only count the false->true flip that
  // happens after the gate was shown (not session-restore on app load).
  useEffect(() => {
    if (!prevSignupCompleted.current && signupCompleted && signupShownInOnboarding.current) {
      trackEvent('funnel_signup_completed');
      signupShownInOnboarding.current = false;
    }
    prevSignupCompleted.current = signupCompleted;
  }, [signupCompleted]);

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

    // Email-verification / password-reset deep links (?verify=… / ?reset=…).
    try {
      const url = new URL(window.location.href);
      const verifyToken = url.searchParams.get('verify');
      const resetToken = url.searchParams.get('reset');
      if (verifyToken) {
        url.searchParams.delete('verify');
        window.history.replaceState(null, document.title, url.pathname + url.search + url.hash);
        (async () => {
          try {
            await verifyEmail(verifyToken);
            setAuthNotice({ kind: 'success', message: 'Your email is verified — thank you!' });
            const refreshed = await refreshSignupSession();
            if (refreshed) setSignupSession(refreshed);
          } catch (e: any) {
            setAuthNotice({
              kind: 'error',
              message: e?.message || 'This verification link is invalid or has expired.',
            });
          }
        })();
      }
      if (resetToken) {
        url.searchParams.delete('reset');
        window.history.replaceState(null, document.title, url.pathname + url.search + url.hash);
        setPasswordResetToken(resetToken);
        setSignupInitialMode('login');
        setCurrentPage('signup');
      }
    } catch {
      /* ignore malformed URLs */
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
      } catch (err: any) {
        clearStoredSignupSession();
        setSignupSession(null);
        setSignupCompleted(false);
        setSignupId(null);
        setSubscriptionActive(false);
        setPaywallLocked(false);
        setPaywallDeadlineMs(null);
        // An expired/invalid token shouldn't silently drop the user to the
        // logged-out landing page (where premium features look "broken").
        // Surface a clear re-login prompt; only fall back to landing on a
        // transient network/server error.
        if (isAuthRestoreError(err?.message)) {
          setSignupError('Your session expired — please log in again.');
          setSignupInitialMode('login');
          setCurrentPage('signup');
        } else {
          setCurrentPage('landing');
        }
      } finally {
        setAuthRestoring(false);
      }
    })();
  }, [showSavedResult, startFreePreviewWindow]);

  // Re-check subscription status on an already-open tab so an out-of-band
  // upgrade (manual grant, webhook-confirmed payment) unlocks the dashboard
  // without a re-login. The session is otherwise only refetched at
  // login/full-reload, which is why a fresh grant looked "stuck" on free.
  const refreshSubscription = useCallback(async () => {
    const session = await refreshSignupSession();
    if (!session) return;
    setSignupSession(session);
    setSubscriptionActive(session.subscriptionActive);
    if (session.subscriptionActive) {
      setPaywallLocked(false);
      setPaywallDeadlineMs(null);
      try {
        localStorage.removeItem(PAYWALL_DEADLINE_KEY);
      } catch {
        /* ignore */
      }
    }
  }, []);

  // Returning from Stripe hosted Checkout (?checkout=success): the webhook
  // activates the subscription server-side; re-fetch entitlements and clean the
  // query param. Focus-refresh below also covers this, but this is immediate.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const checkout = params.get('checkout');
    if (!checkout) return;
    if (checkout === 'success') {
      void refreshSubscription();
    }
    params.delete('checkout');
    const qs = params.toString();
    window.history.replaceState(null, document.title, window.location.pathname + (qs ? `?${qs}` : ''));
  }, [refreshSubscription]);

  const lastSubRefreshRef = useRef(0);
  useEffect(() => {
    const maybeRefresh = () => {
      if (document.visibilityState === 'hidden') return;
      if (!getStoredSignupSession()?.accessToken) return;
      const now = Date.now();
      if (now - lastSubRefreshRef.current < 5_000) return; // throttle focus storms
      lastSubRefreshRef.current = now;
      void refreshSubscription();
    };
    window.addEventListener('focus', maybeRefresh);
    document.addEventListener('visibilitychange', maybeRefresh);
    return () => {
      window.removeEventListener('focus', maybeRefresh);
      document.removeEventListener('visibilitychange', maybeRefresh);
    };
  }, [refreshSubscription]);

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

  // Submit intake form: route into the survey while the LinkedIn scrape runs in
  // the background (spec 01 §2). Returning signed-in users with a cached result
  // still short-circuit to the cached-result prompt.
  const submitForm = useCallback((data: any) => {
    trackEvent('funnel_intake_submitted');
    setFormData(data);
    setErrorMessage('');
    setSignupError('');
    setCachedResult(null);
    setCachedResultAge(null);
    setPreviewData(null);
    setSurveyResponses(null);
    window.scrollTo(0, 0);

    const linkedinUrl = data?.linkedinUrl || data?.linkedin_url || '';
    const payload = {
      linkedin_url: linkedinUrl,
      resume_text: data?.resumeText || data?.resume_text || '',
      ...(data?.githubUrl || data?.github_url ? { github_url: data?.githubUrl || data?.github_url } : {}),
      ...(data?.websiteUrl || data?.website_url ? { website_url: data?.websiteUrl || data?.website_url } : {}),
    };

    (async () => {
      // Returning signed-in users: surface a cached result instead of re-running.
      if (signupCompleted && linkedinUrl) {
        try {
          const urlHash = await hashLinkedInUrl(linkedinUrl);
          const cached = await fetchCachedResult(urlHash);
          if (cached.status === 'hit' && cached.result) {
            setCachedResult(cached.result);
            setCachedResultAge(cached.created_at || null);
            setCurrentPage('cached-prompt');
            return;
          }
        } catch {
          // Cache check failed — continue to the survey.
        }
      }

      // Kick off the profile scrape in the background; the survey shows its status.
      setScrapeStatus('running');
      void previewProfile(payload)
        .then((preview) => {
          setPreviewData(preview);
          setScrapeStatus('parse_complete');
        })
        .catch(() => {
          setPreviewData(null);
          setScrapeStatus('failed');
        });

      setCurrentPage('survey');
      window.scrollTo(0, 0);
    })();
  }, [signupCompleted]);

  // Survey submitted: persist responses, then gate on signup (mid-onboarding)
  // or go straight to analysis for already-signed-in users.
  const submitSurvey = useCallback((responses: SurveyResponse) => {
    trackEvent('funnel_survey_completed');
    setSurveyResponses(responses);
    clearDraft();
    window.scrollTo(0, 0);
    if (!signupCompleted) {
      setAuthEntryPoint('intake');
      setSignupInitialMode('signup');
      setCurrentPage('signup-during-onboarding');
      return;
    }
    startFullAnalysis(formData, false, undefined, responses);
  }, [signupCompleted, formData]);

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
  const startFullAnalysis = useCallback((data: any, authenticatedOverride = false, accessTokenOverride?: string | null, surveyOverride?: SurveyResponse | null) => {
    setCurrentPage('analyzing');
    setErrorMessage('');
    setPipelineProgress(INITIAL_PROGRESS);
    window.scrollTo(0, 0);

    // Build user_context from intake form answers if provided
    const userContext = data?.userContext || data?.user_context || null;
    const survey = surveyOverride ?? surveyResponses;
    const payload = {
      linkedin_url: data?.linkedinUrl || data?.linkedin_url || '',
      resume_text: data?.resumeText || data?.resume_text || '',
      ...(userContext ? { user_context: userContext } : {}),
      ...(survey ? { survey_responses: survey as unknown as Record<string, unknown> } : {}),
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
              buildAssessmentPayload(
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
        if (e instanceof RerunLockedError) {
          // 30-day free re-run gate hit — surface the lock modal, keep them put.
          setRerunLockedUntil(e.nextRerunAt);
          setCurrentPage(signupCompleted ? 'results' : 'signup');
          window.scrollTo(0, 0);
          return;
        }
        setResultsBackend(null);
        setErrorMessage(e?.message || 'The analysis service did not respond. Please try again.');
        setCurrentPage('error');
      }
      window.scrollTo(0, 0);
    })();
  }, [signupCompleted, signupSession?.accessToken, startFreePreviewWindow, subscriptionActive, surveyResponses]);

  const dismissRerunLock = useCallback(() => setRerunLockedUntil(undefined), []);

  const setRerunReminder = useCallback(() => {
    const token = signupSession?.accessToken;
    const env = (import.meta as any).env || {};
    const baseUrl = (env.VITE_MCP_BASE_URL as string | undefined) ?? '';
    if (token) {
      void fetch(`${String(baseUrl).replace(/\/+$/, '')}/api/notifications/set-rerun-reminder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Session-Token': token },
      }).catch(() => {});
    }
    setRerunLockedUntil(undefined);
  }, [signupSession?.accessToken]);

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

  const goToNotificationSettings = useCallback(() => {
    setCurrentPage('settings-notifications');
    window.scrollTo(0, 0);
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
    if (currentPage === 'survey') setCurrentPage('intake');
    if (currentPage === 'signup-during-onboarding') setCurrentPage('survey');
    if (currentPage === 'previewing') setCurrentPage('intake');
    if (currentPage === 'cached-prompt') setCurrentPage('intake');
    if (currentPage === 'results') setCurrentPage('landing');
    if (currentPage === 'signup') setCurrentPage(authEntryPoint === 'landing' ? 'landing' : 'intake');
    if (currentPage === 'subscriptions') setCurrentPage(subscriptionReturnPage);
    if (currentPage === 'error') setCurrentPage('landing');
    if (currentPage === 'settings-notifications') setCurrentPage(signupCompleted ? 'results' : 'landing');
    if (currentPage === 'career-chat') goBackFromCareerChat();
  }, [authEntryPoint, currentPage, goBackFromCareerChat, signupCompleted, subscriptionReturnPage]);

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

  // Re-send the verification email for the current (soft-nagged) session.
  const resendVerificationEmail = useCallback(async (): Promise<boolean> => {
    const token = signupSession?.accessToken;
    if (!token) return false;
    try {
      await resendVerification(token);
      setAuthNotice({ kind: 'success', message: 'Verification email sent — check your inbox.' });
      return true;
    } catch (e: any) {
      setAuthNotice({ kind: 'error', message: e?.message || 'Could not resend verification email.' });
      return false;
    }
  }, [signupSession]);

  // Request a password-reset link (login "Forgot password?"). Always succeeds.
  const requestPasswordResetEmail = useCallback(async (email: string): Promise<boolean> => {
    setSignupError('');
    try {
      await requestPasswordReset(email);
      return true;
    } catch (e: any) {
      setSignupError(e?.message || 'Could not send reset link.');
      return false;
    }
  }, []);

  // Set a new password from the ?reset=… deep-link token, then log in.
  const submitPasswordReset = useCallback(async (newPassword: string): Promise<boolean> => {
    if (!passwordResetToken) return false;
    setSignupSubmitting(true);
    setSignupError('');
    try {
      const resp = await resetPassword(passwordResetToken, newPassword);
      const session = saveSignupSession(resp);
      if (session) {
        setSignupSession(session);
        setSignupCompleted(true);
        setSignupId(session.signupId);
        setSubscriptionActive(session.subscriptionActive);
      }
      setPasswordResetToken(null);
      setAuthNotice({ kind: 'success', message: 'Your password has been reset.' });
      if (resp.latest_assessment_result) {
        showSavedResult(
          resp.latest_assessment_result,
          resp.latest_assessment_created_at || null,
          false,
          resp.subscription_active
        );
      } else {
        setCurrentPage('intake');
      }
      return true;
    } catch (e: any) {
      setSignupError(e?.message || 'Could not reset password.');
      return false;
    } finally {
      setSignupSubmitting(false);
    }
  }, [passwordResetToken, showSavedResult]);

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
        // Stripe (and any redirect-based provider) returns a hosted checkout URL.
        // Navigate there; activation happens via webhook + the ?checkout=success
        // return URL re-fetching entitlements. The synchronous confirm path below
        // is only for non-redirect providers (mock/Razorpay) where checkout_url is null.
        if (checkout.checkout_url) {
          window.location.assign(checkout.checkout_url);
          return;
        }
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
    scrapeStatus,
    rerunLockedUntil,
    dismissRerunLock,
    setRerunReminder,
    goToIntake,
    goToLogin,
    goToSubscriptions,
    goToNotificationSettings,
    submitForm,
    submitSurvey,
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
    activateSubscription,
    // Email verification (soft nag) + password reset.
    authNotice,
    dismissAuthNotice: () => setAuthNotice(null),
    emailVerified: signupSession ? signupSession.emailVerified : true,
    resendVerificationEmail,
    requestPasswordResetEmail,
    passwordResetToken,
    submitPasswordReset,
    cancelPasswordReset: () => setPasswordResetToken(null),
    markDashboardRevealSeen: () => setDashboardRevealSeen(true),
    goToCareerChat,
    goBackFromCareerChat,
    careerMentorSeedContext,
  };
}
