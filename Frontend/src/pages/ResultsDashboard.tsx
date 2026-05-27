import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, CreditCard, LockKeyhole, Menu, MessageCircle, X } from 'lucide-react';
import { LinkedInNav } from '../components/ui/LinkedInNav';
import { Button } from '../components/ui/Button';
import { Sidebar } from '../components/dashboard/Sidebar';
import { PersonalOverviewSection } from '../components/dashboard/PersonalOverviewSection';
import { PersonalRoadmapSection } from '../components/dashboard/PersonalRoadmapSection';
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
import { AINewsFeedSection } from '../components/dashboard/AINewsFeedSection';
import { LearningResourcesSection } from '../components/dashboard/LearningResourcesSection';
import { PremiumTeaser, type Tier } from '../components/dashboard/PremiumTeaser';
import { MockResults } from '../data/mockResults';
import { CareerChatPage } from './CareerChatPage';

/** Sections gated behind Premium on the free tier (spec 01 §6.2). The score,
 * profile overview, and share card stay free as the lead magnet + referral. */
const PREMIUM_SECTION_TEASERS: Record<string, string> = {
  skills: 'See exactly where your skills fall short of market demand.',
  disruption: 'See when the changes hit your role — task by task.',
  pathways: 'Explore alternative career trajectories tuned to your profile.',
  whatif: 'Simulate how new skills would move your score.',
  actions: 'Your personalized action plan, ranked by impact.',
  roadmap: 'Your personalized 90-day roadmap.',
  newsfeed: 'Curated AI news + role impact for your field.',
  learning: 'Curated courses and reading matched to your gaps.',
};

const SUBSCRIPTION_PLANS = [
  { id: 'monthly', name: 'Monthly', price: '$9', cadence: '/month', months: 1, badge: 'Flexible' },
  { id: 'quarterly', name: 'Quarterly', price: '$24', cadence: '/3 months', months: 3, badge: 'Popular' },
  { id: 'annual', name: 'Annual', price: '$79', cadence: '/year', months: 12, badge: 'Best value' },
] as const;

type SubscriptionPlanId = (typeof SUBSCRIPTION_PLANS)[number]['id'];

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
  onSubscriptions?: () => void;
  accountName?: string;
  onDashboard?: () => void;
  onRecalculate?: () => void;
  onLogout?: () => void;
  /** Opens Career Mentor with assessment context from this dashboard. */
  onOpenCareerMentor?: () => void;
  seedAssessmentContext?: string;
  subscriptionActive?: boolean;
  paywallLocked?: boolean;
  showScoreReveal?: boolean;
  onScoreRevealComplete?: () => void;
  subscriptionSubmitting?: boolean;
  onActivateSubscription?: (planId?: string, paymentMethod?: Record<string, unknown>) => void;
}
export function ResultsDashboard({
  results,
  formData,
  onBackToHome,
  onSubscriptions,
  accountName,
  onDashboard,
  onRecalculate,
  onLogout,
  onOpenCareerMentor,
  seedAssessmentContext,
  subscriptionActive = false,
  showScoreReveal = false,
  onScoreRevealComplete,
  subscriptionSubmitting = false,
  onActivateSubscription,
}: ResultsDashboardProps) {
  const [activeSection, setActiveSection] = useState('overview');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMentorOpen, setIsMentorOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlanId>('quarterly');
  // Section-level freemium gating replaces the old time-window paywall: free
  // users get a usable dashboard with premium sections shown as teasers, and the
  // upsell modal opens on demand (from a teaser CTA) rather than on a timer.
  const [showUpsell, setShowUpsell] = useState(false);
  const tier: Tier = subscriptionActive ? 'premium' : 'free';
  const mainScrollRef = useRef<HTMLElement | null>(null);
  const selectedSubscription = SUBSCRIPTION_PLANS.find((plan) => plan.id === selectedPlan) || SUBSCRIPTION_PLANS[1];
  const openUpsell = useCallback(() => setShowUpsell(true), []);
  const openCareerMentor = useCallback(() => {
    if (tier === 'free') {
      setShowUpsell(true);
      return;
    }
    onOpenCareerMentor?.();
    setIsMentorOpen(true);
  }, [tier, onOpenCareerMentor]);
  const submitPayment = useCallback((event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onActivateSubscription?.(selectedSubscription.id, {
      name_on_card: String(form.get('name_on_card') || ''),
      card_number: String(form.get('card_number') || ''),
      expiry: String(form.get('expiry') || ''),
      cvc: String(form.get('cvc') || ''),
    });
  }, [onActivateSubscription, selectedSubscription.id]);
  const handleRevealComplete = useCallback(() => {
    onScoreRevealComplete?.();
  }, [onScoreRevealComplete]);

  const handleNavigateSection = useCallback((section: string) => {
    setActiveSection(section);
    setIsSidebarOpen(false);
  }, []);

  useEffect(() => {
    mainScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeSection]);

  // Close the upsell once the user becomes a subscriber.
  useEffect(() => {
    if (subscriptionActive) setShowUpsell(false);
  }, [subscriptionActive]);

  useEffect(() => {
    if (!isMentorOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMentorOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isMentorOpen]);
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
        {showScoreReveal &&
          <ScoreReveal results={results} onComplete={handleRevealComplete} />
        }
      </AnimatePresence>

      <div className="relative h-[100dvh] min-h-0 bg-dark-bg overflow-hidden">
        <div className="flex flex-col h-full min-h-0">
        <LinkedInNav
          onCareerMentor={openCareerMentor}
          onSubscriptions={onSubscriptions}
          accountName={accountName}
          onDashboard={onDashboard}
          onRecalculate={onRecalculate}
          onLogout={onLogout}
        />

        <div className="flex flex-1 min-h-0 overflow-hidden">
          <Sidebar
            activeSection={activeSection}
            onNavigate={handleNavigateSection}
            isOpen={isSidebarOpen}
            onClose={() => setIsSidebarOpen(false)}
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
            <main ref={mainScrollRef} className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-12 scroll-smooth">
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

                  {tier === 'free' && PREMIUM_SECTION_TEASERS[activeSection] ? (
                    <PremiumTeaser
                      tier="free"
                      title="Premium section"
                      teaser={PREMIUM_SECTION_TEASERS[activeSection]}
                      sourceSection={activeSection}
                      onUnlock={openUpsell}
                    >
                      {renderSection()}
                    </PremiumTeaser>
                  ) : (
                    renderSection()
                  )}
                </motion.div>
              </div>
            </main>
          </div>
        </div>

        {/* Sticky Share Bar */}
        {!showScoreReveal && activeSection !== 'share' &&
          <StickyShareBar results={results} />
        }

        {!isMentorOpen && (
          <motion.button
            type="button"
            onClick={openCareerMentor}
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            whileHover={{ scale: 1.03, y: -1 }}
            whileTap={{ scale: 0.98 }}
            className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-linkedin px-5 py-3 text-sm font-semibold text-white shadow-2xl hover:bg-linkedin/90 transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            Career Mentor
          </motion.button>
        )}
        </div>

        <AnimatePresence>
          {isMentorOpen && tier === 'premium' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[90] bg-black/10"
              onClick={() => setIsMentorOpen(false)}
            >
              <motion.aside
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', stiffness: 280, damping: 32 }}
                className="absolute right-0 top-0 h-full w-full max-w-[440px] border-l border-dark-border bg-dark-bg shadow-2xl"
                onClick={(event) => event.stopPropagation()}
              >
                <CareerChatPage
                  embedded
                  seedAssessmentContext={seedAssessmentContext}
                  onClose={() => setIsMentorOpen(false)}
                />
              </motion.aside>
            </motion.div>
          )}
        </AnimatePresence>

        {showUpsell && tier === 'free' && (
          <div className="fixed inset-0 z-[100] bg-dark-bg/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
            <div className="relative w-full max-w-4xl rounded-2xl border border-dark-border bg-dark-card p-6 shadow-2xl">
              <button
                type="button"
                onClick={() => setShowUpsell(false)}
                aria-label="Close"
                className="absolute right-4 top-4 text-dark-textMuted hover:text-dark-textPri"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="mx-auto w-12 h-12 rounded-full bg-dark-accentDim flex items-center justify-center mb-4">
                <LockKeyhole className="w-6 h-6 text-dark-accent" />
              </div>
              <div className="text-center mb-6">
                <h2 className="text-2xl font-serif font-bold text-dark-textPri mb-2">
                  Unlock your full dashboard
                </h2>
                <p className="text-sm text-dark-textMuted">
                  Premium unlocks your action plan, roadmap, skill gaps, learning resources,
                  Career Mentor, and unlimited re-runs.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
                {SUBSCRIPTION_PLANS.map((plan) => {
                  const active = selectedPlan === plan.id;
                  return (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => setSelectedPlan(plan.id)}
                      className={`text-left rounded-xl border p-4 transition-colors ${
                        active
                          ? 'border-linkedin bg-linkedin/10 ring-1 ring-linkedin'
                          : 'border-dark-border bg-dark-bg/50 hover:border-dark-accent/50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="font-semibold text-dark-textPri">{plan.name}</span>
                        <span className="rounded-full bg-dark-accentDim px-2 py-0.5 text-[11px] text-dark-accent">
                          {plan.badge}
                        </span>
                      </div>
                      <div className="flex items-end gap-1">
                        <span className="text-3xl font-bold text-dark-textPri">{plan.price}</span>
                        <span className="text-sm text-dark-textMuted mb-1">{plan.cadence}</span>
                      </div>
                      {active && (
                        <div className="mt-3 flex items-center gap-1 text-xs text-linkedin">
                          <CheckCircle className="w-3.5 h-3.5" />
                          Selected
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              <form onSubmit={submitPayment} className="rounded-xl border border-dark-border bg-dark-bg/60 p-4">
                <div className="flex items-center gap-2 text-dark-textPri font-semibold mb-4">
                  <CreditCard className="w-4 h-4 text-dark-accent" />
                  Payment method
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    required
                    name="name_on_card"
                    placeholder="Name on card"
                    className="rounded-lg border border-dark-border bg-dark-card px-3 py-3 text-sm text-dark-textPri placeholder:text-dark-textMuted focus:outline-none focus:ring-2 focus:ring-dark-accent/40"
                  />
                  <input
                    required
                    name="card_number"
                    inputMode="numeric"
                    placeholder="Card number"
                    className="rounded-lg border border-dark-border bg-dark-card px-3 py-3 text-sm text-dark-textPri placeholder:text-dark-textMuted focus:outline-none focus:ring-2 focus:ring-dark-accent/40"
                  />
                  <input
                    required
                    name="expiry"
                    placeholder="MM / YY"
                    className="rounded-lg border border-dark-border bg-dark-card px-3 py-3 text-sm text-dark-textPri placeholder:text-dark-textMuted focus:outline-none focus:ring-2 focus:ring-dark-accent/40"
                  />
                  <input
                    required
                    name="cvc"
                    inputMode="numeric"
                    placeholder="CVC"
                    className="rounded-lg border border-dark-border bg-dark-card px-3 py-3 text-sm text-dark-textPri placeholder:text-dark-textMuted focus:outline-none focus:ring-2 focus:ring-dark-accent/40"
                  />
                </div>
                <Button
                  type="submit"
                  fullWidth
                  disabled={subscriptionSubmitting || !onActivateSubscription}
                  className="bg-linkedin hover:bg-linkedin/90 mt-4"
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  {subscriptionSubmitting
                    ? 'Processing payment...'
                    : `Pay ${selectedSubscription.price} and continue`}
                </Button>
                <p className="text-xs text-dark-textMuted text-center mt-3">
                  Secure checkout. You can cancel anytime from your account settings.
                </p>
              </form>
            </div>
          </div>
        )}
      </div>
    </>);

}