import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
// Menu and X icons removed — mobile uses BottomTabBar instead of hamburger sidebar
import { LinkedInNav } from '../components/ui/LinkedInNav';
import { Sidebar } from '../components/dashboard/Sidebar';
import { PersonalOverviewSection } from '../components/dashboard/PersonalOverviewSection';
import { PersonalRoadmapSection } from '../components/dashboard/PersonalRoadmapSection';
import { NextStepsSection } from '../components/dashboard/NextStepsSection';
import { ShareScoreCard } from '../components/dashboard/ShareScoreCard';
import { PeerBenchmarkSection } from '../components/dashboard/PeerBenchmarkSection';
import { ChallengeColleagueSection } from '../components/dashboard/ChallengeColleagueSection';
import { ScoreReveal } from '../components/dashboard/ScoreReveal';
import { StickyShareBar } from '../components/dashboard/StickyShareBar';
import { BottomTabBar } from '../components/dashboard/BottomTabBar';
import { SkillGapMatrixSection } from '../components/dashboard/SkillGapMatrixSection';
import { DisruptionTimelineSection } from '../components/dashboard/DisruptionTimelineSection';
import { CareerPathwaysSection } from '../components/dashboard/CareerPathwaysSection';
import { WhatIfSimulatorSection } from '../components/dashboard/WhatIfSimulatorSection';
import { ActionTrackerSection } from '../components/dashboard/ActionTrackerSection';
import { AINewsFeedSection } from '../components/dashboard/AINewsFeedSection';
import { LearningResourcesSection } from '../components/dashboard/LearningResourcesSection';
import { MockResults } from '../data/mockResults';

const SECTION_DESCRIPTIONS: Record<string, string> = {
  overview: 'Your overall AI readiness profile based on your LinkedIn data. This is how you compare to professionals in your role and industry.',
  skills: 'A map of your skills plotted by current proficiency vs. market demand. Focus on skills with high demand and low proficiency.',
  disruption: 'A timeline showing when specific tasks in your role are likely to be automated. Earlier dates mean higher urgency to adapt.',
  pathways: 'Three possible career directions based on your current skills and market trends. The recommended path has the best fit for your profile.',
  whatif: 'Explore how acquiring new skills or certifications would change your score. Try different scenarios to find the highest-impact investments.',
  actions: 'Your personalized action items organized by priority. Complete these to improve your AI readiness over the next 90 days.',
  share: 'Share your score with your network or compare against industry benchmarks. Sharing drives accountability and attracts AI-ready talent.',
  roadmap: 'A month-by-month plan for the next 90 days. Each action is tied to a specific skill gap or opportunity from your assessment.',
  newsfeed: 'AI developments relevant to your role and industry. Stay current on the trends that directly affect your career trajectory.',
  learning: 'Curated courses, articles, and tools matched to your specific skill gaps. Start with the highest-priority resources.',
};

interface ResultsDashboardProps {
  results: MockResults;
  formData: any;
  onBackToHome?: () => void;
}
export function ResultsDashboard({ results, formData, onBackToHome }: ResultsDashboardProps) {
  const [showReveal, setShowReveal] = useState(true);
  const [activeSection, setActiveSection] = useState('overview');
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
  // If backend result exists, scroll to top once shown
  useEffect(() => {
    if (formData?.backend?.result) {
      window.scrollTo(0, 0);
    }
  }, [formData]);
  const renderSection = () => {
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
            results={results}
            onBackToHome={onBackToHome} />


          <div className="flex-1 flex flex-col h-full overflow-hidden relative">
            {/* Main Content Area */}
            <main className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-12 scroll-smooth">
              <div className="max-w-5xl mx-auto space-y-8 pb-36 lg:pb-28">
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
                    Personal Dashboard
                  </div>
                  <h1 className="text-3xl font-bold font-serif text-dark-textPri capitalize">
                    {activeSection === 'next' ?
                      'Next Steps' :
                      activeSection === 'share' ?
                        'Share & Compare' :
                        activeSection === 'actions' ?
                          'Action Tracker' :
                          activeSection === 'newsfeed' ?
                            'AI News Feed' :
                            activeSection === 'learning' ?
                              'Learning Resources' :
                              activeSection.replace(/([A-Z])/g, ' $1').trim()}
                  </h1>
                  {SECTION_DESCRIPTIONS[activeSection] && (
                    <p className="text-sm text-dark-textMuted mt-2">
                      {SECTION_DESCRIPTIONS[activeSection]}
                    </p>
                  )}
                </div>

                <motion.div
                  key={activeSection}
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

        {/* Sticky Share Bar — hidden on mobile when bottom tab bar is shown */}
        {!showReveal && activeSection !== 'share' &&
          <div className="hidden lg:block">
            <StickyShareBar results={results} />
          </div>
        }

        {/* Mobile Bottom Tab Bar */}
        <BottomTabBar activeSection={activeSection} onNavigate={setActiveSection} />
      </div>
    </>);

}