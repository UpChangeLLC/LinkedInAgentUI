import { motion } from 'framer-motion';
import { Star, Clock, TrendingUp, ChevronRight } from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import type { CareerPathway } from '../../data/mockResults';

interface CareerPathwaysSectionProps {
  pathways: CareerPathway[];
  currentRole?: string;
}

const DIFFICULTY_CONFIG = {
  easy: { label: 'Easy', color: 'text-green-600 bg-green-50' },
  moderate: { label: 'Moderate', color: 'text-yellow-600 bg-yellow-50' },
  challenging: { label: 'Challenging', color: 'text-red-600 bg-red-50' },
};

export function CareerPathwaysSection({ pathways, currentRole }: CareerPathwaysSectionProps) {
  if (!pathways.length) return null;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-gray-900">Career Pathways</h3>
        {currentRole && (
          <p className="text-sm text-gray-500 mt-1">
            Personalized paths from your current role as {currentRole}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {pathways.map((path, idx) => {
          const diff = DIFFICULTY_CONFIG[path.difficulty] || DIFFICULTY_CONFIG.moderate;
          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
            >
              <Card
                className={`p-6 h-full flex flex-col relative ${
                  path.recommended
                    ? 'border-linkedin border-2 shadow-md'
                    : 'border-gray-200'
                }`}
              >
                {path.recommended && (
                  <div className="absolute -top-3 left-4">
                    <span className="inline-flex items-center gap-1 bg-linkedin text-white text-xs font-bold px-3 py-1 rounded-full">
                      <Star className="w-3 h-3" />
                      Recommended
                    </span>
                  </div>
                )}

                <h4 className="text-base font-bold text-gray-900 mt-2 mb-2">
                  {path.name}
                </h4>
                <p className="text-sm text-gray-600 mb-4 flex-1">
                  {path.description}
                </p>

                {/* Metrics */}
                <div className="space-y-3 border-t border-gray-100 pt-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-gray-500">
                      <Clock className="w-3.5 h-3.5" />
                      Timeline
                    </span>
                    <span className="font-semibold text-gray-900">
                      {path.timelineMonths > 0 ? `${path.timelineMonths} months` : 'Varies'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-gray-500">
                      <TrendingUp className="w-3.5 h-3.5" />
                      Salary Impact
                    </span>
                    <span className="font-semibold text-green-600">
                      {path.salaryImpact || 'Varies'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Difficulty</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${diff.color}`}>
                      {diff.label}
                    </span>
                  </div>
                </div>

                {/* Required skills */}
                {path.requiredSkills.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-gray-100">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                      Skills Needed
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {path.requiredSkills.map((skill, si) => (
                        <span
                          key={si}
                          className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full border border-blue-100"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
