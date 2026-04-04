import { useState, useEffect, useMemo } from 'react';
import { Card } from '../ui/Card';
import { ExternalLink, Star, Filter, BookOpen } from 'lucide-react';
import type { SkillGapItem } from '../../data/mockResults';

interface LearningResource {
  id: string;
  title: string;
  provider: string;
  cost: string;
  duration: string;
  format: string;
  skills_covered: string[];
  rating: number;
  url: string;
  level: string;
  relevance_score?: number;
  matched_skills?: string[];
}

interface LearningResourcesSectionProps {
  skills: SkillGapItem[];
}

const LEVEL_COLORS: Record<string, string> = {
  beginner: 'bg-green-100 text-green-800',
  intermediate: 'bg-blue-100 text-blue-800',
  advanced: 'bg-purple-100 text-purple-800',
};

function RatingStars({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={`w-3.5 h-3.5 ${
            i < full
              ? 'fill-amber-400 text-amber-400'
              : i === full && half
                ? 'fill-amber-400/50 text-amber-400'
                : 'text-gray-300'
          }`}
        />
      ))}
      <span className="ml-1 text-xs text-gray-600">{rating.toFixed(1)}</span>
    </div>
  );
}

function CostBadge({ cost }: { cost: string }) {
  const isFree = cost.toLowerCase().includes('free');
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
        isFree ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
      }`}
    >
      {cost}
    </span>
  );
}

// Client-side fuzzy matching fallback
function clientSideMatch(
  resources: LearningResource[],
  skills: SkillGapItem[]
): LearningResource[] {
  if (!skills.length) return resources;

  const skillNames = skills.map((s) => s.name.toLowerCase());

  return resources
    .map((r) => {
      const matchedSkills: string[] = [];
      let score = 0;
      for (const skillName of skillNames) {
        for (const covered of r.skills_covered) {
          if (
            covered.toLowerCase().includes(skillName) ||
            skillName.includes(covered.toLowerCase())
          ) {
            matchedSkills.push(skillName);
            score += 1;
            break;
          }
        }
      }
      return { ...r, matched_skills: matchedSkills, relevance_score: score };
    })
    .filter((r) => r.relevance_score > 0)
    .sort((a, b) => b.relevance_score - a.relevance_score);
}

export function LearningResourcesSection({ skills }: LearningResourcesSectionProps) {
  const [resources, setResources] = useState<LearningResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [costFilter, setCostFilter] = useState<'all' | 'free' | 'paid'>('all');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [formatFilter, setFormatFilter] = useState<string>('all');

  useEffect(() => {
    let cancelled = false;

    async function fetchResources() {
      setLoading(true);
      try {
        const skillNames = skills.map((s) => s.name).join(',');
        const baseUrl =
          (import.meta as any).env?.VITE_API_URL || window.location.origin;
        const url = `${baseUrl}/api/learning-resources?skills=${encodeURIComponent(skillNames)}`;
        const resp = await fetch(url);
        if (!cancelled && resp.ok) {
          const data = await resp.json();
          if (data.resources?.length) {
            setResources(data.resources);
            setLoading(false);
            return;
          }
        }
      } catch {
        // Fall through to client-side matching
      }

      // Fallback: fetch full catalog and match client-side
      try {
        const baseUrl =
          (import.meta as any).env?.VITE_API_URL || window.location.origin;
        const resp = await fetch(`${baseUrl}/api/learning-resources`);
        if (!cancelled && resp.ok) {
          const data = await resp.json();
          const matched = clientSideMatch(data.resources || [], skills);
          setResources(matched);
        }
      } catch {
        // Use empty if everything fails
        if (!cancelled) setResources([]);
      }

      if (!cancelled) setLoading(false);
    }

    fetchResources();
    return () => {
      cancelled = true;
    };
  }, [skills]);

  const formats = useMemo(() => {
    const set = new Set(resources.map((r) => r.format));
    return Array.from(set).sort();
  }, [resources]);

  const filtered = useMemo(() => {
    return resources.filter((r) => {
      if (costFilter === 'free' && !r.cost.toLowerCase().includes('free'))
        return false;
      if (costFilter === 'paid' && r.cost.toLowerCase().includes('free'))
        return false;
      if (levelFilter !== 'all' && r.level !== levelFilter) return false;
      if (formatFilter !== 'all' && r.format !== formatFilter) return false;
      return true;
    });
  }, [resources, costFilter, levelFilter, formatFilter]);

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-linkedin" />
          Learning Resources
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="animate-pulse bg-gray-100 rounded-xl h-48"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-linkedin" />
          Learning Resources
        </h2>
        <p className="text-gray-600 mt-1">
          Curated resources matched to your skill gaps. Start learning to close
          the most critical gaps first.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Filter className="w-4 h-4 text-gray-500" />
        <select
          value={costFilter}
          onChange={(e) =>
            setCostFilter(e.target.value as 'all' | 'free' | 'paid')
          }
          className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white"
        >
          <option value="all">All Costs</option>
          <option value="free">Free</option>
          <option value="paid">Paid</option>
        </select>

        <select
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white"
        >
          <option value="all">All Levels</option>
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
        </select>

        <select
          value={formatFilter}
          onChange={(e) => setFormatFilter(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white"
        >
          <option value="all">All Formats</option>
          {formats.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>

        <span className="text-xs text-gray-500 ml-auto">
          {filtered.length} resource{filtered.length !== 1 ? 's' : ''} found
        </span>
      </div>

      {/* Resource Cards */}
      {filtered.length === 0 ? (
        <Card className="p-8 text-center text-gray-500">
          No resources match your current filters. Try adjusting the filters
          above.
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((resource) => (
            <Card
              key={resource.id}
              className="p-5 flex flex-col justify-between hover:shadow-md transition-shadow"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-gray-900 text-sm leading-tight">
                    {resource.title}
                  </h3>
                  <span
                    className={`shrink-0 px-2 py-0.5 rounded text-xs font-medium ${
                      LEVEL_COLORS[resource.level] || 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {resource.level}
                  </span>
                </div>

                <p className="text-xs text-gray-500 mb-2">{resource.provider}</p>

                <div className="flex items-center gap-3 mb-3">
                  <CostBadge cost={resource.cost} />
                  <span className="text-xs text-gray-500">{resource.duration}</span>
                  <span className="text-xs text-gray-400">{resource.format}</span>
                </div>

                <RatingStars rating={resource.rating} />

                {resource.matched_skills && resource.matched_skills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {resource.matched_skills.map((skill) => (
                      <span
                        key={skill}
                        className="px-2 py-0.5 bg-linkedin/10 text-linkedin text-xs rounded-full"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <a
                href={resource.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-linkedin hover:text-linkedin/80 transition-colors"
              >
                View Resource
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
