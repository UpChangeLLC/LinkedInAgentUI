import React from 'react';
import { Accordion } from '../ui/Accordion';
import { MockResults } from '../../data/mockResults';
import { Calendar, CheckSquare, UserCircle, ExternalLink } from 'lucide-react';
interface ThirtyDayPlanSectionProps {
  results: MockResults;
}
export function ThirtyDayPlanSection({ results }: ThirtyDayPlanSectionProps) {
  return (
    <div className="space-y-8">
      <div className="bg-linkedin-bg p-6 rounded-xl border border-linkedin/20">
        <h2 className="text-2xl font-bold text-linkedin-dark">
          Your 30-Day AI Transformation Plan for TechCorp
        </h2>
        <p className="text-gray-600 mt-2">
          Immediate, high-impact actions to secure your Series C operational
          foundation.
        </p>
      </div>

      <div className="relative pl-8 border-l-2 border-gray-200 space-y-12">
        {results.planItems.map((item, index) =>
        <div key={index} className="relative">
            {/* Timeline Dot */}
            <div className="absolute -left-[41px] top-0 w-5 h-5 rounded-full border-4 border-white bg-linkedin shadow-sm" />

            <div className="mb-4">
              <span className="text-sm font-bold text-linkedin uppercase tracking-wider">
                {item.week}
              </span>
              <h3 className="text-xl font-bold text-gray-900">{item.focus}</h3>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-6 space-y-6">
                <div>
                  <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                    <CheckSquare className="w-4 h-4" /> Action Steps
                  </h4>
                  <ul className="space-y-3">
                    {item.actionSteps.map((step, i) =>
                  <li key={i} className="flex items-start text-gray-700">
                        <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-gray-300 mt-2 mr-3" />
                        {step}
                      </li>
                  )}
                  </ul>
                </div>

                <div className="flex flex-col md:flex-row gap-4 pt-4 border-t border-gray-100">
                  <div className="flex-1 bg-green-50 p-4 rounded-lg border border-green-100">
                    <span className="text-xs font-bold text-green-700 uppercase block mb-1">
                      Expected Outcome
                    </span>
                    <p className="text-sm font-medium text-green-900">
                      {item.expectedOutcome}
                    </p>
                  </div>
                  <div className="flex items-center justify-center bg-gray-50 p-4 rounded-lg border border-gray-200 min-w-[160px]">
                    <div className="text-center">
                      <span className="text-xs font-bold text-gray-400 uppercase block mb-1">
                        Owner
                      </span>
                      <div className="flex items-center gap-2 text-sm font-bold text-gray-700">
                        <UserCircle className="w-4 h-4" />
                        {item.ownerRole}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Workshop CTA */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-gray-900">
            Want structured support executing this plan?
          </h3>
          <p className="text-sm text-gray-600">
            Based on your score, we recommend the{' '}
            <span className="font-semibold">Executive AI Accelerator</span> by
            HyperAccelerator — a cohort-based program with live coaching aligned
            to this roadmap.
          </p>
        </div>
        <a
          href="https://hyperaccelerator.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-white hover:bg-gray-100 text-gray-900 font-semibold px-6 py-3 rounded-lg transition-colors whitespace-nowrap flex-shrink-0 border border-gray-200">
          
          View Program <ExternalLink className="w-4 h-4 text-gray-400" />
        </a>
      </div>
    </div>);

}