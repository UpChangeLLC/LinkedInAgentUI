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
import { SkillGapMatrixSection } from '../components/dashboard/SkillGapMatrixSection';
import { DisruptionTimelineSection } from '../components/dashboard/DisruptionTimelineSection';
import { CareerPathwaysSection } from '../components/dashboard/CareerPathwaysSection';
import { WhatIfSimulatorSection } from '../components/dashboard/WhatIfSimulatorSection';
import { ActionTrackerSection } from '../components/dashboard/ActionTrackerSection';
import { AssessmentHistorySection } from '../components/dashboard/AssessmentHistorySection';
import { AINewsFeedSection } from '../components/dashboard/AINewsFeedSection';
import { LearningResourcesSection } from '../components/dashboard/LearningResourcesSection';
import { ROICalculatorSection } from '../components/dashboard/ROICalculatorSection';
import { MockResults } from '../data/mockResults';
interface ResultsDashboardProps {
  results: MockResults;
  formData: any;
  onBackToHome?: () => void;
}
export function ResultsDashboard({ results, formData, onBackToHome }: ResultsDashboardProps) {
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
              <ChallengeColleagueSection
                urlHash={results.urlHash}
                score={results.score}
                displayName={results.personalProfile?.name || 'You'}
                roleCategory={results.personalProfile?.title || ''}
              />
            </div>);

        case 'skills':
          return <SkillGapMatrixSection skills={results.skillGapMatrix} />;
        case 'disruption':
          return (
            <DisruptionTimelineSection
              items={results.disruptionTimeline}
              roleName={results.personalProfile?.title}
            />
          );
        case 'pathways':
          return (
            <CareerPathwaysSection
              pathways={results.careerPathways}
              currentRole={results.personalProfile?.title}
            />
          );
        case 'whatif':
          return (
            <WhatIfSimulatorSection
              currentScore={results.score}
              riskBand={results.riskBand}
              currentRole={results.personalProfile?.title}
            />
          );
        case 'actions':
          return (
            <ActionTrackerSection
              urlHash={results.urlHash || ''}
              fallbackActions={results.actionItems?.map((a) => ({
                id: a.id,
                title: a.title,
                description: a.description,
                category: a.category,
                priority: a.priority,
                estimated_hours: a.estimatedHours,
                resource_url: a.resourceUrl,
                resource_title: a.resourceTitle,
                status: a.status,
                completed_at: a.completedAt,
              })) || []}
            />
          );
        case 'roadmap':
          return <PersonalRoadmapSection results={results} />;
        case 'history':
          return <AssessmentHistorySection urlHash={results.urlHash || ''} />;
        case 'newsfeed':
          return (
            <AINewsFeedSection
              role={results.personalProfile?.title}
              industry={results.personalProfile?.industry}
              topSkillGaps={results.skillGapMatrix?.slice(0, 3).map((s) => s.name)}
            />
          );
        case 'learning':
          return <LearningResourcesSection skills={results.skillGapMatrix} />;
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
        case 'roi':
          return <ROICalculatorSection workflowItems={results.workflowItems} />;
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

      <div className="flex flex-col h-screen bg-dark-bg overflow-hidden">
        <LinkedInNav />

        <div className="flex flex-1 overflow-hidden">
          <Sidebar
            activeSection={activeSection}
            onNavigate={setActiveSection}
            isOpen={isSidebarOpen}
            onClose={() => setIsSidebarOpen(false)}
            view={view}
            onViewChange={setView}
            results={results}
            onBackToHome={onBackToHome} />


          <div className="flex-1 flex flex-col h-full overflow-hidden relative">
            {/* Mobile Header Toggle */}
            <button
              className="lg:hidden absolute top-4 right-4 z-40 p-2 bg-dark-card rounded-md border border-dark-border text-dark-textSec"
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
                  <div className="mb-6 p-4 rounded-md border border-dark-accent/20 bg-dark-accentDim">
                    <div className="text-sm text-dark-accent font-semibold mb-1">
                      Live Analysis Summary
                    </div>
                    <div className="text-dark-textPri text-sm whitespace-pre-line">
                      {formData.backend.result.executive_summary ||
                        formData.backend.result.summary ||
                        'Analysis completed.'}
                    </div>
                  </div>
                )}
                <div className="mb-8">
                  <div className="flex items-center gap-2 text-[11px] text-dark-accent mb-2 uppercase tracking-widest font-semibold">
                    {view} Dashboard
                  </div>
                  <h1 className="text-3xl font-bold font-serif text-dark-textPri capitalize">
                    {activeSection === 'plan' ?
                      '30-Day Plan' :
                      activeSection === 'next' ?
                        'Next Steps' :
                        activeSection === 'share' ?
                          'Share & Compare' :
                          activeSection === 'actions' ?
                            'Action Tracker' :
                            activeSection === 'history' ?
                              'Assessment History' :
                              activeSection === 'newsfeed' ?
                                'AI News Feed' :
                                activeSection === 'learning' ?
                                  'Learning Resources' :
                                  activeSection === 'roi' ?
                                    'ROI Calculator' :
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