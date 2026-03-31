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
      <div className="bg-green-50 border border-green-200 rounded-xl p-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-green-900">
            Total Estimated Annual Savings
          </h2>
          <p className="text-green-700">
            Based on automation of high-volume TechCorp workflows
          </p>
        </div>
        <div className="text-4xl font-bold text-green-700">{totalSavings}</div>
      </div>

      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          Workflow Transformation Map
        </h2>
        <p className="text-gray-600 mt-2">
          Specific operational bottlenecks identified in your function.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {results.workflowItems.map((item, index) =>
        <Card
          key={index}
          elevated
          hoverable
          className="p-6 group border-l-4 border-l-linkedin">
          
            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex-1">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-xl font-bold text-gray-900 group-hover:text-linkedin transition-colors">
                    {item.name}
                  </h3>
                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-green-100 text-green-700 font-bold text-sm">
                    {item.estimatedSavings}
                  </span>
                </div>

                <div className="mb-4">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Automation Potential</span>
                    <span>{item.automationPercentage}%</span>
                  </div>
                  <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div
                    className="h-full bg-linkedin rounded-full"
                    style={{
                      width: `${item.automationPercentage}%`
                    }} />
                  
                  </div>
                </div>

                <div className="bg-gray-50 p-3 rounded-lg mb-4 border border-gray-100">
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                    <AlertCircle className="w-3 h-3" /> Current Pain Point
                  </div>
                  <p className="text-gray-700 text-sm">
                    {item.currentPainPoint}
                  </p>
                </div>

                <p className="text-gray-600 text-sm leading-relaxed mb-4">
                  {item.explanation}
                </p>

                <div className="flex items-center text-linkedin text-sm font-bold bg-linkedin/5 p-3 rounded-lg">
                  <span className="mr-2 uppercase text-xs tracking-wide text-gray-500">
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