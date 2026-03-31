import React from 'react';
import { Button } from '../ui/Button';
import { ExternalLink } from 'lucide-react';
interface CTASectionProps {
  onGetStarted: () => void;
}
export function CTASection({ onGetStarted }: CTASectionProps) {
  return (
    <section className="py-24 bg-[#004182] text-center px-4">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
          Ready to see your AI exposure?
        </h2>
        <p className="text-blue-200 text-lg mb-8 max-w-2xl mx-auto">
          Get your personalized AI Resilience Score in 60 seconds — or join our
          executive workshop for hands-on guidance.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button
            size="lg"
            onClick={onGetStarted}
            className="px-12 py-6 text-lg bg-[#0A66C2] hover:bg-white hover:text-[#0A66C2] transition-colors">
            
            Generate My Score
          </Button>
        </div>

        <p className="mt-8 text-blue-300 text-sm">
          Looking for hands-on guidance? Explore the{' '}
          <a
            href="https://hyperaccelerator.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white font-semibold underline underline-offset-2 hover:text-blue-100 transition-colors">
            
            Executive AI Accelerator
          </a>{' '}
          by HyperAccelerator — a recommended program for leaders navigating AI
          transformation.
        </p>
      </div>
    </section>);

}