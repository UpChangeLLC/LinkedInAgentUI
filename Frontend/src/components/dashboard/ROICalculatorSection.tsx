import { useState, useMemo, useEffect, useRef } from 'react';
import { Card } from '../ui/Card';
import { Calculator, DollarSign, TrendingUp, Clock } from 'lucide-react';
import type { WorkflowItem } from '../../data/mockResults';

interface ROICalculatorSectionProps {
  workflowItems?: WorkflowItem[];
}

function AnimatedCounter({ value, prefix = '' }: { value: number; prefix?: string }) {
  const [displayed, setDisplayed] = useState(0);
  const ref = useRef<number | null>(null);

  useEffect(() => {
    const start = displayed;
    const diff = value - start;
    if (diff === 0) return;
    const duration = 800;
    const startTime = performance.now();

    function animate(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(Math.round(start + diff * eased));
      if (progress < 1) {
        ref.current = requestAnimationFrame(animate);
      }
    }
    ref.current = requestAnimationFrame(animate);
    return () => {
      if (ref.current) cancelAnimationFrame(ref.current);
    };
  }, [value]);

  return (
    <span>
      {prefix}
      {displayed.toLocaleString()}
    </span>
  );
}

function RangeSlider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        <span className="text-sm font-semibold text-gray-900">
          {unit === '$' ? `$${value}` : `${value}${unit}`}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-linkedin"
        style={{
          background: `linear-gradient(to right, #0a66c2 0%, #0a66c2 ${pct}%, #e5e7eb ${pct}%, #e5e7eb 100%)`,
        }}
      />
      <div className="flex justify-between text-xs text-gray-400">
        <span>
          {unit === '$' ? `$${min}` : `${min}${unit}`}
        </span>
        <span>
          {unit === '$' ? `$${max}` : `${max}${unit}`}
        </span>
      </div>
    </div>
  );
}

export function ROICalculatorSection({ workflowItems }: ROICalculatorSectionProps) {
  // Derive default automation percentage from workflow items
  const defaultAutomation = useMemo(() => {
    if (!workflowItems?.length) return 40;
    const avg =
      workflowItems.reduce((sum, w) => sum + (w.automationPercentage || 0), 0) /
      workflowItems.length;
    return Math.round(Math.max(10, Math.min(90, avg)));
  }, [workflowItems]);

  const [hoursPerWeek, setHoursPerWeek] = useState(15);
  const [hourlyRate, setHourlyRate] = useState(50);
  const [automationPct, setAutomationPct] = useState(defaultAutomation);

  // Calculations
  const annualSavings = hoursPerWeek * 52 * hourlyRate * (automationPct / 100);
  const monthlySavings = annualSavings / 12;
  // Assume implementation cost is ~2 months of savings
  const estimatedImplementationCost = monthlySavings * 2;
  const paybackMonths = estimatedImplementationCost > 0
    ? Math.ceil((estimatedImplementationCost / monthlySavings) * 10) / 10
    : 0;

  const hoursRecovered = hoursPerWeek * (automationPct / 100) * 52;

  // Bar chart data
  const barData = [
    {
      label: 'Current Manual Cost',
      value: hoursPerWeek * 52 * hourlyRate,
      color: '#EF4444',
    },
    {
      label: 'Post-Automation Cost',
      value: hoursPerWeek * 52 * hourlyRate * (1 - automationPct / 100),
      color: '#22C55E',
    },
  ];
  const maxBar = Math.max(...barData.map((d) => d.value));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Calculator className="w-6 h-6 text-linkedin" />
          Workflow ROI Calculator
        </h2>
        <p className="text-gray-600 mt-1">
          Estimate the financial impact of automating your team's manual
          workflows with AI.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Panel */}
        <Card className="p-6 space-y-6">
          <h3 className="font-semibold text-gray-900">Adjust Parameters</h3>

          <RangeSlider
            label="Hours/week on manual tasks"
            value={hoursPerWeek}
            min={1}
            max={40}
            step={1}
            unit=" hrs"
            onChange={setHoursPerWeek}
          />

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Average hourly cost ($)
            </label>
            <input
              type="number"
              min={10}
              max={500}
              value={hourlyRate}
              onChange={(e) =>
                setHourlyRate(
                  Math.max(10, Math.min(500, Number(e.target.value) || 50))
                )
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-linkedin/30 focus:border-linkedin"
            />
          </div>

          <RangeSlider
            label="Expected automation %"
            value={automationPct}
            min={10}
            max={90}
            step={5}
            unit="%"
            onChange={setAutomationPct}
          />

          {workflowItems && workflowItems.length > 0 && (
            <div className="mt-2 p-3 bg-blue-50 rounded-lg">
              <p className="text-xs text-blue-700">
                Default automation % is derived from your{' '}
                {workflowItems.length} identified workflow
                {workflowItems.length !== 1 ? 's' : ''} (avg{' '}
                {defaultAutomation}%).
              </p>
            </div>
          )}
        </Card>

        {/* Results Panel */}
        <div className="space-y-4">
          {/* Big savings number */}
          <Card className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
            <div className="text-center">
              <p className="text-sm font-medium text-green-700 mb-1">
                Estimated Annual Savings
              </p>
              <p className="text-4xl font-bold text-green-800">
                <AnimatedCounter value={Math.round(annualSavings)} prefix="$" />
              </p>
              <p className="text-sm text-green-600 mt-1">
                ${Math.round(monthlySavings).toLocaleString()} / month
              </p>
            </div>
          </Card>

          {/* Metrics row */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="p-4 text-center">
              <Clock className="w-5 h-5 text-linkedin mx-auto mb-1" />
              <p className="text-lg font-bold text-gray-900">
                {Math.round(hoursRecovered).toLocaleString()}
              </p>
              <p className="text-xs text-gray-500">Hours recovered/year</p>
            </Card>
            <Card className="p-4 text-center">
              <TrendingUp className="w-5 h-5 text-linkedin mx-auto mb-1" />
              <p className="text-lg font-bold text-gray-900">
                {paybackMonths}
              </p>
              <p className="text-xs text-gray-500">Months payback</p>
            </Card>
            <Card className="p-4 text-center">
              <DollarSign className="w-5 h-5 text-linkedin mx-auto mb-1" />
              <p className="text-lg font-bold text-gray-900">
                {Math.round((annualSavings / (hoursPerWeek * 52 * hourlyRate)) * 100)}%
              </p>
              <p className="text-xs text-gray-500">Cost reduction</p>
            </Card>
          </div>

          {/* Simple bar chart comparison */}
          <Card className="p-5">
            <h4 className="text-sm font-semibold text-gray-700 mb-4">
              Annual Cost Comparison
            </h4>
            <div className="space-y-4">
              {barData.map((bar) => (
                <div key={bar.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-600">{bar.label}</span>
                    <span className="text-xs font-semibold text-gray-900">
                      ${Math.round(bar.value).toLocaleString()}
                    </span>
                  </div>
                  <div className="h-6 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700 ease-out"
                      style={{
                        width: `${maxBar > 0 ? (bar.value / maxBar) * 100 : 0}%`,
                        backgroundColor: bar.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-600">
                By automating {automationPct}% of {hoursPerWeek} weekly hours at
                ${hourlyRate}/hr, you save{' '}
                <span className="font-semibold text-green-700">
                  ${Math.round(annualSavings).toLocaleString()}
                </span>{' '}
                annually with an estimated payback of {paybackMonths} months.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
