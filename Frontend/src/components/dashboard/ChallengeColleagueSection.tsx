import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Trophy, Users, Copy, Check, Loader2 } from 'lucide-react';
import { trackEvent } from '../../lib/analytics';
import { TeamLeaderboard } from './TeamLeaderboard';
import { TeamInsights } from './TeamInsights';

const env = (import.meta as any).env || {};
const baseUrl = ((env.VITE_MCP_BASE_URL as string) ?? '').replace(/\/+$/, '');

interface ChallengeColleagueSectionProps {
  urlHash?: string;
  score?: number;
  displayName?: string;
  roleCategory?: string;
}

interface TeamData {
  id: string;
  name: string;
  invite_code: string;
}

export function ChallengeColleagueSection({
  urlHash = '',
  score = 0,
  displayName = 'You',
  roleCategory = '',
}: ChallengeColleagueSectionProps) {
  const [teamName, setTeamName] = useState('');
  const [creating, setCreating] = useState(false);
  const [team, setTeam] = useState<TeamData | null>(null);
  const [leaderboard, setLeaderboard] = useState<any>(null);
  const [insights, setInsights] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Check for invite code in URL params
  const inviteCodeFromUrl = new URLSearchParams(window.location.search).get('team');

  const fetchLeaderboard = useCallback(async (code: string) => {
    try {
      const [lbRes, insRes] = await Promise.all([
        fetch(`${baseUrl}/api/teams/${code}/leaderboard`),
        fetch(`${baseUrl}/api/teams/${code}/insights`),
      ]);
      if (lbRes.ok) {
        const lbData = await lbRes.json();
        setLeaderboard(lbData);
        setTeam({
          id: '',
          name: lbData.team_name,
          invite_code: lbData.invite_code,
        });
      }
      if (insRes.ok) {
        const insData = await insRes.json();
        setInsights(insData);
      }
    } catch {
      // Silently fail — leaderboard is optional
    }
  }, []);

  // Auto-join if invite code in URL
  useEffect(() => {
    if (!inviteCodeFromUrl) return;

    const joinTeam = async () => {
      setLoading(true);
      try {
        await fetch(`${baseUrl}/api/teams/${inviteCodeFromUrl}/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url_hash: urlHash,
            display_name: displayName,
            score,
            role_category: roleCategory,
          }),
        });
        trackEvent('team_joined', { invite_code: inviteCodeFromUrl });
        await fetchLeaderboard(inviteCodeFromUrl);
      } catch {
        setError('Failed to join team. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    joinTeam();
  }, [inviteCodeFromUrl, urlHash, displayName, score, roleCategory, fetchLeaderboard]);

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim()) return;

    setCreating(true);
    setError('');
    try {
      const res = await fetch(`${baseUrl}/api/teams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: teamName.trim(),
          creator_url_hash: urlHash,
          creator_display_name: displayName,
          creator_score: score,
          creator_role_category: roleCategory,
        }),
      });

      if (!res.ok) throw new Error('Failed to create team');

      const data = await res.json();
      setTeam(data.team);
      trackEvent('team_created', { team_name: teamName.trim() });
      await fetchLeaderboard(data.team.invite_code);
    } catch {
      setError('Failed to create team. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const inviteLink = team
    ? `${window.location.origin}${window.location.pathname}?team=${team.invite_code}`
    : '';

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteLink).then(() => {
      setCopied(true);
      trackEvent('team_invite_copied');
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // If we have a team with leaderboard data, show the full view
  if (team && leaderboard) {
    return (
      <div className="space-y-6">
        {/* Invite link banner */}
        <Card className="p-4 bg-gradient-to-r from-dark-accent/5 to-dark-accent/10 border-dark-accent/20">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <Trophy className="w-6 h-6 text-dark-accent" />
              <div>
                <h3 className="font-bold text-dark-textPri">{team.name}</h3>
                <p className="text-sm text-dark-textSec">Share the link below to invite colleagues</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <code className="bg-dark-card border border-dark-border rounded-lg px-3 py-1.5 text-sm text-dark-textSec font-mono max-w-xs truncate">
                {inviteLink}
              </code>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCopy}
                className="flex items-center gap-1.5"
              >
                {copied ? <Check className="w-4 h-4 text-dark-green" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </div>
        </Card>

        {/* Leaderboard */}
        <TeamLeaderboard
          teamName={leaderboard.team_name}
          members={leaderboard.members}
          stats={leaderboard.stats}
          currentUrlHash={urlHash}
        />

        {/* Team Insights */}
        {insights && <TeamInsights insights={insights} />}
      </div>
    );
  }

  // Default: creation + promo view
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card className="p-8 bg-gradient-to-br from-dark-accent to-dark-accent text-white border-none">
        <div className="flex items-center gap-3 mb-4">
          <Trophy className="w-8 h-8 text-yellow-300" />
          <h2 className="text-2xl font-bold">Team Challenge</h2>
        </div>
        <p className="text-linkedin-light mb-8 text-lg">
          See if your executive team is as AI-ready as you are. Create a team,
          share the invite link, and compare scores on a live leaderboard.
        </p>

        <div className="flex -space-x-2 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="w-10 h-10 rounded-full border-2 border-dark-accent bg-white/20 flex items-center justify-center text-xs font-bold"
            >
              {String.fromCharCode(64 + i)}
            </div>
          ))}
          <div className="w-10 h-10 rounded-full border-2 border-dark-accent bg-white flex items-center justify-center text-xs font-bold text-dark-accent">
            +12
          </div>
        </div>

        <p className="text-sm text-white/60">
          Over 450 executive teams are currently benchmarking their combined
          resilience scores.
        </p>
      </Card>

      <Card className="p-8 flex flex-col justify-center">
        {loading ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="w-8 h-8 text-dark-accent animate-spin" />
            <p className="text-dark-textSec">Joining team...</p>
          </div>
        ) : (
          <>
            <h3 className="text-xl font-bold text-dark-textPri mb-2">
              Create a Team
            </h3>
            <p className="text-dark-textSec mb-6">
              Start a team challenge and get a shareable invite link. Members
              see a live leaderboard comparing AI resilience scores.
            </p>

            {error && (
              <div className="mb-4 bg-dark-red/10 border border-dark-red/20 rounded-lg p-3 text-sm text-dark-red">
                {error}
              </div>
            )}

            <form onSubmit={handleCreateTeam} className="space-y-4">
              <Input
                placeholder="e.g. Leadership Team Q2"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                className="bg-dark-elevated"
                disabled={creating}
              />
              <Button
                fullWidth
                className="bg-dark-accent hover:bg-dark-accent"
                disabled={creating || !teamName.trim()}
              >
                {creating ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Create Team
                  </span>
                )}
              </Button>
            </form>
          </>
        )}
      </Card>
    </div>
  );
}
