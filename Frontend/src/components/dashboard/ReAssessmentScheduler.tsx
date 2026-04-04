import { useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarPlus, Download, Check } from 'lucide-react';
import { Card } from '../ui/Card';

interface Props {
  assessmentUrl?: string;
}

const OPTIONS = [
  { days: 30, label: '30 Days', description: 'Recommended for active learners' },
  { days: 60, label: '60 Days', description: 'Standard reassessment cycle' },
  { days: 90, label: '90 Days', description: 'Quarterly checkpoint' },
];

function generateICS(date: Date, url: string): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const dtStart = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T090000Z`;
  const endDate = new Date(date);
  endDate.setMinutes(endDate.getMinutes() + 30);
  const dtEnd = `${endDate.getFullYear()}${pad(endDate.getMonth() + 1)}${pad(endDate.getDate())}T093000Z`;

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AI Resilience Score//EN',
    'BEGIN:VEVENT',
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    'SUMMARY:AI Resilience Score Re-Assessment',
    `DESCRIPTION:Time to re-assess your AI readiness score. Visit ${url} to take the assessment.`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

function downloadICS(content: string) {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ai-resilience-reassessment.ics';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function ReAssessmentScheduler({ assessmentUrl }: Props) {
  const [selectedDays, setSelectedDays] = useState<number | null>(null);
  const [downloaded, setDownloaded] = useState(false);

  const scheduledDate = selectedDays
    ? new Date(Date.now() + selectedDays * 24 * 60 * 60 * 1000)
    : null;

  const handleDownload = () => {
    if (!scheduledDate) return;
    const siteUrl = assessmentUrl || window.location.origin;
    const ics = generateICS(scheduledDate, siteUrl);
    downloadICS(ics);
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 3000);
  };

  const formatDate = (d: Date) =>
    d.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-linkedin/10 rounded-lg flex items-center justify-center">
          <CalendarPlus className="w-5 h-5 text-linkedin" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Schedule Your Next Assessment</h3>
          <p className="text-sm text-gray-500">
            Regular reassessments help you track progress and stay on top of AI readiness.
          </p>
        </div>
      </div>

      {/* Options */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        {OPTIONS.map((opt) => (
          <motion.button
            key={opt.days}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              setSelectedDays(opt.days);
              setDownloaded(false);
            }}
            className={`p-4 rounded-lg border-2 text-left transition-colors ${
              selectedDays === opt.days
                ? 'border-linkedin bg-linkedin/5'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="text-lg font-bold text-gray-900">{opt.label}</div>
            <div className="text-xs text-gray-500 mt-1">{opt.description}</div>
            {selectedDays === opt.days && (
              <div className="flex items-center gap-1 mt-2 text-xs text-linkedin font-medium">
                <Check className="w-3 h-3" /> Selected
              </div>
            )}
          </motion.button>
        ))}
      </div>

      {/* Selected date display and download */}
      {scheduledDate && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-50 rounded-lg p-4 border border-gray-200"
        >
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="text-sm text-gray-500">Your next assessment is scheduled for:</div>
              <div className="text-lg font-bold text-gray-900 mt-1">
                {formatDate(scheduledDate)}
              </div>
            </div>
            <button
              onClick={handleDownload}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-colors ${
                downloaded
                  ? 'bg-green-500 text-white'
                  : 'bg-linkedin hover:bg-[#004182] text-white'
              }`}
            >
              {downloaded ? (
                <>
                  <Check className="w-4 h-4" />
                  Added to Calendar
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Add to Calendar
                </>
              )}
            </button>
          </div>
        </motion.div>
      )}
    </Card>
  );
}
