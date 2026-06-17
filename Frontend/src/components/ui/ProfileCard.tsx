import { motion } from 'framer-motion';
import {
  User,
  MapPin,
  Briefcase,
  GraduationCap,
  Award,
  Code2,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';
import type { ProfilePreview } from '../../lib/mcp';

interface ProfileCardProps {
  profile: ProfilePreview;
}

function CompletenessRing({ score }: { score: number }) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color =
    score >= 70 ? 'text-green-500' : score >= 40 ? 'text-yellow-500' : 'text-red-500';

  return (
    <div className="relative w-16 h-16 flex-shrink-0">
      <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
        <circle
          cx="32"
          cy="32"
          r={radius}
          className="stroke-gray-200"
          fill="none"
          strokeWidth="4"
        />
        <motion.circle
          cx="32"
          cy="32"
          r={radius}
          className={`stroke-current ${color}`}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`text-sm font-bold ${color}`}>{score}%</span>
      </div>
    </div>
  );
}

function StatBadge({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
      <Icon className="w-4 h-4 text-gray-400 flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-sm font-semibold text-gray-900 truncate">{value}</p>
      </div>
    </div>
  );
}

export function ProfileCard({ profile }: ProfileCardProps) {
  const hasGoodCompleteness = profile.completeness_score >= 50;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden"
    >
      {/* Header with gradient */}
      <div className="bg-gradient-to-r from-[#0A66C2] to-[#004182] h-20 relative">
        <div className="absolute -bottom-8 left-6">
          <div className="w-16 h-16 rounded-full bg-white border-4 border-white shadow flex items-center justify-center">
            <User className="w-8 h-8 text-gray-400" />
          </div>
        </div>
      </div>

      <div className="pt-12 px-6 pb-6">
        {/* Name & title */}
        <div className="mb-4">
          <h3 className="text-xl font-bold text-gray-900">
            {profile.name || 'Unknown'}
          </h3>
          {profile.title && (
            <p className="text-gray-600 mt-0.5">{profile.title}</p>
          )}
          <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-gray-500">
            {profile.company && (
              <span className="flex items-center gap-1">
                <Briefcase className="w-3.5 h-3.5" />
                {profile.company}
              </span>
            )}
            {profile.location && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {profile.location}
              </span>
            )}
          </div>
        </div>

        {/* Summary */}
        {profile.summary && (
          <p className="text-sm text-gray-600 mb-4 line-clamp-3">
            {profile.summary}
          </p>
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          <StatBadge
            icon={Briefcase}
            label="Experience"
            value={
              profile.years_experience > 0
                ? `${profile.years_experience} yrs`
                : `${profile.experience_count} roles`
            }
          />
          <StatBadge icon={Code2} label="Skills" value={profile.skills_count} />
          <StatBadge icon={GraduationCap} label="Education" value={profile.education_count} />
          <StatBadge icon={Award} label="Certifications" value={profile.certifications_count} />
        </div>

        {/* Skills preview */}
        {profile.skills.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
              Top Skills
            </p>
            <div className="flex flex-wrap gap-1.5">
              {profile.skills.map((skill, i) => (
                <span
                  key={i}
                  className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Completeness meter */}
        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <CompletenessRing score={profile.completeness_score} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {hasGoodCompleteness ? (
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0" />
              )}
              <span className="text-sm font-semibold text-gray-900">
                Profile Completeness
              </span>
            </div>
            <p className="text-xs text-gray-500">
              {hasGoodCompleteness
                ? 'Good profile data available for analysis.'
                : 'Limited data may affect analysis accuracy.'}
            </p>
            {profile.missing_fields.length > 0 && (
              <p className="text-xs text-gray-400 mt-1">
                Missing: {profile.missing_fields.join(', ')}
              </p>
            )}
          </div>
        </div>

        {/* Data source */}
        <p className="text-xs text-gray-400 mt-3 text-center">
          Data source: {profile.data_source || 'LinkedIn'}
        </p>
      </div>
    </motion.div>
  );
}
