import React, { Suspense } from 'react';
import { AnimatePresence } from 'framer-motion';
import * as Sentry from '@sentry/react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ThemeProvider } from './contexts/ThemeContext';
import { useAppState } from './hooks/useAppState';

// Lazy-load all pages to reduce initial bundle size
const LandingPage = React.lazy(() =>
  import('./pages/LandingPage').then((m) => ({ default: m.LandingPage }))
);
const IntakeFormPage = React.lazy(() =>
  import('./pages/IntakeFormPage').then((m) => ({ default: m.IntakeFormPage }))
);
const ProfilePreviewPage = React.lazy(() =>
  import('./pages/ProfilePreviewPage').then((m) => ({ default: m.ProfilePreviewPage }))
);
const AnalyzingPage = React.lazy(() =>
  import('./pages/AnalyzingPage').then((m) => ({ default: m.AnalyzingPage }))
);
const ErrorPage = React.lazy(() =>
  import('./pages/ErrorPage').then((m) => ({ default: m.ErrorPage }))
);
const CachedResultPromptPage = React.lazy(() =>
  import('./pages/CachedResultPromptPage').then((m) => ({ default: m.CachedResultPromptPage }))
);
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
    errorType,
    pipelineProgress,
    analysisCompletionPhase,
    assessmentsOptimisticDelta,
    previewData,
    previewLoading,
    cachedResultAge,
    useCachedResult,
    skipCachedResult,
    goToIntake,
    submitForm,
    confirmProfile,
    rejectProfile,
    goBack,
    goToLanding,
    retrySubmit
  } = useAppState();
  return (
    <ThemeProvider>
    <Sentry.ErrorBoundary fallback={<ErrorPage errorMessage="An unexpected error occurred." onRetry={() => window.location.reload()} onBack={() => window.location.reload()} errorType="server_error" />}>
    <ErrorBoundary>
      <div className="font-sans text-navy-900 antialiased selection:bg-accent/20 selection:text-accent-dark">
        <Suspense fallback={<LoadingFallback />}>
        <AnimatePresence mode="wait">
          {currentPage === 'landing' &&
          <LandingPage key="landing" onGetStarted={goToIntake} />
          }

          {currentPage === 'intake' &&
          <IntakeFormPage key="intake" onSubmit={submitForm} onBack={goBack} submitting={previewLoading} />
          }

          {currentPage === 'cached-prompt' &&
          <CachedResultPromptPage
            key="cached-prompt"
            age={cachedResultAge}
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
          <AnalyzingPage
            key="analyzing"
            pipelineProgress={pipelineProgress}
            completionPhase={analysisCompletionPhase}
            optimisticCounterDelta={assessmentsOptimisticDelta}
          />
          }

          {currentPage === 'results' &&
            <ResultsDashboard
              key="results"
              results={results}
              formData={formData}
              onBackToHome={goToLanding} />
          }

          {currentPage === 'error' &&
          <ErrorPage
            key="error"
            onRetry={retrySubmit}
            onBack={goBack}
            errorMessage={errorMessage}
            errorType={errorType} />
          }
        </AnimatePresence>
        </Suspense>
      </div>
    </ErrorBoundary>
    </Sentry.ErrorBoundary>
    </ThemeProvider>);
}
