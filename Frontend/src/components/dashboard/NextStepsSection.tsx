import React from 'react';
import {
  Check,
  ExternalLink,
  Star,
  BookOpen,
  Users,
  Calendar,
  ArrowRight } from
'lucide-react';
import { Card } from '../ui/Card';
import { EXTERNAL_LINKS } from '../../lib/config';
import { Badge } from '../ui/Badge';
export function NextStepsSection() {
  return (
    <div className="space-y-8">
      {/* Section Intro */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">
          Curated Programs & Events
        </h2>
        <p className="text-gray-600 mt-2">
          Based on your AI Resilience Score and identified gaps, we've matched
          you with relevant executive programs and industry events.
        </p>
      </div>

      {/* Featured Program */}
      <div className="bg-white rounded-xl border-2 border-linkedin/30 shadow-md overflow-hidden">
        <div className="bg-linkedin/5 px-6 py-3 flex items-center justify-between border-b border-linkedin/10">
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-linkedin fill-linkedin" />
            <span className="text-sm font-bold text-linkedin">
              Featured — Best Match for Your Profile
            </span>
          </div>
          <Badge variant="success">COO Track Available</Badge>
        </div>

        <div className="p-8">
          <div className="flex flex-col md:flex-row gap-8">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h3 className="text-2xl font-bold text-gray-900">
                  Executive AI Accelerator
                </h3>
              </div>
              <p className="text-sm text-gray-500 mb-4">
                by HyperAccelerator • Live cohort-based program
              </p>

              <p className="text-gray-700 leading-relaxed mb-6">
                A structured, peer-driven program designed for C-suite leaders
                navigating AI transformation. Covers governance frameworks,
                workflow automation strategy, and team upskilling — directly
                relevant to the gaps identified in your assessment.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                {[
                'AI operating model frameworks',
                'Governance & compliance templates',
                'Peer benchmarking sessions',
                'Implementation roadmap workshop',
                'Executive AI workflow playbooks',
                '1:1 advisory sessions'].
                map((item, i) =>
                <div key={i} className="flex items-center text-sm">
                    <Check className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
                    <span className="text-gray-600">{item}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-6 text-sm text-gray-500 mb-6">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" /> Next cohort: Feb 2026
                </span>
                <span className="flex items-center gap-1.5">
                  <Users className="w-4 h-4" /> Limited to 25 executives
                </span>
              </div>

              <a
                href={EXTERNAL_LINKS.hyperaccelerator}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-linkedin hover:bg-[#004182] text-white font-semibold px-6 py-3 rounded-lg transition-colors">
                
                View Program Details
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>

            <div className="flex-shrink-0 w-full md:w-64 space-y-4">
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
                  Why We Recommend This
                </div>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-linkedin mt-1.5 flex-shrink-0" />
                    Addresses your governance gap (scored 40%)
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-linkedin mt-1.5 flex-shrink-0" />
                    COO-specific track matches your role
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-linkedin mt-1.5 flex-shrink-0" />
                    Enterprise SaaS cohort available
                  </li>
                </ul>
              </div>

              <div className="flex items-center gap-2 text-xs text-gray-400">
                <div className="flex -space-x-1">
                  {['JM', 'AK', 'RL'].map((initials, i) =>
                  <div
                    key={i}
                    className="w-6 h-6 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-[8px] font-bold text-gray-500">
                    
                      {initials}
                    </div>
                  )}
                </div>
                <span>847 executives enrolled</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Other Recommended Programs */}
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-4">
          Other Recommended Programs
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-6 flex items-start gap-4">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-lg flex-shrink-0">
              🎓
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-gray-900 mb-1">
                AI Strategy for Business Leaders
              </h4>
              <p className="text-xs text-gray-500 mb-2">
                MIT Sloan Executive Education • Online • 6 weeks
              </p>
              <p className="text-sm text-gray-600">
                Foundational AI strategy course with a focus on enterprise
                deployment and ROI measurement.
              </p>
            </div>
          </Card>

          <Card className="p-6 flex items-start gap-4">
            <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center text-lg flex-shrink-0">
              🤖
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-gray-900 mb-1">
                Generative AI for Executives
              </h4>
              <p className="text-xs text-gray-500 mb-2">
                Wharton Online • Self-paced • 4 weeks
              </p>
              <p className="text-sm text-gray-600">
                Deep dive into generative AI applications, governance, and
                organizational change management.
              </p>
            </div>
          </Card>
        </div>
      </div>

      {/* Industry Events */}
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-4">
          Upcoming Industry Events
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
          {
            name: 'AI World Congress',
            date: 'Mar 2026',
            location: 'London',
            type: 'Conference'
          },
          {
            name: 'Enterprise AI Summit',
            date: 'Apr 2026',
            location: 'San Francisco',
            type: 'Summit'
          },
          {
            name: 'SaaS AI Leaders Forum',
            date: 'May 2026',
            location: 'New York',
            type: 'Forum'
          }].
          map((event, i) =>
          <div
            key={i}
            className="bg-white rounded-lg border border-gray-200 p-4">
            
              <Badge variant="neutral" className="mb-2">
                {event.type}
              </Badge>
              <h4 className="font-bold text-gray-900 text-sm">{event.name}</h4>
              <p className="text-xs text-gray-500 mt-1">
                {event.date} • {event.location}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>);

}