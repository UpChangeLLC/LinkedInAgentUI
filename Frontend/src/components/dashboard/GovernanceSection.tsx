import React from 'react';
import { ShieldAlert, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { Card } from '../ui/Card';
import { MockResults } from '../../data/mockResults';
import { Badge } from '../ui/Badge';
interface GovernanceSectionProps {
  results: MockResults;
}
export function GovernanceSection({ results }: GovernanceSectionProps) {
  return (
    <div className="space-y-8">
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
        <div className="p-3 bg-red-100 rounded-full">
          <ShieldAlert className="w-6 h-6 text-red-600" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900">
            Governance Maturity: Critical Risk
          </h2>
          <p className="text-gray-600">
            TechCorp Governance Status:{' '}
            <span className="font-bold text-gray-900">1 of 4</span> controls
            implemented
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {results.governanceItems.map((item, index) =>
        <Card key={index} className="p-6">
            <div className="flex flex-col md:flex-row gap-6 items-start">
              {/* Status Column */}
              <div className="md:w-1/4 flex flex-col gap-2">
                <h3 className="font-bold text-gray-900 text-lg">
                  {item.control}
                </h3>
                <div className="flex items-center gap-2">
                  <StatusIndicator status={item.currentStatus} />
                  <span className="text-sm font-medium capitalize text-gray-600">
                    {item.currentStatus}
                  </span>
                </div>
                <div className="mt-2">
                  <RiskBadge level={item.riskLevel} />
                </div>
              </div>

              {/* Details Column */}
              <div className="md:w-1/2 space-y-4">
                <div>
                  <span className="text-xs font-bold text-gray-400 uppercase block mb-1">
                    Why it matters
                  </span>
                  <p className="text-sm text-gray-700">{item.whyItMatters}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded border border-gray-200">
                  <span className="text-xs font-bold text-gray-400 uppercase block mb-1">
                    Industry Context
                  </span>
                  <p className="text-xs text-gray-600 italic">
                    {item.industryContext}
                  </p>
                </div>
              </div>

              {/* Action Column */}
              <div className="md:w-1/4 w-full bg-linkedin/5 p-4 rounded-lg border border-linkedin/10">
                <span className="text-xs font-bold text-linkedin uppercase block mb-2">
                  Policy Suggestion
                </span>
                <p className="text-sm text-gray-800 font-medium leading-snug">
                  {item.policySuggestion}
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>);

}
function StatusIndicator({ status }: {status: string;}) {
  if (status === 'implemented')
  return <CheckCircle2 className="w-5 h-5 text-green-500" />;
  if (status === 'partial')
  return <AlertTriangle className="w-5 h-5 text-amber-500" />;
  return <XCircle className="w-5 h-5 text-red-500" />;
}
function RiskBadge({ level }: {level: string;}) {
  const colors = {
    critical: 'bg-red-100 text-red-700 border-red-200',
    high: 'bg-orange-100 text-orange-700 border-orange-200',
    medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    low: 'bg-gray-100 text-gray-700 border-gray-200'
  };
  return (
    <span
      className={`text-xs font-bold px-2 py-1 rounded border uppercase tracking-wider ${colors[level as keyof typeof colors]}`}>
      
      {level} Risk
    </span>);

}