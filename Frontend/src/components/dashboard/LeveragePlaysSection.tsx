import React from 'react';
import { Card } from '../ui/Card';
import { EXTERNAL_LINKS } from '../../lib/config';
import { Badge } from '../ui/Badge';
import { MockResults } from '../../data/mockResults';
import { Rocket, Clock, TrendingUp, ExternalLink } from 'lucide-react';
interface LeveragePlaysSectionProps {
  results: MockResults;
}
export function LeveragePlaysSection({ results }: LeveragePlaysSectionProps) {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-dark-textPri">
          Strategic Leverage Plays
        </h2>
        <p className="text-dark-textSec mt-2">
          High-ROI initiatives to compound TechCorp's output.
        </p>
      </div>

      <div className="space-y-6">
        {results.leverageItems.map((item, index) =>
        <Card
          key={index}
          elevated
          className="p-8 border-t-4 border-t-dark-accent">

            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
              <div>
                <h3 className="text-2xl font-bold text-dark-textPri mb-2">
                  {item.title}
                </h3>
                <div className="flex gap-3">
                  <Badge variant="neutral" className="flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {item.timeToImplement}
                  </Badge>
                  <Badge
                  variant="success"
                  className="flex items-center gap-1 text-sm px-3">

                    <TrendingUp className="w-3 h-3" /> {item.estimatedROI} ROI
                  </Badge>
                </div>
              </div>
            </div>

            <div className="bg-dark-accentDim p-6 rounded-xl border border-dark-accent/10 mb-8">
              <h4 className="text-sm font-bold text-dark-accent uppercase tracking-wide mb-2">
                TechCorp Context
              </h4>
              <p className="text-dark-textPri text-lg leading-relaxed font-medium">
                {item.companySpecificContext}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h4 className="text-sm font-bold text-dark-textMuted uppercase tracking-wide mb-2">
                  Why it matters
                </h4>
                <p className="text-dark-textSec">{item.whyItMatters}</p>
              </div>
              <div>
                <h4 className="text-sm font-bold text-dark-textMuted uppercase tracking-wide mb-2">
                  Example Use Case
                </h4>
                <p className="text-dark-textSec bg-dark-elevated p-3 rounded-lg text-sm border border-dark-border">
                  "{item.exampleUseCase}"
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Workshop CTA */}
      <div className="flex items-center justify-between bg-dark-card rounded-xl border border-dark-border p-5">
        <p className="text-sm text-dark-textSec">
          <span className="font-semibold text-dark-textPri">
            Looking for implementation support?
          </span>{' '}
          The{' '}
          <a
            href={EXTERNAL_LINKS.hyperaccelerator}
            target="_blank"
            rel="noopener noreferrer"
            className="text-dark-accent font-semibold hover:underline">

            Executive AI Accelerator
          </a>{' '}
          by HyperAccelerator includes hands-on strategy sessions for
          prioritizing and deploying these plays.
        </p>
      </div>
    </div>);

}