import React, { useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowRight, ChevronDown, Github, Globe, HelpCircle, Info, Link as LinkIcon,
} from 'lucide-react'
import { ResumeUpload } from '../components/ui/ResumeUpload'
import { Logo } from '../components/ui/Logo'
import { normalizeLinkedInUrl } from '../lib/urlNormalize'

interface IntakeFormPageProps {
  onSubmit: (data: any) => void
  onBack: () => void
  submitting?: boolean
}

const CONCERN_OPTIONS = [
  { value: 'career_pivot', label: 'Career Pivot' },
  { value: 'upskilling', label: 'Upskilling' },
  { value: 'team_readiness', label: 'Team Readiness' },
  { value: 'curiosity', label: 'Just Curious' },
]

const INDUSTRY_OPTIONS = [
  'Technology', 'Financial Services', 'Healthcare', 'Manufacturing',
  'Retail & E-Commerce', 'Media & Entertainment', 'Energy & Utilities',
  'Education', 'Real Estate', 'Consulting & Professional Services',
  'Government & Public Sector', 'Telecommunications',
  'Transportation & Logistics', 'Agriculture', 'Other',
]

/** Mock-aligned intake (Career-AI/onboarding-flow-mock.html §SCREEN 2):
 * single LinkedIn URL field + two optional toggles for GitHub/Resume, with
 * expanders that retain the existing website + role-context fields. */
export function IntakeFormPage({ onSubmit, onBack, submitting }: IntakeFormPageProps) {
  const [linkedinUrl, setLinkedinUrl] = useState('')
  const [error, setError] = useState('')
  const [urlCorrections, setUrlCorrections] = useState<string[]>([])
  const [showHelp, setShowHelp] = useState(false)

  // Optional signal toggles + inputs
  const [includeGithub, setIncludeGithub] = useState(false)
  const [includeResume, setIncludeResume] = useState(false)
  const [githubUrl, setGithubUrl] = useState('')
  const [resumeText, setResumeText] = useState('')

  // "Add more signals" expander
  const [showMore, setShowMore] = useState(false)
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [signalErrors, setSignalErrors] = useState<{ github?: string; website?: string }>({})

  // "Personalize" expander
  const [showContext, setShowContext] = useState(false)
  const [concern, setConcern] = useState('')
  const [aiInvolvement, setAiInvolvement] = useState(0)
  const [industry, setIndustry] = useState('')
  const [yearsInRole, setYearsInRole] = useState('')

  const isValidLinkedInUrl = (raw: string) => {
    try {
      const url = new URL(raw.includes('://') ? raw : `https://${raw}`)
      const host = url.hostname.replace(/^www\./, '')
      return host === 'linkedin.com' && /^\/(in|pub)\/[\w-]+\/?$/.test(url.pathname)
    } catch { return false }
  }
  const isValidGithubUrl = (raw: string) => {
    if (!raw.trim()) return true
    try {
      const url = new URL(raw.includes('://') ? raw : `https://${raw}`)
      return url.hostname.replace(/^www\./, '') === 'github.com' && url.pathname.length > 1
    } catch { return false }
  }
  const isValidWebsiteUrl = (raw: string) => {
    if (!raw.trim()) return true
    try {
      const url = new URL(raw.includes('://') ? raw : `https://${raw}`)
      return !!url.hostname && url.hostname.includes('.')
    } catch { return false }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const { url: normalized, corrections } = normalizeLinkedInUrl(linkedinUrl)
    if (corrections.length > 0) {
      setLinkedinUrl(normalized)
      setUrlCorrections(corrections)
    }
    if (!isValidLinkedInUrl(normalized)) {
      setError('Please enter a valid LinkedIn profile URL (e.g. https://linkedin.com/in/your-name)')
      return
    }

    const newSignalErrors: { github?: string; website?: string } = {}
    if (includeGithub && githubUrl && !isValidGithubUrl(githubUrl)) {
      newSignalErrors.github = 'Please enter a valid GitHub URL (e.g. github.com/username)'
    }
    if (websiteUrl && !isValidWebsiteUrl(websiteUrl)) {
      newSignalErrors.website = 'Please enter a valid website URL'
    }
    if (Object.keys(newSignalErrors).length > 0) {
      setSignalErrors(newSignalErrors)
      return
    }
    setSignalErrors({})

    const userContext: Record<string, any> = {}
    if (concern) userContext.concern = concern
    if (aiInvolvement > 0) userContext.ai_involvement = aiInvolvement
    if (industry) userContext.industry = industry
    const yrs = parseInt(yearsInRole, 10)
    if (!isNaN(yrs) && yrs > 0) userContext.years_in_role = yrs

    onSubmit({
      linkedinUrl: normalized,
      ...(includeResume && resumeText ? { resumeText } : {}),
      ...(includeGithub && githubUrl.trim() ? { githubUrl: githubUrl.trim() } : {}),
      ...(websiteUrl.trim() ? { websiteUrl: websiteUrl.trim() } : {}),
      ...(Object.keys(userContext).length > 0 ? { userContext } : {}),
    })
  }

  const aiLabels = ['', 'Minimal', 'Basic', 'Moderate', 'High', 'Central']

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="min-h-screen bg-white">
      {/* Top nav */}
      <header className="bg-white border-b border-surface-border">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo variant="compact" size="md" className="text-gray-900" />
          </div>
          <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-900">← Back</button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 pt-16 pb-12">
        <div className="text-[11px] font-semibold tracking-wider uppercase text-gray-500">Step 1 of 3</div>
        <h1 className="mt-3 text-3xl font-bold leading-tight text-gray-900">Drop your LinkedIn URL</h1>
        <p className="mt-3 text-gray-500">
          We'll pull your role, skills, and experience. The full survey + score takes about 3 minutes.
        </p>

        <form onSubmit={handleSubmit} className="mt-10 bg-white rounded-2xl border border-surface-border shadow-sm p-7">
          <label htmlFor="linkedin-input" className="block text-sm font-medium text-gray-700">
            LinkedIn profile URL
          </label>
          <div className="mt-2 relative">
            <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-gray-300">
              <LinkIcon className="w-4 h-4" />
            </span>
            <input
              id="linkedin-input"
              type="text"
              value={linkedinUrl}
              onChange={(e) => { setLinkedinUrl(e.target.value); if (error) setError('') }}
              placeholder="https://linkedin.com/in/your-name"
              className={`w-full border ${error ? 'border-red-300' : 'border-surface-border'} rounded-lg pl-10 pr-3 py-3 text-[15px] text-gray-900 placeholder:text-gray-300 focus:outline-none focus:border-linkedin focus:ring-2 focus:ring-linkedin/10 transition`}
              autoComplete="off"
            />
          </div>
          <p className="mt-2 text-xs text-gray-500 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-gray-300" />
            We don't ask you to log in. Public profile only.
          </p>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          {urlCorrections.length > 0 && (
            <p className="mt-2 text-xs text-gray-500">We auto-corrected your URL: {urlCorrections.join(', ')}.</p>
          )}

          <details className="mt-3 group" onToggle={(e) => setShowHelp((e.target as HTMLDetailsElement).open)}>
            <summary className="text-xs text-gray-500 hover:text-linkedin cursor-pointer inline-flex items-center gap-1 select-none">
              <HelpCircle className="w-3.5 h-3.5" /> Where do I find my LinkedIn URL?
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showHelp ? 'rotate-180' : ''}`} />
            </summary>
            <p className="mt-2 text-xs text-gray-500">
              Open your LinkedIn profile, click <strong>“Me”</strong> in the top nav, then <strong>“View Profile”</strong>.
              Copy the URL from your browser — it looks like <code>linkedin.com/in/your-name</code>.
            </p>
          </details>

          {/* Optional signal toggles */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className={`flex items-center gap-2 p-3 rounded-lg cursor-pointer transition border ${includeGithub ? 'border-linkedin bg-linkedin/5' : 'border-surface-border hover:border-linkedin'}`}>
              <input type="checkbox" className="w-4 h-4 accent-linkedin" checked={includeGithub} onChange={(e) => setIncludeGithub(e.target.checked)} />
              <Github className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-700">Include GitHub <span className="text-gray-300 text-xs">(optional)</span></span>
            </label>
            <label className={`flex items-center gap-2 p-3 rounded-lg cursor-pointer transition border ${includeResume ? 'border-linkedin bg-linkedin/5' : 'border-surface-border hover:border-linkedin'}`}>
              <input type="checkbox" className="w-4 h-4 accent-linkedin" checked={includeResume} onChange={(e) => setIncludeResume(e.target.checked)} />
              <span className="text-sm text-gray-700">Include resume <span className="text-gray-300 text-xs">(optional)</span></span>
            </label>
          </div>

          {includeGithub && (
            <div className="mt-4">
              <input
                type="text"
                value={githubUrl}
                onChange={(e) => { setGithubUrl(e.target.value); setSignalErrors((p) => ({ ...p, github: undefined })) }}
                placeholder="github.com/username"
                className={`w-full border ${signalErrors.github ? 'border-red-300' : 'border-surface-border'} rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:border-linkedin focus:ring-2 focus:ring-linkedin/10 transition`}
              />
              {signalErrors.github && <p className="mt-1 text-xs text-red-600">{signalErrors.github}</p>}
            </div>
          )}
          {includeResume && (
            <div className="mt-4">
              <ResumeUpload onResumeText={setResumeText} />
            </div>
          )}

          {/* Add more signals */}
          <details className="mt-5 group" onToggle={(e) => setShowMore((e.target as HTMLDetailsElement).open)}>
            <summary className="cursor-pointer inline-flex items-center gap-1.5 text-sm text-gray-700 hover:text-linkedin select-none">
              <Globe className="w-4 h-4" /> Add more signals
              <ChevronDown className={`w-4 h-4 transition-transform ${showMore ? 'rotate-180' : ''}`} />
            </summary>
            <div className="mt-3">
              <label htmlFor="website-input" className="block text-xs font-medium text-gray-700">Personal site</label>
              <input
                id="website-input"
                type="text"
                value={websiteUrl}
                onChange={(e) => { setWebsiteUrl(e.target.value); setSignalErrors((p) => ({ ...p, website: undefined })) }}
                placeholder="yourdomain.com"
                className={`mt-1.5 w-full border ${signalErrors.website ? 'border-red-300' : 'border-surface-border'} rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:border-linkedin focus:ring-2 focus:ring-linkedin/10 transition`}
              />
              {signalErrors.website && <p className="mt-1 text-xs text-red-600">{signalErrors.website}</p>}
            </div>
          </details>

          {/* Personalize */}
          <details className="mt-2 group" onToggle={(e) => setShowContext((e.target as HTMLDetailsElement).open)}>
            <summary className="cursor-pointer inline-flex items-center gap-1.5 text-sm text-gray-700 hover:text-linkedin select-none">
              Personalize your analysis
              <ChevronDown className={`w-4 h-4 transition-transform ${showContext ? 'rotate-180' : ''}`} />
            </summary>
            <div className="mt-3 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700">What brings you here?</label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {CONCERN_OPTIONS.map((opt) => {
                    const selected = concern === opt.value
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setConcern(selected ? '' : opt.value)}
                        className={`text-left rounded-lg px-3 py-2 text-sm border transition ${selected ? 'border-linkedin bg-linkedin/5 text-gray-900' : 'border-surface-border text-gray-700 hover:border-linkedin'}`}
                      >
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="industry-select" className="block text-xs font-medium text-gray-700">Industry</label>
                  <select
                    id="industry-select"
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    className="mt-1.5 w-full border border-surface-border rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-linkedin focus:ring-2 focus:ring-linkedin/10 transition bg-white"
                  >
                    <option value="">Select industry</option>
                    {INDUSTRY_OPTIONS.map((i) => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="years-input" className="block text-xs font-medium text-gray-700">Years in current role</label>
                  <input
                    id="years-input"
                    type="number"
                    min={0}
                    max={50}
                    value={yearsInRole}
                    onChange={(e) => setYearsInRole(e.target.value)}
                    placeholder="3"
                    className="mt-1.5 w-full border border-surface-border rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:border-linkedin focus:ring-2 focus:ring-linkedin/10 transition"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">How AI-involved is your day-to-day?</label>
                <div className="mt-2 flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setAiInvolvement(aiInvolvement === n ? 0 : n)}
                      className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium border transition ${aiInvolvement === n ? 'border-linkedin bg-linkedin text-white' : 'border-surface-border text-gray-700 hover:border-linkedin'}`}
                      aria-pressed={aiInvolvement === n}
                    >
                      {aiLabels[n]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </details>

          <button
            type="submit"
            disabled={submitting}
            className="mt-7 w-full inline-flex items-center justify-center gap-2 bg-linkedin hover:bg-linkedin-dark text-white font-medium py-3 rounded-lg text-[15px] transition-all enabled:hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Loading…' : 'Continue to survey'} <ArrowRight className="w-4 h-4" />
          </button>

          <div className="mt-5 pt-5 border-t border-surface-border text-xs text-gray-500 flex items-start gap-2">
            <Info className="w-4 h-4 text-gray-300 shrink-0 mt-0.5" />
            <span>Your profile data is only used to compute your score. We never repost or share it.</span>
          </div>
        </form>

        {/* What happens next */}
        <div className="mt-8 grid grid-cols-3 gap-3 text-center">
          <NextStep emoji="📋" title="90s survey" sub="10 quick questions" />
          <NextStep emoji="⚡" title="Profile parsed" sub="in parallel — no wait" />
          <NextStep emoji="🎯" title="Score + breakdown" sub="free dashboard" />
        </div>
      </div>
    </motion.div>
  )
}

function NextStep({ emoji, title, sub }: { emoji: string; title: string; sub: string }) {
  return (
    <div className="bg-white rounded-xl p-4 border border-surface-border">
      <div className="text-2xl">{emoji}</div>
      <div className="text-xs font-semibold mt-2 text-gray-900">{title}</div>
      <div className="text-[11px] text-gray-500 mt-1">{sub}</div>
    </div>
  )
}
