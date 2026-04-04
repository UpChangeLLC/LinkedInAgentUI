import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Loader2, AlertCircle, Zap } from 'lucide-react';
import type { PipelineProgress as PipelineProgressType } from '../../hooks/useAppState';

interface PipelineProgressProps {
  progress: PipelineProgressType;
}

const NODE_CONFIG: Record<string, { label: string; icon: string }> = {
  validate_input_node: { label: 'Validating Profile URL', icon: 'check' },
  fetch_sources_node: { label: 'Fetching LinkedIn Profile', icon: 'download' },
  web_search_node: { label: 'Searching Profile Data', icon: 'search' },
  extract_profiles_node: { label: 'Extracting Skills & Experience', icon: 'extract' },
  merge_profiles_node: { label: 'Merging Profile Sources', icon: 'merge' },
  analyze_node_graph: { label: 'Computing AI Resilience Score', icon: 'brain' },
};

const NODE_ORDER = [
  'validate_input_node',
  'fetch_sources_node',
  'web_search_node',
  'extract_profiles_node',
  'merge_profiles_node',
  'analyze_node_graph',
];

export function PipelineProgress({ progress }: PipelineProgressProps) {
  const completedNodes = new Set(
    progress.events
      .filter((e) => e.event_type === 'node_complete' && e.status === 'success')
      .map((e) => e.node)
  );
  const errorNodes = new Set(
    progress.events
      .filter((e) => e.event_type === 'node_complete' && e.status === 'error')
      .map((e) => e.node)
  );

  // Determine current active node
  const activeNodeIndex = NODE_ORDER.findIndex(
    (n) => !completedNodes.has(n) && !errorNodes.has(n)
  );

  const elapsedSec = Math.round(progress.elapsedMs / 1000);

  return (
    <div className="w-full max-w-lg mx-auto space-y-6">
      {/* Node status list */}
      <div className="space-y-3">
        <AnimatePresence>
          {NODE_ORDER.map((nodeKey, idx) => {
            const config = NODE_CONFIG[nodeKey];
            if (!config) return null;

            const isCompleted = completedNodes.has(nodeKey);
            const isError = errorNodes.has(nodeKey);
            const isActive = idx === activeNodeIndex;
            const isPending = !isCompleted && !isError && !isActive;

            // Skip web_search_node if fetch succeeded
            if (nodeKey === 'web_search_node' && completedNodes.has('fetch_sources_node')) {
              return null;
            }

            const event = progress.events.find(
              (e) => e.node === nodeKey && e.event_type === 'node_complete'
            );

            return (
              <motion.div
                key={nodeKey}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                  isCompleted
                    ? 'bg-green-900/20 border-green-800/50'
                    : isError
                    ? 'bg-red-900/20 border-red-800/50'
                    : isActive
                    ? 'bg-linkedin/10 border-linkedin/40'
                    : 'bg-navy-800/50 border-navy-700/30 opacity-50'
                }`}
              >
                {/* Status icon */}
                <div className="flex-shrink-0 w-6 h-6">
                  {isCompleted && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                      <CheckCircle className="w-6 h-6 text-green-400" />
                    </motion.div>
                  )}
                  {isError && <AlertCircle className="w-6 h-6 text-red-400" />}
                  {isActive && (
                    <Loader2 className="w-6 h-6 text-linkedin animate-spin" />
                  )}
                  {isPending && (
                    <div className="w-6 h-6 rounded-full border-2 border-navy-600" />
                  )}
                </div>

                {/* Label and stats */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm font-medium ${
                        isCompleted
                          ? 'text-green-300'
                          : isActive
                          ? 'text-white'
                          : 'text-gray-400'
                      }`}
                    >
                      {config.label}
                    </span>
                    {isActive && (
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ repeat: Infinity, duration: 1.5 }}
                        className="text-xs text-linkedin"
                      >
                        Processing...
                      </motion.span>
                    )}
                  </div>

                  {/* Data points badge */}
                  {isCompleted && event && event.data_points > 0 && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-xs text-gray-400 mt-0.5 block"
                    >
                      {nodeKey === 'extract_profiles_node'
                        ? `${event.data_points} skills extracted`
                        : nodeKey === 'fetch_sources_node'
                        ? `${Math.round(event.data_points / 1000)}KB profile data`
                        : `${event.data_points} data points`}
                      {event.duration_ms > 0 && (
                        <span className="ml-2 text-gray-500">
                          ({(event.duration_ms / 1000).toFixed(1)}s)
                        </span>
                      )}
                    </motion.span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Partial data preview */}
      {progress.partialData?.name && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-navy-800 border border-navy-700 rounded-lg p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-linkedin" />
            <span className="text-xs text-linkedin font-medium uppercase tracking-wide">
              Profile Detected
            </span>
          </div>
          <div className="text-white font-semibold">
            {progress.partialData.name}
          </div>
          {progress.partialData.title && (
            <div className="text-gray-400 text-sm">{progress.partialData.title}</div>
          )}
          {progress.partialData.company && (
            <div className="text-gray-500 text-sm">{progress.partialData.company}</div>
          )}
          {progress.partialData.skills_count > 0 && (
            <div className="text-gray-500 text-xs mt-1">
              {progress.partialData.skills_count} skills identified
            </div>
          )}
          {progress.partialData.score > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-3 flex items-center gap-2"
            >
              <span className="text-xs text-gray-400">Score:</span>
              <span className="text-2xl font-bold text-linkedin">
                {progress.partialData.score}
              </span>
            </motion.div>
          )}
        </motion.div>
      )}

      {/* Elapsed timer */}
      <div className="text-center text-xs text-gray-500 font-mono">
        {elapsedSec > 0 ? `${elapsedSec}s elapsed` : 'Starting...'}
      </div>
    </div>
  );
}
