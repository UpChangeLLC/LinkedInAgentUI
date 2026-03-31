import React from 'react';
import { motion } from 'framer-motion';
import { LinkedInNav } from '../components/ui/LinkedInNav';
import { HeroSection } from '../components/landing/HeroSection';
import { RecentlyAssessedTicker } from '../components/landing/RecentlyAssessedTicker';
import { SocialProofSection } from '../components/landing/SocialProofSection';
import { HowItWorksSection } from '../components/landing/HowItWorksSection';
import { TrustPrivacyBlock } from '../components/landing/TrustPrivacyBlock';
import { CTASection } from '../components/landing/CTASection';
import { Button } from '../components/ui/Button';
interface LandingPageProps {
  onGetStarted: () => void;
}
export function LandingPage({ onGetStarted }: LandingPageProps) {
  return (
    <motion.div
      initial={{
        opacity: 0
      }}
      animate={{
        opacity: 1
      }}
      exit={{
        opacity: 0
      }}
      className="min-h-screen bg-white">
      
      <LinkedInNav />
      <HeroSection onGetStarted={onGetStarted} />
      <RecentlyAssessedTicker />
      <SocialProofSection />
      <HowItWorksSection />
      <TrustPrivacyBlock />
      <CTASection onGetStarted={onGetStarted} />

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-12 px-4">
        <div className="max-w-3xl mx-auto text-center space-y-3">
          <p className="text-gray-500 text-sm">
            © 2024 AI Resilience Score™. All rights reserved. A product of{' '}
            <span className="font-semibold text-gray-700">UpChange PLC</span>.
          </p>
          <p className="text-gray-400 text-xs leading-relaxed max-w-xl mx-auto">
            AI Resilience Score™ is not affiliated with, endorsed by, or
            connected to LinkedIn Corporation. We use publicly available data,
            LLM-generated analysis, and our own proprietary models to generate
            results.
          </p>
        </div>
      </footer>

      {/* Mobile Sticky CTA */}
      <div className="md:hidden fixed bottom-0 left-0 w-full p-4 bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-50">
        <Button fullWidth onClick={onGetStarted} className="bg-[#0A66C2]">
          Get My Score
        </Button>
      </div>
    </motion.div>);

}