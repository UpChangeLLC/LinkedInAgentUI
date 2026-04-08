import React, { useState } from 'react';
import { User, Grid3X3, ListChecks, Share2, MoreHorizontal, X } from 'lucide-react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';

interface BottomTabBarProps {
  activeSection: string;
  onNavigate: (section: string) => void;
}

const PRIMARY_TABS = [
  { id: 'overview', label: 'Overview', icon: User },
  { id: 'skills', label: 'Skills', icon: Grid3X3 },
  { id: 'actions', label: 'Actions', icon: ListChecks },
  { id: 'share', label: 'Share', icon: Share2 },
];

const MORE_SECTIONS = [
  { id: 'disruption', label: 'Disruption Timeline' },
  { id: 'pathways', label: 'Career Pathways' },
  { id: 'whatif', label: 'What-If Simulator' },
  { id: 'roadmap', label: 'Career Roadmap' },
  { id: 'newsfeed', label: 'AI News Feed' },
  { id: 'learning', label: 'Learning Resources' },
  { id: 'next', label: 'Next Steps' },
];

export const BottomTabBar = React.memo(function BottomTabBar({
  activeSection,
  onNavigate,
}: BottomTabBarProps) {
  const [showMore, setShowMore] = useState(false);

  const isMoreActive = MORE_SECTIONS.some((s) => s.id === activeSection);

  return (
    <>
      {/* More sections bottom sheet */}
      <AnimatePresence>
        {showMore && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40 lg:hidden"
              onClick={() => setShowMore(false)}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-dark-card border-t border-dark-border rounded-t-2xl pb-20 lg:hidden"
            >
              <div className="flex items-center justify-between p-4 border-b border-dark-border">
                <h3 className="text-sm font-semibold text-dark-textPri">More Sections</h3>
                <button
                  onClick={() => setShowMore(false)}
                  className="p-1 text-dark-textMuted hover:text-dark-textPri"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-2 space-y-1 max-h-[50vh] overflow-y-auto">
                {MORE_SECTIONS.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => {
                      onNavigate(section.id);
                      setShowMore(false);
                    }}
                    className={clsx(
                      'w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors',
                      activeSection === section.id
                        ? 'bg-dark-accentDim text-dark-accent'
                        : 'text-dark-textSec hover:bg-dark-elevated'
                    )}
                  >
                    {section.label}
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Tab bar — mobile only */}
      <nav className="fixed bottom-0 left-0 right-0 bg-dark-sidebar border-t border-dark-border z-30 lg:hidden safe-bottom">
        <div className="flex items-center justify-around h-16">
          {PRIMARY_TABS.map((tab) => {
            const isActive = activeSection === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onNavigate(tab.id)}
                className={clsx(
                  'flex flex-col items-center justify-center gap-1 flex-1 h-full min-w-[44px] transition-colors',
                  isActive ? 'text-dark-accent' : 'text-dark-textMuted'
                )}
              >
                <tab.icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{tab.label}</span>
              </button>
            );
          })}
          <button
            onClick={() => setShowMore(!showMore)}
            className={clsx(
              'flex flex-col items-center justify-center gap-1 flex-1 h-full min-w-[44px] transition-colors',
              isMoreActive ? 'text-dark-accent' : 'text-dark-textMuted'
            )}
          >
            <MoreHorizontal className="w-5 h-5" />
            <span className="text-[10px] font-medium">More</span>
          </button>
        </div>
      </nav>
    </>
  );
});
