import React, { Suspense } from 'react';
import { AnimatePresence } from 'framer-motion';
import { LandingPage } from './pages/LandingPage';
import { IntakeFormPage } from './pages/IntakeFormPage';
import { AnalyzingPage } from './pages/AnalyzingPage';
import { ErrorPage } from './pages/ErrorPage';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useAppState } from './hooks/useAppState';

const ResultsDashboard = React.lazy(() =>
  import('./pages/ResultsDashboard').then((m) => ({ default: m.ResultsDashboard }))
);

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-linkedin-bg">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-linkedin border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-500 text-sm">Loading dashboard...</p>
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
    goToIntake,
    submitForm,
    goToResults,
    goBack,
    retrySubmit
  } = useAppState();
  return (
    <ErrorBoundary>
      <div className="font-sans text-navy-900 antialiased selection:bg-accent/20 selection:text-accent-dark">
        <AnimatePresence mode="wait">
          {currentPage === 'landing' &&
          <LandingPage key="landing" onGetStarted={goToIntake} />
          }

          {currentPage === 'intake' &&
          <IntakeFormPage key="intake" onSubmit={submitForm} onBack={goBack} />
          }

          {currentPage === 'analyzing' &&
          <AnalyzingPage key="analyzing" onComplete={goToResults} />
          }

          {currentPage === 'results' &&
          <Suspense fallback={<LoadingFallback />}>
            <ResultsDashboard
              key="results"
              results={results}
              formData={formData} />
          </Suspense>
          }

          {currentPage === 'error' &&
          <ErrorPage
            key="error"
            onRetry={retrySubmit}
            onBack={goBack}
            errorMessage={errorMessage} />
          }
        </AnimatePresence>
      </div>
    </ErrorBoundary>);
}
