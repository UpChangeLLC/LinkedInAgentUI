import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Link as LinkIcon,
  User,
  Linkedin,
  HelpCircle,
  X,
  ChevronDown,
  Settings2,
  Github,
  Globe,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ProgressBar } from '../components/ui/ProgressBar';
import { LinkedInNav } from '../components/ui/LinkedInNav';

interface IntakeFormPageProps {
  onSubmit: (data: any) => void;
  onBack: () => void;
}

const CONCERN_OPTIONS = [
  { value: 'career_pivot', label: 'Career Pivot', desc: 'Exploring new roles or industries' },
  { value: 'upskilling', label: 'Upskilling', desc: 'Building AI skills for my current role' },
  { value: 'team_readiness', label: 'Team Readiness', desc: 'Assessing my team\'s AI preparedness' },
  { value: 'curiosity', label: 'Just Curious', desc: 'General interest in my AI resilience' },
];

const INDUSTRY_OPTIONS = [
  'Technology',
  'Financial Services',
  'Healthcare',
  'Manufacturing',
  'Retail & E-Commerce',
  'Media & Entertainment',
  'Energy & Utilities',
  'Education',
  'Real Estate',
  'Consulting & Professional Services',
  'Government & Public Sector',
  'Telecommunications',
  'Transportation & Logistics',
  'Agriculture',
  'Other',
];

export function IntakeFormPage({ onSubmit, onBack }: IntakeFormPageProps) {
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [error, setError] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const [showContext, setShowContext] = useState(false);

  // Multi-signal input state (F2)
  const [githubUrl, setGithubUrl] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [showSignals, setShowSignals] = useState(false);
  const [signalErrors, setSignalErrors] = useState<{ github?: string; website?: string }>({});

  // Context question state
  const [concern, setConcern] = useState('');
  const [aiInvolvement, setAiInvolvement] = useState(0);
  const [industry, setIndustry] = useState('');
  const [yearsInRole, setYearsInRole] = useState('');

  const isValidLinkedInUrl = (raw: string): boolean => {
    try {
      const url = new URL(raw.includes('://') ? raw : `https://${raw}`);
      const host = url.hostname.replace(/^www\./, '');
      return host === 'linkedin.com' && /^\/(in|pub)\/[\w-]+\/?$/.test(url.pathname);
    } catch {
      return false;
    }
  };

  const isValidGithubUrl = (raw: string): boolean => {
    if (!raw.trim()) return true; // Optional field
    try {
      const url = new URL(raw.includes('://') ? raw : `https://${raw}`);
      const host = url.hostname.replace(/^www\./, '');
      return host === 'github.com' && url.pathname.length > 1;
    } catch {
      return false;
    }
  };

  const isValidWebsiteUrl = (raw: string): boolean => {
    if (!raw.trim()) return true; // Optional field
    try {
      const url = new URL(raw.includes('://') ? raw : `https://${raw}`);
      return !!url.hostname && url.hostname.includes('.');
    } catch {
      return false;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidLinkedInUrl(linkedinUrl)) {
      setError('Please enter a valid LinkedIn profile URL (e.g. https://linkedin.com/in/your-name)');
      return;
    }

    // Validate optional signal URLs
    const newSignalErrors: { github?: string; website?: string } = {};
    if (githubUrl && !isValidGithubUrl(githubUrl)) {
      newSignalErrors.github = 'Please enter a valid GitHub URL (e.g. github.com/username)';
    }
    if (websiteUrl && !isValidWebsiteUrl(websiteUrl)) {
      newSignalErrors.website = 'Please enter a valid website URL';
    }
    if (Object.keys(newSignalErrors).length > 0) {
      setSignalErrors(newSignalErrors);
      return;
    }
    setSignalErrors({});

    // Build user context (only include non-empty values)
    const userContext: Record<string, any> = {};
    if (concern) userContext.concern = concern;
    if (aiInvolvement > 0) userContext.ai_involvement = aiInvolvement;
    if (industry) userContext.industry = industry;
    const yrs = parseInt(yearsInRole, 10);
    if (!isNaN(yrs) && yrs > 0) userContext.years_in_role = yrs;

    onSubmit({
      linkedinUrl,
      ...(githubUrl.trim() ? { githubUrl: githubUrl.trim() } : {}),
      ...(websiteUrl.trim() ? { websiteUrl: websiteUrl.trim() } : {}),
      ...(Object.keys(userContext).length > 0 ? { userContext } : {}),
    });
  };

  const aiLabels = ['', 'Minimal', 'Basic', 'Moderate', 'High', 'Central'];
  const hasContext = concern || aiInvolvement > 0 || industry || yearsInRole;

  return (
    <div className="min-h-screen bg-linkedin-bg">
      <LinkedInNav />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="py-12 px-4"
      >
        <div className="max-w-2xl mx-auto">
          <button
            onClick={onBack}
            className="flex items-center text-gray-500 hover:text-gray-900 mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </button>

          <Card className="p-8 md:p-10 shadow-sm border border-gray-200 bg-white">
            <div className="mb-8">
              <div className="flex justify-between items-end mb-2">
                <h2 className="text-sm font-semibold text-linkedin uppercase tracking-wider">
                  Step 1 of 3
                </h2>
                <span className="text-sm text-gray-400">33% Completed</span>
              </div>
              <ProgressBar progress={33} />
            </div>

            <div className="mb-8 text-center">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
                Paste Your LinkedIn Profile
              </h1>
              <p className="text-gray-600">
                We will analyze your role, industry, experience, and company to
                generate your personalized AI Resilience Score&trade;
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* LinkedIn URL input */}
              <div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <LinkIcon className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    className={`block w-full pl-10 pr-3 py-4 border ${error ? 'border-red-300' : 'border-gray-300'} rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:border-linkedin focus:ring-1 focus:ring-linkedin sm:text-lg transition duration-150 ease-in-out`}
                    placeholder="https://linkedin.com/in/your-profile"
                    value={linkedinUrl}
                    onChange={(e) => {
                      setLinkedinUrl(e.target.value);
                      if (error) setError('');
                    }}
                  />
                  {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
                </div>

                {/* Help: Where to find your LinkedIn URL */}
                <button
                  type="button"
                  onClick={() => setShowHelp(!showHelp)}
                  className="mt-3 flex items-center gap-1.5 text-sm text-gray-400 hover:text-linkedin transition-colors"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>Where do I find my LinkedIn URL?</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform ${showHelp ? 'rotate-180' : ''}`}
                  />
                </button>

                <AnimatePresence>
                  {showHelp && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-3 bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-3">
                          <p className="text-sm text-gray-600 font-medium">
                            Go to your LinkedIn profile and copy the URL from
                            your browser's address bar:
                          </p>
                          <button
                            type="button"
                            onClick={() => setShowHelp(false)}
                            className="text-gray-400 hover:text-gray-600 ml-2 flex-shrink-0"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="rounded-lg overflow-hidden border border-gray-200 shadow-sm bg-white">
                          <div className="bg-gray-100 px-3 py-2 flex items-center gap-2 border-b border-gray-200">
                            <div className="flex gap-1.5">
                              <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                              <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                              <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                            </div>
                            <div className="flex-1 bg-white rounded px-3 py-1 text-xs text-gray-600 font-mono border border-gray-200">
                              <span className="text-gray-400">https://</span>
                              <span className="text-linkedin font-semibold">
                                linkedin.com/in/your-name
                              </span>
                            </div>
                          </div>
                          <div className="p-4 flex items-center gap-4">
                            <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                              <User className="w-8 h-8 text-gray-400" />
                            </div>
                            <div>
                              <div className="h-4 w-32 bg-gray-200 rounded mb-2" />
                              <div className="h-3 w-48 bg-gray-100 rounded mb-1" />
                              <div className="h-3 w-40 bg-gray-100 rounded" />
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 flex items-start gap-2">
                          <div className="w-4 h-4 rounded-full bg-linkedin/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-linkedin text-[10px] font-bold">1</span>
                          </div>
                          <p className="text-xs text-gray-500">
                            Open LinkedIn and go to your profile page
                          </p>
                        </div>
                        <div className="mt-2 flex items-start gap-2">
                          <div className="w-4 h-4 rounded-full bg-linkedin/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-linkedin text-[10px] font-bold">2</span>
                          </div>
                          <p className="text-xs text-gray-500">
                            Copy the full URL from your browser address bar (it
                            looks like{' '}
                            <span className="font-mono text-gray-700">
                              linkedin.com/in/your-name
                            </span>
                            )
                          </p>
                        </div>
                        <div className="mt-2 flex items-start gap-2">
                          <div className="w-4 h-4 rounded-full bg-linkedin/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-linkedin text-[10px] font-bold">3</span>
                          </div>
                          <p className="text-xs text-gray-500">
                            Paste it in the field above
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Profile URL detected indicator */}
              {linkedinUrl.length > 10 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="border border-gray-200 rounded-lg p-4 bg-gray-50 flex items-center gap-4"
                >
                  <div className="w-12 h-12 rounded-full bg-linkedin/10 flex items-center justify-center flex-shrink-0">
                    <LinkIcon className="w-6 h-6 text-linkedin" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">LinkedIn profile detected</p>
                    <p className="text-sm text-gray-600">
                      We'll analyze your public profile information
                    </p>
                  </div>
                </motion.div>
              )}

              {/* ── Multi-Signal Input (F2) ────────────────────────── */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowSignals(!showSignals)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">
                      Add More Signals
                    </span>
                    {(githubUrl || websiteUrl) && (
                      <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-medium">
                        {[githubUrl, websiteUrl].filter(Boolean).length} added
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">Optional</span>
                    <ChevronDown
                      className={`w-4 h-4 text-gray-400 transition-transform ${showSignals ? 'rotate-180' : ''}`}
                    />
                  </div>
                </button>

                <AnimatePresence>
                  {showSignals && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 py-5 space-y-4 border-t border-gray-200">
                        <p className="text-xs text-gray-500">
                          Add additional profile links for a more comprehensive analysis.
                        </p>

                        {/* GitHub URL */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            GitHub Profile
                          </label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <Github className="h-4 w-4 text-gray-400" />
                            </div>
                            <input
                              type="text"
                              className={`block w-full pl-10 pr-3 py-2.5 border ${signalErrors.github ? 'border-red-300' : 'border-gray-300'} rounded-lg bg-white text-sm placeholder-gray-400 focus:outline-none focus:border-linkedin focus:ring-1 focus:ring-linkedin transition`}
                              placeholder="github.com/username"
                              value={githubUrl}
                              onChange={(e) => {
                                setGithubUrl(e.target.value);
                                if (signalErrors.github) setSignalErrors((prev) => ({ ...prev, github: undefined }));
                              }}
                            />
                          </div>
                          {signalErrors.github && (
                            <p className="mt-1 text-xs text-red-600">{signalErrors.github}</p>
                          )}
                        </div>

                        {/* Website URL */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            Personal Website
                          </label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <LinkIcon className="h-4 w-4 text-gray-400" />
                            </div>
                            <input
                              type="text"
                              className={`block w-full pl-10 pr-3 py-2.5 border ${signalErrors.website ? 'border-red-300' : 'border-gray-300'} rounded-lg bg-white text-sm placeholder-gray-400 focus:outline-none focus:border-linkedin focus:ring-1 focus:ring-linkedin transition`}
                              placeholder="https://yourwebsite.com"
                              value={websiteUrl}
                              onChange={(e) => {
                                setWebsiteUrl(e.target.value);
                                if (signalErrors.website) setSignalErrors((prev) => ({ ...prev, website: undefined }));
                              }}
                            />
                          </div>
                          {signalErrors.website && (
                            <p className="mt-1 text-xs text-red-600">{signalErrors.website}</p>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* ── Contextual Intake Questions (Optional) ────────────── */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowContext(!showContext)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Settings2 className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">
                      Personalize Your Analysis
                    </span>
                    {hasContext && (
                      <span className="text-xs bg-linkedin/10 text-linkedin px-2 py-0.5 rounded-full font-medium">
                        Customized
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">Optional</span>
                    <ChevronDown
                      className={`w-4 h-4 text-gray-400 transition-transform ${showContext ? 'rotate-180' : ''}`}
                    />
                  </div>
                </button>

                <AnimatePresence>
                  {showContext && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 py-5 space-y-5 border-t border-gray-200">
                        <p className="text-xs text-gray-500">
                          Answer a few quick questions to get a more tailored analysis.
                          All questions are optional.
                        </p>

                        {/* Q1: Primary Concern */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            What's your primary concern?
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            {CONCERN_OPTIONS.map((opt) => (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() =>
                                  setConcern(concern === opt.value ? '' : opt.value)
                                }
                                className={`text-left p-3 rounded-lg border transition-all ${
                                  concern === opt.value
                                    ? 'border-linkedin bg-linkedin/5 ring-1 ring-linkedin'
                                    : 'border-gray-200 hover:border-gray-300 bg-white'
                                }`}
                              >
                                <p
                                  className={`text-sm font-medium ${
                                    concern === opt.value
                                      ? 'text-linkedin'
                                      : 'text-gray-900'
                                  }`}
                                >
                                  {opt.label}
                                </p>
                                <p className="text-xs text-gray-500 mt-0.5">
                                  {opt.desc}
                                </p>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Q2: AI Involvement Slider */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            How involved is AI in your current work?
                          </label>
                          <div className="space-y-2">
                            <input
                              type="range"
                              min="0"
                              max="5"
                              value={aiInvolvement}
                              onChange={(e) =>
                                setAiInvolvement(parseInt(e.target.value, 10))
                              }
                              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-linkedin"
                            />
                            <div className="flex justify-between text-xs text-gray-400">
                              <span>Not specified</span>
                              <span>
                                {aiInvolvement > 0
                                  ? `${aiLabels[aiInvolvement]} (${aiInvolvement}/5)`
                                  : 'Slide to rate'}
                              </span>
                              <span>Central</span>
                            </div>
                          </div>
                        </div>

                        {/* Q3: Industry */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Your industry
                          </label>
                          <select
                            value={industry}
                            onChange={(e) => setIndustry(e.target.value)}
                            className="block w-full px-3 py-2.5 border border-gray-300 rounded-lg bg-white text-sm text-gray-900 focus:outline-none focus:border-linkedin focus:ring-1 focus:ring-linkedin"
                          >
                            <option value="">Select your industry...</option>
                            {INDUSTRY_OPTIONS.map((ind) => (
                              <option key={ind} value={ind}>
                                {ind}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Q4: Years in current role */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Years in current role
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="50"
                            placeholder="e.g. 3"
                            value={yearsInRole}
                            onChange={(e) => setYearsInRole(e.target.value)}
                            className="block w-32 px-3 py-2.5 border border-gray-300 rounded-lg bg-white text-sm text-gray-900 focus:outline-none focus:border-linkedin focus:ring-1 focus:ring-linkedin"
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  fullWidth
                  size="lg"
                  className="bg-[#0A66C2] hover:bg-[#004182]"
                >
                  Analyze My Profile
                </Button>
                <p className="mt-4 text-center text-xs text-gray-500">
                  We only access your public profile information
                </p>
              </div>
            </form>

            {/* Divider */}
            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-gray-400">or</span>
              </div>
            </div>

            {/* LinkedIn Login Option — Coming Soon */}
            <button
              disabled
              className="w-full flex items-center justify-center gap-3 px-6 py-3.5 border border-gray-200 rounded-lg opacity-50 cursor-not-allowed"
            >
              <Linkedin className="w-5 h-5 text-[#0A66C2]" />
              <span className="text-gray-700 font-medium">
                Sign in with LinkedIn
              </span>
              <span className="text-xs text-gray-400 ml-1">(Coming Soon)</span>
            </button>
            <p className="mt-3 text-center text-xs text-gray-400">
              Don't know your profile URL? LinkedIn sign-in is coming soon.
            </p>
          </Card>
        </div>
      </motion.div>
    </div>
  );
}
