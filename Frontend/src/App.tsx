import React from 'react';
import { AnimatePresence } from 'framer-motion';
import { LandingPage } from './pages/LandingPage';
import { IntakeFormPage } from './pages/IntakeFormPage';
import { AnalyzingPage } from './pages/AnalyzingPage';
import { ResultsDashboard } from './pages/ResultsDashboard';
import { useAppState } from './hooks/useAppState';
export function App() {
  const {
    currentPage,
    formData,
    results,
    goToIntake,
    submitForm,
    goToResults,
    goBack
  } = useAppState();
  return (
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
        <ResultsDashboard
          key="results"
          results={results}
          formData={formData} />

        }
      </AnimatePresence>
    </div>);

}