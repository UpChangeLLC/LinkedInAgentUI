import React from 'react';
import { Card } from '../ui/Card';
import { ArrowRight, DollarSign, AlertCircle } from 'lucide-react';
import { MockResults } from '../../data/mockResults';
interface WorkflowImpactSectionProps {
  results: MockResults;
}
export function WorkflowImpactSection({ results }: WorkflowImpactSectionProps) {
  // Calculate total savings
  const totalSavings = '$510K+'; // Hardcoded based on prompt narrative, or could sum up
  return (
    <div className="space-y-8">
      <div className="bg-dark-green/10 border border-dark-green/20 rounded-xl p-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-green-900">
            Total Estimated Annual Savings
          </h2>
          <p className="text-dark-green">
            Based on automation of high-volume TechCorp workflows
          </p>
        </div>
        <div className="text-4xl font-bold text-dark-green">{totalSavings}</div>
      </div>

      <div className="mb-6">
        <h2 className="text-2xl font-bold text-dark-textPri">
          Workflow Transformation Map
        </h2>
        <p className="text-dark-textSec mt-2">
          Specific operational bottlenecks identified in your function.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {results.workflowItems.map((item, index) =>
        <Card
          key={index}
          elevated
          hoverable
          className="p-6 group border-l-4 border-l-dark-accent">

            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex-1">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-xl font-bold text-dark-textPri group-hover:text-dark-accent transition-colors">
                    {item.name}
                  </h3>
                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-dark-green/10 text-dark-green font-bold text-sm">
                    {item.estimatedSavings}
                  </span>
                </div>

                <div className="mb-4">
                  <div className="flex justify-between text-xs text-dark-textMuted mb-1">
                    <span>Automation Potential</span>
                    <span>{item.automationPercentage}%</span>
                  </div>
                  <div className="h-2 w-full bg-dark-elevated rounded-full overflow-hidden">
                    <div
                    className="h-full bg-dark-accent rounded-full"
                    style={{
                      width: `${item.automationPercentage}%`
                    }} />

                  </div>
                </div>

                <div className="bg-dark-elevated p-3 rounded-lg mb-4 border border-dark-border">
                  <div className="flex items-center gap-2 text-xs font-bold text-dark-textMuted uppercase tracking-wide mb-1">
                    <AlertCircle className="w-3 h-3" /> Current Pain Point
                  </div>
                  <p className="text-dark-textSec text-sm">
                    {item.currentPainPoint}
                  </p>
                </div>

                <p className="text-dark-textSec text-sm leading-relaxed mb-4">
                  {item.explanation}
                </p>

                <div className="flex items-center text-dark-accent text-sm font-bold bg-dark-accentDim p-3 rounded-lg">
                  <span className="mr-2 uppercase text-xs tracking-wide text-dark-textMuted">
                    First Step:
                  </span>
                  <span>{item.firstStep}</span>
                  <ArrowRight className="w-4 h-4 ml-auto" />
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>);

}