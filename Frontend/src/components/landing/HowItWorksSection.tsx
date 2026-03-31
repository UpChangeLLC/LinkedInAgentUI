import React from 'react';
import { Link, Brain, BarChart3 } from 'lucide-react';
export function HowItWorksSection() {
  const steps = [
  {
    icon: Link,
    title: 'Paste your LinkedIn URL',
    desc: 'We analyze your public profile data.'
  },
  {
    icon: Brain,
    title: 'AI analyzes profile & industry',
    desc: 'Benchmarked against industry data.'
  },
  {
    icon: BarChart3,
    title: 'Get personal + corporate dashboard',
    desc: 'Actionable roadmap for your role.'
  }];

  return (
    <section className="py-24 bg-linkedin-bg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-gray-900">How It Works</h2>
        </div>

        <div className="relative grid grid-cols-1 md:grid-cols-3 gap-12">
          {/* Connector Line (Desktop) */}
          <div className="hidden md:block absolute top-12 left-[16%] right-[16%] h-0.5 bg-gray-300 -z-10" />

          {steps.map((step, index) =>
          <div key={index} className="flex flex-col items-center text-center">
              <div className="w-24 h-24 bg-white rounded-full border border-gray-200 shadow-sm flex items-center justify-center mb-6 relative z-10">
                <step.icon
                className="w-10 h-10 text-linkedin"
                strokeWidth={1.5} />
              
                <div className="absolute -top-2 -right-2 w-8 h-8 bg-linkedin rounded-full flex items-center justify-center text-white font-bold text-sm border-4 border-linkedin-bg">
                  {index + 1}
                </div>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                {step.title}
              </h3>
              <p className="text-gray-600">{step.desc}</p>
            </div>
          )}
        </div>
      </div>
    </section>);

}