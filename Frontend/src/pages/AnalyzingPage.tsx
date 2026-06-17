import { motion, useReducedMotion } from 'framer-motion';
import { Clock3, Activity, Sparkles, CheckCircle2 } from 'lucide-react';
import { PipelineProgress, derivePipelineMetrics } from '../components/ui/PipelineProgress';
import { LiveCounterBase } from '../components/ui/LiveCounter';
import type { PipelineProgress as PipelineProgressType } from '../hooks/useAppState';
import type { AnalysisCompletionPhase } from '../hooks/useAppState';

interface AnalyzingPageProps {
  pipelineProgress: PipelineProgressType;
  completionPhase: AnalysisCompletionPhase;
  optimisticCounterDelta?: number;
}

export function AnalyzingPage({ pipelineProgress, completionPhase, optimisticCounterDelta = 0 }: AnalyzingPageProps) {
  const prefersReducedMotion = useReducedMotion();

  // Derive phase label from current node
  const getPhaseInfo = () => {
    const node = pipelineProgress.currentNode;
    const p = pipelineProgress.progress;

    if (p >= 95) return { phase: 6, title: 'Finalizing Report' };
    if (node === 'analyze_node_graph') return { phase: 5, title: 'Computing AI Resilience Score' };
    if (node === 'merge_profiles_node') return { phase: 4, title: 'Merging Profile Data' };
    if (node === 'extract_profiles_node') return { phase: 3, title: 'Extracting Skills & Experience' };
    if (node === 'web_search_node') return { phase: 2, title: 'Searching Profile Data' };
    if (node === 'fetch_sources_node') return { phase: 2, title: 'Fetching LinkedIn Profile' };
    if (node === 'validate_input_node') return { phase: 1, title: 'Validating Profile' };
    return { phase: 1, title: 'Starting Analysis' };
  };

  const { phase, title } = getPhaseInfo();
  const totalPhases = 6;
  const progress = pipelineProgress.progress;
  const metrics = derivePipelineMetrics(pipelineProgress);
  const showCompletionBeat = completionPhase === 'result_ready';

  return (
    <div className="min-h-screen bg-navy-900 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background grid + soft glows */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,rgba(20,184,166,0.2)_0,rgba(10,20,40,0)_58%)]" />
        <div className="absolute inset-0 opacity-10 [background-image:linear-gradient(to_right,rgba(148,163,184,0.2)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.2)_1px,transparent_1px)] [background-size:28px_28px]" />
      </div>

      <div className="w-full max-w-3xl z-10">
        {/* Circular Spinner */}
        <div className="flex justify-center mb-6">
          <motion.div
            className="w-24 h-24 relative"
            animate={prefersReducedMotion ? {} : { rotate: 360 }}
            transition={prefersReducedMotion ? {} : { duration: 2, repeat: Infinity, ease: 'linear' }}
          >
            <svg viewBox="0 0 100 100" className="w-full h-full">
              <circle cx="50" cy="50" r="45" fill="none" stroke="#1E293B" strokeWidth="4" />
              <circle
                cx="50" cy="50" r="45" fill="none"
                stroke="#14B8A6" strokeWidth="4"
                strokeDasharray="70 213"
                strokeLinecap="round"
              />
            </svg>
          </motion.div>
        </div>

        {/* Phase header */}
        <div className="text-center mb-8" aria-live="polite" aria-atomic="true">
          <h2 className="text-linkedin-light font-mono text-sm mb-2 uppercase tracking-widest">
            Phase {Math.min(phase, totalPhases)}/{totalPhases}
          </h2>
          <motion.h1
            key={title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl md:text-4xl font-bold text-white mb-4"
          >
            {title}
          </motion.h1>
          {pipelineProgress.message && pipelineProgress.message !== title && (
            <motion.p
              key={pipelineProgress.message}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-gray-400 text-sm"
            >
              {pipelineProgress.message}
            </motion.p>
          )}
          <p className="text-gray-500 text-xs mt-2">
            Building your AI resilience profile from real market signals and your role context.
          </p>
        </div>

        {/* Hybrid active status rail */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-navy-700 bg-navy-800/60 px-3 py-2">
            <Clock3 className="w-4 h-4 text-linkedin" />
            <span className="text-xs text-gray-300">Elapsed</span>
            <span className="ml-auto text-sm font-semibold text-white tabular-nums">
              {metrics.elapsedSec}s
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-navy-700 bg-navy-800/60 px-3 py-2">
            <Activity className="w-4 h-4 text-linkedin" />
            <span className="text-xs text-gray-300">Steps</span>
            <span className="ml-auto text-sm font-semibold text-white tabular-nums">
              {metrics.completedSteps}/{metrics.totalSteps}
            </span>
          </div>
          <LiveCounterBase
            compact
            showOnMobile
            optimisticDelta={optimisticCounterDelta}
            className="justify-between rounded-lg border border-navy-700 bg-navy-800/60"
          />
        </div>

        {/* Active step narrative */}
        <div className="mb-6 rounded-lg border border-linkedin/30 bg-linkedin/10 px-4 py-3">
          <div className="flex items-center gap-2 text-linkedin-light text-xs uppercase tracking-wider font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            Active Processing
          </div>
          <p className="text-white text-sm mt-1">{metrics.activeStepLabel}</p>
          {metrics.lastDurationMs > 0 && (
            <p className="text-xs text-gray-400 mt-1">
              Last completed step: {(metrics.lastDurationMs / 1000).toFixed(1)}s
              {metrics.lastDataPoints > 0 ? ` • ${metrics.lastDataPoints} data points` : ''}
            </p>
          )}
        </div>

        {/* Real-time pipeline progress */}
        <div className="min-h-[350px] flex items-start justify-center pt-4">
          <PipelineProgress progress={pipelineProgress} />
        </div>

        {/* Progress bar */}
        <div className="mt-8 max-w-xl mx-auto">
          <div className="flex justify-between text-xs text-gray-400 mb-2 font-mono" aria-live="polite">
            <span>
              {progress >= 100
                ? 'Analysis Complete'
                : 'Analyzing...'}
            </span>
            <span>{Math.round(progress)}% Complete</span>
          </div>
          <div
            className="h-1.5 w-full bg-navy-800 rounded-full overflow-hidden"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress)}
            aria-label="Analysis progress"
          >
            <motion.div
              className="h-full bg-gradient-to-r from-linkedin to-blue-400 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
        </div>

        {/* Brief completion reveal before dashboard transition */}
        {showCompletionBeat && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-center"
          >
            <div className="flex items-center justify-center gap-2 text-green-300">
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-sm font-medium">Your report is ready</span>
            </div>
            <p className="text-xs text-gray-300 mt-1">Preparing your dashboard...</p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
