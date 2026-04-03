import React, { useState } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Send, Users, Trophy } from 'lucide-react';
import { trackEvent } from '../../lib/analytics';
export function ChallengeColleagueSection() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    trackEvent('challenge_sent');
    setSent(true);
    setTimeout(() => {
      setSent(false);
      setEmail('');
    }, 3000);
  };
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card className="p-8 bg-gradient-to-br from-linkedin to-linkedin-dark text-white border-none">
        <div className="flex items-center gap-3 mb-4">
          <Trophy className="w-8 h-8 text-yellow-300" />
          <h2 className="text-2xl font-bold">Team Challenge</h2>
        </div>
        <p className="text-linkedin-light mb-8 text-lg">
          See if your executive team is as AI-ready as you are. Compare scores
          to identify leadership gaps.
        </p>

        <div className="flex -space-x-2 mb-6">
          {[1, 2, 3, 4].map((i) =>
          <div
            key={i}
            className="w-10 h-10 rounded-full border-2 border-linkedin-dark bg-white/20 flex items-center justify-center text-xs font-bold">
            
              {String.fromCharCode(64 + i)}
            </div>
          )}
          <div className="w-10 h-10 rounded-full border-2 border-linkedin-dark bg-white flex items-center justify-center text-xs font-bold text-linkedin-dark">
            +12
          </div>
        </div>

        <p className="text-sm text-white/60">
          Over 450 executive teams are currently benchmarking their combined
          resilience scores.
        </p>
      </Card>

      <Card className="p-8 flex flex-col justify-center">
        <h3 className="text-xl font-bold text-gray-900 mb-2">
          Challenge a Colleague
        </h3>
        <p className="text-gray-600 mb-6">
          Send a private challenge link. We'll show you how your scores compare
          once they complete the analysis.
        </p>

        {sent ?
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3 text-green-800 animate-in fade-in slide-in-from-bottom-2">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
              <Send className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold">Challenge Sent!</p>
              <p className="text-xs">We'll notify you when they complete it.</p>
            </div>
          </div> :

        <form onSubmit={handleSend} className="space-y-4">
            <Input
            placeholder="colleague@company.com"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bg-gray-50" />
          
            <Button fullWidth className="bg-linkedin hover:bg-linkedin-dark">
              Send Challenge
            </Button>
          </form>
        }
      </Card>
    </div>);

}