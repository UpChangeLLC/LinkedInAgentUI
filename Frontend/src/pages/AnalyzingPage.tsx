import { motion } from 'framer-motion';
import { PipelineProgress } from '../components/ui/PipelineProgress';
import type { PipelineProgress as PipelineProgressType } from '../hooks/useAppState';

interface AnalyzingPageProps {
  onComplete: () => void;
  pipelineProgress: PipelineProgressType;
}

export function AnalyzingPage({ onComplete, pipelineProgress }: AnalyzingPageProps) {
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

  return (
    <div className="min-h-screen bg-navy-900 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Particles */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(15)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-linkedin/30 rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [0, Math.random() * -100],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: 2 + Math.random() * 3,
              repeat: Infinity,
              ease: 'linear',
            }}
          />
        ))}
      </div>

      <div className="w-full max-w-3xl z-10">
        {/* Phase header */}
        <div className="text-center mb-8">
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
        </div>

        {/* Real-time pipeline progress */}
        <div className="min-h-[350px] flex items-start justify-center pt-4">
          <PipelineProgress progress={pipelineProgress} />
        </div>

        {/* Progress bar */}
        <div className="mt-8 max-w-xl mx-auto">
          <div className="flex justify-between text-xs text-gray-400 mb-2 font-mono">
            <span>
              {progress >= 100
                ? 'Analysis Complete'
                : 'Analyzing...'}
            </span>
            <span>{Math.round(progress)}% Complete</span>
          </div>
          <div className="h-1.5 w-full bg-navy-800 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-linkedin to-blue-400 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
