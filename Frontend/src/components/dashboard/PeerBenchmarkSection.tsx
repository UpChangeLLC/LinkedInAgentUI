import React from 'react';
import { motion } from 'framer-motion';
import { Card } from '../ui/Card';
import { MockResults } from '../../data/mockResults';
import { Users, TrendingUp, Building2 } from 'lucide-react';
interface PeerBenchmarkSectionProps {
  results: MockResults;
}
export function PeerBenchmarkSection({ results }: PeerBenchmarkSectionProps) {
  const { personalProfile, score } = results;
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Peer Benchmarking
          </h2>
          <p className="text-gray-600">
            See how you stack up against 12,405 other executives.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <BenchmarkCard
          icon={Users}
          title="Vs. Industry Average"
          subtitle={personalProfile.industry}
          userScore={score}
          avgScore={54}
          percentile="Top 15%" />
        
        <BenchmarkCard
          icon={TrendingUp}
          title="Vs. Role Average"
          subtitle={personalProfile.title}
          userScore={score}
          avgScore={48}
          percentile="Top 8%" />
        
        <BenchmarkCard
          icon={Building2}
          title="Vs. Company Size"
          subtitle="500-1000 employees"
          userScore={score}
          avgScore={61}
          percentile="Top 42%" />
        
      </div>

      {/* Distribution Graph */}
      <Card className="p-6 md:p-8">
        <h3 className="font-bold text-gray-900 mb-6">
          Score Distribution: {personalProfile.title}s in{' '}
          {personalProfile.industry}
        </h3>

        <div className="relative h-48 w-full flex items-end justify-between gap-1 md:gap-2">
          {/* Mock Distribution Bars */}
          {[10, 15, 25, 40, 65, 85, 95, 80, 60, 45, 30, 20, 10, 5].map(
            (height, i) => {
              const isUserBucket = i === 9; // Roughly where 63 would be
              return (
                <div
                  key={i}
                  className="flex-1 flex flex-col items-center gap-2 group relative">
                  
                  {isUserBucket &&
                  <motion.div
                    initial={{
                      opacity: 0,
                      y: 10
                    }}
                    animate={{
                      opacity: 1,
                      y: 0
                    }}
                    className="absolute -top-10 left-1/2 -translate-x-1/2 bg-linkedin text-white text-xs font-bold px-2 py-1 rounded shadow-lg whitespace-nowrap z-10">
                    
                      You ({score})
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-linkedin rotate-45"></div>
                    </motion.div>
                  }
                  <motion.div
                    initial={{
                      height: 0
                    }}
                    whileInView={{
                      height: `${height}%`
                    }}
                    transition={{
                      duration: 0.8,
                      delay: i * 0.05
                    }}
                    className={`w-full rounded-t-sm ${isUserBucket ? 'bg-linkedin' : 'bg-gray-200 group-hover:bg-gray-300'} transition-colors`} />
                  
                </div>);

            }
          )}
        </div>
        <div className="flex justify-between mt-2 text-xs text-gray-400 font-mono border-t border-gray-100 pt-2">
          <span>0</span>
          <span>25</span>
          <span>50</span>
          <span>75</span>
          <span>100</span>
        </div>
      </Card>
    </div>);

}
function BenchmarkCard({
  icon: Icon,
  title,
  subtitle,
  userScore,
  avgScore,
  percentile
}: any) {
  const diff = userScore - avgScore;
  const isPositive = diff >= 0;
  return (
    <Card className="p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="p-2 bg-gray-50 rounded-lg">
          <Icon className="w-5 h-5 text-gray-600" />
        </div>
        <span className="bg-green-50 text-green-700 text-xs font-bold px-2 py-1 rounded-full">
          {percentile}
        </span>
      </div>

      <h3 className="font-semibold text-gray-900">{title}</h3>
      <p className="text-xs text-gray-500 mb-4">{subtitle}</p>

      <div className="flex items-end gap-2 mb-2">
        <span className="text-3xl font-bold text-gray-900">{userScore}</span>
        <span className="text-sm text-gray-500 mb-1">vs {avgScore} avg</span>
      </div>

      <div
        className={`text-xs font-medium ${isPositive ? 'text-green-600' : 'text-red-600'} flex items-center gap-1`}>
        
        {isPositive ? '+' : ''}
        {diff} points {isPositive ? 'higher' : 'lower'}
      </div>
    </Card>);

}