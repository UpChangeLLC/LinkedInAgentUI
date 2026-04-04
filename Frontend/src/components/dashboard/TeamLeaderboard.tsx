import { motion } from 'framer-motion';
import { Card } from '../ui/Card';
import { Trophy, Medal, Award } from 'lucide-react';

interface TeamMember {
  id: string;
  url_hash: string;
  display_name: string;
  score: number;
  role_category: string;
  joined_at: string | null;
}

interface TeamStats {
  avg_score: number;
  count: number;
  top_score: number;
  bottom_score: number;
  score_gap: number;
}

interface TeamLeaderboardProps {
  teamName: string;
  members: TeamMember[];
  stats: TeamStats;
  currentUrlHash?: string;
}

function getRankIcon(rank: number) {
  if (rank === 1) return <Trophy className="w-5 h-5 text-yellow-500" />;
  if (rank === 2) return <Medal className="w-5 h-5 text-dark-textMuted" />;
  if (rank === 3) return <Award className="w-5 h-5 text-dark-amber" />;
  return <span className="w-5 h-5 flex items-center justify-center text-sm font-bold text-dark-textMuted">{rank}</span>;
}

function getScoreColor(score: number): string {
  if (score >= 70) return 'bg-dark-green';
  if (score >= 50) return 'bg-yellow-500';
  if (score >= 30) return 'bg-orange-500';
  return 'bg-red-500';
}

export function TeamLeaderboard({ teamName, members, stats, currentUrlHash }: TeamLeaderboardProps) {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-dark-textPri">{teamName}</h3>
          <p className="text-sm text-dark-textMuted">{stats.count} members | Avg score: {stats.avg_score}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-dark-textMuted">Score gap</p>
          <p className="text-lg font-bold text-dark-textSec">{stats.score_gap} pts</p>
        </div>
      </div>

      <div className="space-y-3">
        {members.map((member, index) => {
          const rank = index + 1;
          const isCurrentUser = currentUrlHash ? member.url_hash === currentUrlHash : false;
          const barWidth = stats.top_score > 0 ? Math.max(5, (member.score / stats.top_score) * 100) : 0;

          return (
            <motion.div
              key={member.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                isCurrentUser ? 'bg-dark-accentDim border border-dark-accent/20' : 'bg-dark-elevated hover:bg-dark-elevated'
              }`}
            >
              <div className="flex-shrink-0 w-8 flex justify-center">
                {getRankIcon(rank)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-dark-textPri truncate">
                    {member.display_name}
                  </span>
                  {isCurrentUser && (
                    <span className="text-xs bg-dark-accent text-white px-2 py-0.5 rounded-full">You</span>
                  )}
                  {member.role_category && (
                    <span className="text-xs text-dark-textMuted truncate">{member.role_category}</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-dark-elevated rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${barWidth}%` }}
                      transition={{ duration: 0.8, delay: index * 0.05 }}
                      className={`h-full rounded-full ${getScoreColor(member.score)}`}
                    />
                  </div>
                  <span className="text-sm font-bold text-dark-textSec w-10 text-right">
                    {member.score}
                  </span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </Card>
  );
}
