import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '../ui/Button';
interface HeroSectionProps {
  onGetStarted: () => void;
}
export function HeroSection({ onGetStarted }: HeroSectionProps) {
  return (
    <section className="relative w-full bg-gradient-to-b from-white to-linkedin-bg overflow-hidden py-32 md:py-40 px-4">
      {/* Background Network Graphic */}
      <div className="absolute inset-0 pointer-events-none opacity-10">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern
              id="grid"
              width="40"
              height="40"
              patternUnits="userSpaceOnUse">
              
              <circle cx="2" cy="2" r="1" fill="#0A66C2" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      <div className="relative max-w-5xl mx-auto text-center z-10">
        <motion.div
          initial={{
            opacity: 0,
            y: 20
          }}
          animate={{
            opacity: 1,
            y: 0
          }}
          transition={{
            duration: 0.6
          }}>
          
          <h1 className="text-5xl md:text-7xl font-extrabold text-gray-900 tracking-tight mb-6 leading-[1.1]">
            Will AI{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-linkedin to-linkedin-light">
              Replace
            </span>{' '}
            You?
          </h1>
        </motion.div>

        <motion.div
          initial={{
            opacity: 0,
            y: 20
          }}
          animate={{
            opacity: 1,
            y: 0
          }}
          transition={{
            duration: 0.6,
            delay: 0.2
          }}>
          
          <p className="text-xl md:text-2xl text-gray-600 font-light max-w-3xl mx-auto mb-10 leading-relaxed">
            Paste your LinkedIn profile. Get your AI Resilience Score™ in 60
            seconds.
            <br className="hidden md:block" />
            See where AI impacts your function — and what to deploy next.
          </p>
        </motion.div>

        <motion.div
          initial={{
            opacity: 0,
            y: 20
          }}
          animate={{
            opacity: 1,
            y: 0
          }}
          transition={{
            duration: 0.6,
            delay: 0.4
          }}
          className="flex flex-col items-center">
          
          <Button
            size="lg"
            onClick={onGetStarted}
            className="text-lg px-10 py-6 shadow-xl shadow-linkedin/20 bg-[#0A66C2] hover:bg-[#004182]">
            
            Get My AI Resilience Score
          </Button>
          <p className="mt-6 text-sm text-gray-500 font-medium tracking-wide uppercase">
            Built for executive leaders navigating AI transformation
          </p>
        </motion.div>
      </div>
    </section>);

}