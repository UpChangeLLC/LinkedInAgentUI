import React from 'react';
import { Card } from '../ui/Card';
import { MockResults } from '../../data/mockResults';
import {
  CheckCircle,
  ArrowRight,
  Clock,
  Target,
  ExternalLink } from
'lucide-react';
import { Badge } from '../ui/Badge';
interface PersonalRoadmapSectionProps {
  results: MockResults;
}
export function PersonalRoadmapSection({
  results
}: PersonalRoadmapSectionProps) {
  const { careerRecommendations } = results.personalRisk;
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">
          Your AI Leadership Path
        </h2>
        <p className="text-gray-600 mt-2">
          Personalized development roadmap to transition from "AI Observer" to
          "AI Architect".
        </p>
      </div>

      <div className="space-y-6">
        {careerRecommendations.map((rec, index) =>
        <Card
          key={index}
          className="p-8 flex flex-col md:flex-row gap-6 group hover:border-linkedin/50 transition-colors">
          
            <div className="flex-shrink-0">
              <div className="w-12 h-12 rounded-full bg-linkedin/10 text-linkedin flex items-center justify-center font-bold text-xl">
                {index + 1}
              </div>
            </div>

            <div className="flex-1">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-3">
                <h3 className="text-xl font-bold text-gray-900 group-hover:text-linkedin transition-colors">
                  {rec.title}
                </h3>
                <div className="flex gap-2">
                  <Badge variant="neutral" className="flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {rec.timeframe}
                  </Badge>
                  <Badge
                  variant={rec.impact === 'Critical' ? 'danger' : 'warning'}
                  className="flex items-center gap-1">
                  
                    <Target className="w-3 h-3" /> {rec.impact} Impact
                  </Badge>
                </div>
              </div>

              <p className="text-gray-700 text-lg leading-relaxed mb-6">
                {rec.detail}
              </p>

              <button className="text-linkedin font-bold text-sm flex items-center hover:underline uppercase tracking-wide">
                View Resources & Action Plan{' '}
                <ArrowRight className="w-4 h-4 ml-1" />
              </button>
            </div>
          </Card>
        )}
      </div>

      <div className="bg-gray-50 p-8 rounded-xl border border-gray-200">
        <h3 className="font-bold text-gray-900 mb-6 text-lg">
          Curated Learning & Programs
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <a
            href="https://hyperaccelerator.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-start gap-4 hover:shadow-md hover:border-linkedin/30 transition-all cursor-pointer group">
            
            <div className="w-12 h-12 bg-linkedin/10 rounded-lg flex items-center justify-center text-2xl flex-shrink-0">
              🚀
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="font-bold text-gray-900 group-hover:text-linkedin transition-colors">
                  Executive AI Accelerator
                </div>
              </div>
              <div className="text-xs text-gray-500 mb-2">
                HyperAccelerator • Cohort-based
              </div>
              <p className="text-xs text-gray-600">
                Peer-driven program for C-suite AI transformation.
              </p>
              <div className="flex items-center gap-1 mt-2 text-xs text-linkedin font-medium">
                Best match for your profile <ExternalLink className="w-3 h-3" />
              </div>
            </div>
          </a>
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-start gap-4">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center text-2xl flex-shrink-0">
              🎓
            </div>
            <div>
              <div className="font-bold text-gray-900 mb-1">
                AI Strategy for Executives
              </div>
              <div className="text-sm text-gray-500 mb-2">
                LinkedIn Learning • 4h 30m
              </div>
              <p className="text-xs text-gray-600">
                Focuses on governance and ROI calculation.
              </p>
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-start gap-4">
            <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-lg flex items-center justify-center text-2xl flex-shrink-0">
              🤖
            </div>
            <div>
              <div className="font-bold text-gray-900 mb-1">
                Generative AI Business Applications
              </div>
              <div className="text-sm text-gray-500 mb-2">Coursera • 12h</div>
              <p className="text-xs text-gray-600">
                Deep dive into agentic workflows for Ops.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Workshop Recommendation */}
      <a
        href="https://hyperaccelerator.com/"
        target="_blank"
        rel="noopener noreferrer"
        className="block bg-gradient-to-r from-linkedin/5 to-linkedin/10 rounded-xl border border-linkedin/20 p-6 hover:border-linkedin/40 transition-colors group">
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-linkedin/10 rounded-lg flex items-center justify-center">
              <Target className="w-6 h-6 text-linkedin" />
            </div>
            <div>
              <div className="font-bold text-gray-900 group-hover:text-linkedin transition-colors">
                Exec AI Workshop — Recommended for You
              </div>
              <p className="text-sm text-gray-600">
                Structured program to accelerate your AI leadership path with
                peer accountability and expert coaching.
              </p>
            </div>
          </div>
          <ExternalLink className="w-5 h-5 text-gray-400 group-hover:text-linkedin transition-colors flex-shrink-0 ml-4" />
        </div>
      </a>
    </div>);

}