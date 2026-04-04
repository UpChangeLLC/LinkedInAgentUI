import React from 'react';
import {
  LayoutDashboard,
  Zap,
  Layers,
  Shield,
  Calendar,
  ArrowRight,
  User,
  Share2,
  Grid3X3,
  Clock,
  ListChecks,
  Newspaper,
  BookOpen,
  Calculator,
  Home } from
'lucide-react';
import { clsx } from 'clsx';
import { MockResults } from '../../data/mockResults';
interface SidebarProps {
  activeSection: string;
  onNavigate: (section: string) => void;
  isOpen: boolean;
  onClose: () => void;
  view: 'personal' | 'corporate';
  onViewChange: (view: 'personal' | 'corporate') => void;
  results: MockResults;
  onBackToHome?: () => void;
}
export function Sidebar({
  activeSection,
  onNavigate,
  isOpen,
  onClose,
  view,
  onViewChange,
  results,
  onBackToHome
}: SidebarProps) {
  const personalItems = [
  {
    id: 'overview',
    label: 'Personal Overview',
    icon: User
  },
  {
    id: 'skills',
    label: 'Skill Gap Matrix',
    icon: Grid3X3
  },
  {
    id: 'disruption',
    label: 'Disruption Timeline',
    icon: Clock
  },
  {
    id: 'pathways',
    label: 'Career Pathways',
    icon: ArrowRight
  },
  {
    id: 'whatif',
    label: 'What-If Simulator',
    icon: Zap
  },
  {
    id: 'actions',
    label: 'Action Tracker',
    icon: ListChecks
  },
  {
    id: 'share',
    label: 'Share & Compare',
    icon: Share2
  },
  {
    id: 'roadmap',
    label: 'Career Roadmap',
    icon: Calendar
  },
  {
    id: 'newsfeed',
    label: 'AI News Feed',
    icon: Newspaper
  },
  {
    id: 'learning',
    label: 'Learning Resources',
    icon: BookOpen
  },
  {
    id: 'next',
    label: 'Next Steps',
    icon: ArrowRight
  }];

  const corporateItems = [
  {
    id: 'overview',
    label: 'Corporate Overview',
    icon: LayoutDashboard
  },
  {
    id: 'workflow',
    label: 'Workflow Impact',
    icon: Zap
  },
  {
    id: 'leverage',
    label: 'Leverage Plays',
    icon: Layers
  },
  {
    id: 'governance',
    label: 'Governance',
    icon: Shield
  },
  {
    id: 'plan',
    label: '30-Day Plan',
    icon: Calendar
  },
  {
    id: 'roi',
    label: 'ROI Calculator',
    icon: Calculator
  },
  {
    id: 'next',
    label: 'Next Steps',
    icon: ArrowRight
  }];

  const menuItems = view === 'personal' ? personalItems : corporateItems;
  return (
    <>
      {/* Mobile Overlay */}
      {isOpen &&
      <div
        className="fixed inset-0 bg-black/50 z-40 lg:hidden"
        onClick={onClose} />

      }

      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed top-0 left-0 h-full w-64 bg-dark-bg border-r border-dark-border z-50 transition-transform duration-300 lg:translate-x-0 lg:static flex flex-col',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}>

        <div className="p-6 border-b border-dark-border">
          <h1 className="text-xl font-bold text-dark-accent">
            AI Resilience
            <br />
            <span className="text-dark-textSec font-light">Score™</span>
          </h1>
        </div>

        {/* Profile Summary */}
        <div className="p-4 border-b border-dark-border bg-dark-card">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-dark-elevated flex items-center justify-center text-dark-textSec font-bold">
              {results.personalProfile.photoPlaceholder}
            </div>
            <div className="overflow-hidden">
              <p className="font-bold text-dark-textPri truncate">
                {results.personalProfile.name}
              </p>
              <p className="text-xs text-dark-textMuted truncate">
                {results.personalProfile.title}
              </p>
            </div>
          </div>

          {/* View Toggle */}
          <div className="flex bg-dark-elevated p-1 rounded-lg">
            <button
              onClick={() => onViewChange('personal')}
              className={clsx(
                'flex-1 py-1.5 text-xs font-medium rounded-md transition-all',
                view === 'personal' ?
                'bg-dark-accentDim text-dark-accent' :
                'text-dark-textMuted hover:text-dark-textSec'
              )}>

              Personal
            </button>
            <button
              onClick={() => onViewChange('corporate')}
              className={clsx(
                'flex-1 py-1.5 text-xs font-medium rounded-md transition-all',
                view === 'corporate' ?
                'bg-dark-accentDim text-dark-accent' :
                'text-dark-textMuted hover:text-dark-textSec'
              )}>

              Corporate
            </button>
          </div>
        </div>

        <nav className="p-4 space-y-1 flex-1 overflow-y-auto">
          {menuItems.map((item) =>
          <button
            key={item.id}
            onClick={() => {
              onNavigate(item.id);
              onClose();
            }}
            className={clsx(
              'w-full flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-colors',
              activeSection === item.id ?
              'bg-dark-accentDim text-dark-accent border-l-4 border-dark-accent' :
              'text-dark-textSec hover:bg-dark-elevated hover:text-dark-textPri'
            )}>

              <item.icon
              className={clsx(
                'w-5 h-5 mr-3',
                activeSection === item.id ? 'text-dark-accent' : 'text-dark-textMuted'
              )} />

              {item.label}
            </button>
          )}
        </nav>

        <div className="p-4 border-t border-dark-border space-y-3">
          {onBackToHome && (
            <button
              onClick={onBackToHome}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-dark-textSec hover:text-dark-accent hover:bg-dark-accentDim transition-colors border border-dark-border"
            >
              <Home className="w-4 h-4" />
              Back to Home
            </button>
          )}
          <div className="text-xs text-center text-dark-textMuted">
            Powered by AI Resilience Score™
          </div>
        </div>
      </aside>
    </>);

}