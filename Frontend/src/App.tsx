import React, { Suspense } from 'react';
import { AnimatePresence } from 'framer-motion';
import * as Sentry from '@sentry/react';
import { LandingPage } from './pages/LandingPage';
import { IntakeFormPage } from './pages/IntakeFormPage';
import { SurveyPage } from './pages/SurveyPage';
import { ProfilePreviewPage } from './pages/ProfilePreviewPage';
import { AnalyzingPage } from './pages/AnalyzingPage';
import { ErrorPage } from './pages/ErrorPage';
import { CachedResultPromptPage } from './pages/CachedResultPromptPage';
import { CareerChatPage } from './pages/CareerChatPage';
import { SignupPage } from './pages/SignupPage';
import { SubscriptionPage } from './pages/SubscriptionPage';
import { SettingsNotificationsPage } from './pages/SettingsNotificationsPage';
import { RerunLockModal } from './components/dashboard/RerunLockModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { buildCareerAssessmentContext } from './lib/careerChat';
import { ThemeProvider } from './contexts/ThemeContext';
import { useAppState } from './hooks/useAppState';

const ResultsDashboard = React.lazy(() =>
  import('./pages/ResultsDashboard').then((m) => ({ default: m.ResultsDashboard }))
);

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-bg">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-dark-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-dark-textMuted text-sm">Loading dashboard...</p>
      </div>
    </div>
  );
}

function PreviewLoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-bg">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-dark-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-dark-textPri font-medium">Fetching your profile...</p>
        <p className="text-dark-textMuted text-sm mt-1">This usually takes 5-10 seconds</p>
      </div>
    </div>
  );
}

export function App() {
  const {
    currentPage,
    formData,
    results,
    errorMessage,
    pipelineProgress,
    previewData,
    previewLoading,
    authRestoring,
    signupInitialMode,
    cachedResultAge,
    signupSubmitting,
    signupError,
    signupSession,
    subscriptionActive,
    paywallLocked,
    dashboardRevealSeen,
    cachedResult,
    useCachedResult,
    skipCachedResult,
    goToIntake,
    goToLogin,
    goToSubscriptions,
    goToNotificationSettings,
    submitForm,
    submitSurvey,
    scrapeStatus,
    rerunLockedUntil,
    dismissRerunLock,
    setRerunReminder,
    confirmProfile,
    rejectProfile,
    goToResults,
    goBack,
    goToLanding,
    logout,
    retrySubmit,
    completeSignup,
    restoreSignupByEmail,
    continueWithOAuth,
    activateSubscription,
    redeemPromo,
    markDashboardRevealSeen,
    goBackFromCareerChat,
    goToCareerChat,
    careerMentorSeedContext,
    resultsBackend,
  } = useAppState();
  const accountName = signupSession?.fullName || signupSession?.email || '';
  const dashboardAvailable = Boolean(resultsBackend || formData?.backend);
  if (authRestoring) {
    return (
      <ThemeProvider>
        <LoadingFallback />
      </ThemeProvider>
    );
  }
  return (
    <ThemeProvider>
    <Sentry.ErrorBoundary fallback={<ErrorPage error="An unexpected error occurred." onRetry={() => window.location.reload()} />}>
    <ErrorBoundary>
      <div className="font-sans text-navy-900 antialiased selection:bg-accent/20 selection:text-accent-dark">
        <AnimatePresence mode="wait">
          {currentPage === 'landing' && (
            <LandingPage
              key="landing"
              onGetStarted={goToIntake}
              onLogin={goToLogin}
              onSubscriptions={goToSubscriptions}
              accountName={accountName}
              onDashboard={dashboardAvailable ? goToResults : undefined}
              onRecalculate={goToIntake}
              onLogout={accountName ? logout : undefined}
            />
          )}

          {currentPage === 'career-chat' && (
            <CareerChatPage
              key="career-chat"
              seedAssessmentContext={careerMentorSeedContext}
              onBack={goBackFromCareerChat}
            />
          )}

          {currentPage === 'intake' &&
          <IntakeFormPage key="intake" onSubmit={submitForm} onBack={goBack} submitting={previewLoading} />
          }

          {currentPage === 'survey' &&
          <SurveyPage
            key="survey"
            onSubmit={submitSurvey}
            onBack={goBack}
            draftKey={formData?.linkedinUrl || formData?.linkedin_url || 'survey'}
            scrapeStatus={scrapeStatus}
          />
          }

          {currentPage === 'signup-during-onboarding' && (
            <SignupPage
              key="signup-during-onboarding"
              variant="mid-onboarding"
              submitting={signupSubmitting}
              errorMessage={signupError}
              initialMode="signup"
              onSubmit={completeSignup}
              onRestore={restoreSignupByEmail}
              onOAuth={continueWithOAuth}
              onBack={goBack}
            />
          )}

          {currentPage === 'awaiting-score' &&
          <AnalyzingPage key="awaiting-score" onComplete={goToResults} pipelineProgress={pipelineProgress} />
          }

          {currentPage === 'cached-prompt' &&
          <CachedResultPromptPage
            key="cached-prompt"
            age={cachedResultAge}
            result={cachedResult}
            accountName={accountName}
            onSubscriptions={goToSubscriptions}
            onViewCached={useCachedResult}
            onRunFresh={skipCachedResult}
          />
          }

          {currentPage === 'previewing' && (
            previewLoading || !previewData ? (
              <PreviewLoadingFallback key="preview-loading" />
            ) : (
              <ProfilePreviewPage
                key="previewing"
                preview={previewData}
                linkedinUrl={formData?.linkedinUrl || formData?.linkedin_url || ''}
                onConfirm={confirmProfile}
                onReject={rejectProfile}
                onBack={goBack}
              />
            )
          )}

          {currentPage === 'analyzing' &&
          <AnalyzingPage key="analyzing" onComplete={goToResults} pipelineProgress={pipelineProgress} />
          }

          {currentPage === 'signup' && (
            <SignupPage
              key="signup"
              submitting={signupSubmitting}
              errorMessage={signupError}
              initialMode={signupInitialMode}
              onSubmit={completeSignup}
              onRestore={restoreSignupByEmail}
              onOAuth={continueWithOAuth}
              onBack={goBack}
            />
          )}

          {currentPage === 'subscriptions' && (
            <SubscriptionPage
              key="subscriptions"
              subscriptionActive={subscriptionActive}
              submitting={signupSubmitting}
              accountName={accountName}
              accessToken={signupSession?.accessToken}
              signupId={signupSession?.signupId ?? undefined}
              email={signupSession?.email}
              errorMessage={signupError}
              isAuthenticated={Boolean(signupSession?.accessToken)}
              onDashboard={dashboardAvailable ? goToResults : undefined}
              onRecalculate={goToIntake}
              onLogout={accountName ? logout : undefined}
              onActivate={activateSubscription}
              onRedeemPromo={redeemPromo}
              onBack={goBack}
            />
          )}

          {currentPage === 'results' &&
          <Suspense fallback={<LoadingFallback />}>
            <ResultsDashboard
              key="results"
              results={results}
              formData={formData}
              onBackToHome={goToLanding}
              onSubscriptions={goToSubscriptions}
              accountName={accountName}
              onDashboard={goToResults}
              onRecalculate={goToIntake}
              onLogout={logout}
              onSettings={goToNotificationSettings}
              seedAssessmentContext={buildCareerAssessmentContext(
                results as unknown as Record<string, unknown>,
                resultsBackend as Record<string, unknown> | null | undefined,
                formData as Record<string, unknown> | null | undefined
              )}
              onOpenCareerMentor={() => goToCareerChat(
                buildCareerAssessmentContext(
                  results as unknown as Record<string, unknown>,
                  resultsBackend as Record<string, unknown> | null | undefined,
                  formData as Record<string, unknown> | null | undefined
                ),
                'results'
              )}
              subscriptionActive={subscriptionActive}
              paywallLocked={paywallLocked}
              showScoreReveal={!dashboardRevealSeen}
              onScoreRevealComplete={markDashboardRevealSeen}
              subscriptionSubmitting={signupSubmitting}
              onActivateSubscription={activateSubscription}
            />
          </Suspense>
          }

          {currentPage === 'settings-notifications' &&
          <SettingsNotificationsPage key="settings-notifications" onBack={goBack} />
          }

          {currentPage === 'error' &&
          <ErrorPage
            key="error"
            onRetry={retrySubmit}
            onBack={goBack}
            errorMessage={errorMessage} />
          }
        </AnimatePresence>

        {rerunLockedUntil !== undefined && (
          <RerunLockModal
            nextRerunAt={rerunLockedUntil}
            onClose={dismissRerunLock}
            onSeePremium={() => { dismissRerunLock(); goToSubscriptions(); }}
            onSetReminder={setRerunReminder}
          />
        )}
      </div>
    </ErrorBoundary>
    </Sentry.ErrorBoundary>
    </ThemeProvider>);
}
