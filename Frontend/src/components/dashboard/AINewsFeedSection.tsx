import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, Newspaper, Globe, Linkedin, BookOpen, RefreshCw } from 'lucide-react';
import { Card } from '../ui/Card';

const BASE_URL = (import.meta as any).env?.VITE_MCP_BASE_URL || '';

interface NewsLink {
  title: string;
  url: string;
  source: string;
  description: string;
}

interface Props {
  role?: string;
  industry?: string;
  topSkillGaps?: string[];
}

const SOURCE_ICONS: Record<string, typeof Globe> = {
  'Google News': Globe,
  'TechCrunch': Newspaper,
  'MIT Technology Review': BookOpen,
  'LinkedIn News': Linkedin,
};

const SOURCE_COLORS: Record<string, string> = {
  'Google News': 'bg-blue-500/10 text-blue-400',
  'TechCrunch': 'bg-dark-green/10 text-dark-green',
  'MIT Technology Review': 'bg-purple-500/10 text-purple-400',
  'LinkedIn News': 'bg-dark-accentDim text-dark-accent',
};

export function AINewsFeedSection({ role, industry, topSkillGaps }: Props) {
  const [links, setLinks] = useState<NewsLink[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchFeed = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (role) params.set('role', role);
    if (industry) params.set('industry', industry);
    if (topSkillGaps?.length) params.set('skills', topSkillGaps.join(','));

    fetch(`${BASE_URL}/api/news-feed?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setLinks(data.links || []);
        setLastUpdated(data.last_updated || null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchFeed();
  }, [role, industry]);

  // Group by source
  const grouped = links.reduce<Record<string, NewsLink[]>>((acc, link) => {
    (acc[link.source] = acc[link.source] || []).push(link);
    return acc;
  }, {});

  const personalizedTitle = role
    ? `AI News for ${role}${industry ? ` in ${industry}` : ''}`
    : 'AI News Feed';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold font-serif text-dark-textPri">{personalizedTitle}</h2>
        <p className="text-dark-textSec mt-2 text-sm">
          Curated AI news and insights relevant to your role
          {role ? ` as a ${role}` : ''}
          {industry ? ` in ${industry}` : ''}.
          {topSkillGaps?.length
            ? ` Focused on ${topSkillGaps.slice(0, 2).join(', ')}.`
            : ''}
        </p>
      </div>

      {loading ? (
        <Card className="p-8">
          <div className="flex items-center justify-center text-dark-textMuted">
            <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
            Loading news feed...
          </div>
        </Card>
      ) : (
        <>
          {Object.entries(grouped).map(([source, sourceLinks], groupIdx) => {
            const IconComponent = SOURCE_ICONS[source] || Globe;
            const colorClass = SOURCE_COLORS[source] || 'bg-dark-elevated text-dark-textSec';

            return (
              <motion.div
                key={source}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: groupIdx * 0.1 }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-7 h-7 rounded-md flex items-center justify-center ${colorClass}`}>
                    <IconComponent className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-dark-textSec uppercase tracking-wide">
                    {source}
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {sourceLinks.map((link, i) => (
                    <Card key={i} className="p-5" hoverable>
                      <h4 className="font-semibold text-dark-textPri mb-2">{link.title}</h4>
                      <p className="text-sm text-dark-textSec mb-4 line-clamp-2">{link.description}</p>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-dark-accent hover:underline transition-colors"
                      >
                        Explore
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </Card>
                  ))}
                </div>
              </motion.div>
            );
          })}

          {lastUpdated && (
            <div className="text-xs text-dark-textMuted text-center pt-4 border-t border-dark-border">
              Last updated:{' '}
              {new Date(lastUpdated).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
