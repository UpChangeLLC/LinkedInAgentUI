import React from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
export function SocialProofSection() {
  const benefits = [
  'Identify automation exposure in your function',
  'Surface AI leverage plays in 30 days',
  'Understand governance & risk implications',
  'Build a 90-day adoption roadmap'];

  const companies = [
  'Microsoft',
  'Deloitte',
  'McKinsey',
  'Accenture',
  'JPMorgan',
  'Google'];

  return (
    <section className="py-20 bg-white border-b border-surface-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-8">
              Why Executives Are Using This
            </h2>
            <ul className="space-y-4">
              {benefits.map((benefit, index) =>
              <motion.li
                key={index}
                initial={{
                  opacity: 0,
                  x: -20
                }}
                whileInView={{
                  opacity: 1,
                  x: 0
                }}
                viewport={{
                  once: true
                }}
                transition={{
                  delay: index * 0.1
                }}
                className="flex items-start">
                
                  <div className="flex-shrink-0 mt-1">
                    <div className="w-5 h-5 rounded-full bg-linkedin/10 flex items-center justify-center">
                      <Check className="w-3 h-3 text-linkedin" />
                    </div>
                  </div>
                  <span className="ml-4 text-lg text-gray-700">{benefit}</span>
                </motion.li>
              )}
            </ul>
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-6">
              Trusted by leaders at
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
              {companies.map((company, i) =>
              <div key={i} className="h-16 flex items-center justify-center">
                  <span className="text-xl font-bold text-gray-400 tracking-tight hover:text-gray-600 transition-colors cursor-default">
                    {company}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>);

}