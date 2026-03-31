import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { LinkedInNav } from '../components/ui/LinkedInNav';
import { Sidebar } from '../components/dashboard/Sidebar';
import { OverviewSection } from '../components/dashboard/OverviewSection';
import { PersonalOverviewSection } from '../components/dashboard/PersonalOverviewSection';
import { PersonalRoadmapSection } from '../components/dashboard/PersonalRoadmapSection';
import { WorkflowImpactSection } from '../components/dashboard/WorkflowImpactSection';
import { LeveragePlaysSection } from '../components/dashboard/LeveragePlaysSection';
import { GovernanceSection } from '../components/dashboard/GovernanceSection';
import { ThirtyDayPlanSection } from '../components/dashboard/ThirtyDayPlanSection';
import { NextStepsSection } from '../components/dashboard/NextStepsSection';
import { ShareScoreCard } from '../components/dashboard/ShareScoreCard';
import { PeerBenchmarkSection } from '../components/dashboard/PeerBenchmarkSection';
import { ChallengeColleagueSection } from '../components/dashboard/ChallengeColleagueSection';
import { ScoreReveal } from '../components/dashboard/ScoreReveal';
import { StickyShareBar } from '../components/dashboard/StickyShareBar';
import { MockResults } from '../data/mockResults';
interface ResultsDashboardProps {
  results: MockResults;
  formData: any;
}
export function ResultsDashboard({ results, formData }: ResultsDashboardProps) {
  const [showReveal, setShowReveal] = useState(true);
  const [activeSection, setActiveSection] = useState('overview');
  const [view, setView] = useState<'personal' | 'corporate'>('personal');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const handleRevealComplete = useCallback(() => {
    setShowReveal(false);
  }, []);
  // Scroll to section when activeSection changes
  useEffect(() => {
    const element = document.getElementById(activeSection);
    if (element) {
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  }, [activeSection]);
  // Reset section when view changes
  useEffect(() => {
    setActiveSection('overview');
  }, [view]);
  // If backend result exists, scroll to top once shown
  useEffect(() => {
    if (formData?.backend?.result) {
      window.scrollTo(0, 0);
    }
  }, [formData]);
  const renderSection = () => {
    if (view === 'personal') {
      switch (activeSection) {
        case 'overview':
          return <PersonalOverviewSection results={results} />;
        case 'share':
          return (
            <div className="space-y-12">
              <ShareScoreCard results={results} />
              <PeerBenchmarkSection results={results} />
              <ChallengeColleagueSection />
            </div>);

        case 'roadmap':
          return <PersonalRoadmapSection results={results} />;
        case 'next':
          return <NextStepsSection />;
        default:
          return <PersonalOverviewSection results={results} />;
      }
    } else {
      switch (activeSection) {
        case 'overview':
          return <OverviewSection results={results} />;
        case 'workflow':
          return <WorkflowImpactSection results={results} />;
        case 'leverage':
          return <LeveragePlaysSection results={results} />;
        case 'governance':
          return <GovernanceSection results={results} />;
        case 'plan':
          return <ThirtyDayPlanSection results={results} />;
        case 'next':
          return <NextStepsSection />;
        default:
          return <OverviewSection results={results} />;
      }
    }
  };
  return (
    <>
      {/* Score Reveal Overlay */}
      <AnimatePresence>
        {showReveal &&
          <ScoreReveal results={results} onComplete={handleRevealComplete} />
        }
      </AnimatePresence>

      <div className="flex flex-col h-screen bg-linkedin-bg overflow-hidden">
        <LinkedInNav />

        <div className="flex flex-1 overflow-hidden">
          <Sidebar
            activeSection={activeSection}
            onNavigate={setActiveSection}
            isOpen={isSidebarOpen}
            onClose={() => setIsSidebarOpen(false)}
            view={view}
            onViewChange={setView}
            results={results} />


          <div className="flex-1 flex flex-col h-full overflow-hidden relative">
            {/* Mobile Header Toggle */}
            <button
              className="lg:hidden absolute top-4 right-4 z-40 p-2 bg-white rounded-md shadow-sm border border-gray-200"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}>

              {isSidebarOpen ?
                <X className="w-6 h-6" /> :

                <Menu className="w-6 h-6" />
              }
            </button>

            {/* Main Content Area */}
            <main className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-12 scroll-smooth">
              <div className="max-w-5xl mx-auto space-y-8 pb-28">
                {/* Backend Executive Summary (if available) */}
                {formData?.backend?.result && (
                  <div className="mb-6 p-4 rounded-md border border-emerald-200 bg-emerald-50">
                    <div className="text-sm text-emerald-700 font-semibold mb-1">
                      Live Analysis Summary
                    </div>
                    <div className="text-emerald-900 text-sm whitespace-pre-line">
                      {formData.backend.result.executive_summary ||
                        formData.backend.result.summary ||
                        'Analysis completed.'}
                    </div>
                  </div>
                )}
                <div className="mb-8">
                  <div className="flex items-center gap-2 text-sm text-gray-500 mb-2 uppercase tracking-wider font-semibold">
                    {view} Dashboard
                  </div>
                  <h1 className="text-3xl font-bold text-gray-900 capitalize">
                    {activeSection === 'plan' ?
                      '30-Day Plan' :
                      activeSection === 'next' ?
                        'Next Steps' :
                        activeSection === 'share' ?
                          'Share & Compare' :
                          activeSection.replace(/([A-Z])/g, ' $1').trim()}
                  </h1>
                </div>

                <motion.div
                  key={`${view}-${activeSection}`}
                  initial={{
                    opacity: 0,
                    y: 10
                  }}
                  animate={{
                    opacity: 1,
                    y: 0
                  }}
                  transition={{
                    duration: 0.3
                  }}>

                  {renderSection()}
                </motion.div>
              </div>
            </main>
          </div>
        </div>

        {/* Sticky Share Bar */}
        {!showReveal && activeSection !== 'share' &&
          <StickyShareBar results={results} />
        }
      </div>
    </>);

}