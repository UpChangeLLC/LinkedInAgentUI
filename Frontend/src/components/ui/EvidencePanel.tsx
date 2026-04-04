import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, FileText, Shield } from 'lucide-react';
import { SourceBadge } from './SourceBadge';
import type { EvidenceItem } from '../../data/mockResults';

interface EvidencePanelProps {
  evidence: EvidenceItem[];
  confidence?: 'high' | 'medium' | 'low';
  narrative?: string;
}

const CONFIDENCE_CONFIG = {
  high: { label: 'High Confidence', color: 'text-dark-green', bg: 'bg-dark-green/10' },
  medium: { label: 'Medium Confidence', color: 'text-dark-amber', bg: 'bg-dark-amber/10' },
  low: { label: 'Low Confidence', color: 'text-dark-red', bg: 'bg-dark-red/10' },
};

export function EvidencePanel({ evidence, confidence, narrative }: EvidencePanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const hasContent = evidence.length > 0 || narrative;

  if (!hasContent) return null;

  return (
    <div className="mt-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 text-xs text-dark-textMuted hover:text-dark-textSec transition-colors"
      >
        <FileText className="w-3 h-3" />
        <span>
          {evidence.length > 0
            ? `${evidence.length} evidence item${evidence.length > 1 ? 's' : ''}`
            : 'View details'}
        </span>
        {confidence && (
          <span className={`${CONFIDENCE_CONFIG[confidence]?.color || ''}`}>
            ({CONFIDENCE_CONFIG[confidence]?.label || confidence})
          </span>
        )}
        <ChevronDown
          className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-2 pl-3 border-l-2 border-dark-border space-y-2">
              {/* Narrative */}
              {narrative && (
                <p className="text-xs text-dark-textSec italic">{narrative}</p>
              )}

              {/* Evidence items */}
              {evidence.map((item, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-xs text-dark-textMuted mt-0.5 flex-shrink-0">
                    &bull;
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-dark-textSec">{item.text}</span>
                    <span className="ml-1.5 inline-block">
                      <SourceBadge source={item.source} size="sm" />
                    </span>
                  </div>
                </div>
              ))}

              {/* Confidence badge */}
              {confidence && (
                <div className="flex items-center gap-1.5 pt-1">
                  <Shield className="w-3 h-3 text-dark-textMuted" />
                  <span
                    className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                      CONFIDENCE_CONFIG[confidence]?.bg || ''
                    } ${CONFIDENCE_CONFIG[confidence]?.color || ''}`}
                  >
                    {CONFIDENCE_CONFIG[confidence]?.label || confidence}
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
