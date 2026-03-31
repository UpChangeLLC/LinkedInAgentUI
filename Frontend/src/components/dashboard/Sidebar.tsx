import React from 'react';
import {
  LayoutDashboard,
  Zap,
  Layers,
  Shield,
  Calendar,
  ArrowRight,
  User,
  Share2 } from
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
}
export function Sidebar({
  activeSection,
  onNavigate,
  isOpen,
  onClose,
  view,
  onViewChange,
  results
}: SidebarProps) {
  const personalItems = [
  {
    id: 'overview',
    label: 'Personal Overview',
    icon: User
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
          'fixed top-0 left-0 h-full w-64 bg-white border-r border-gray-200 z-50 transition-transform duration-300 lg:translate-x-0 lg:static flex flex-col',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}>
        
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-xl font-bold text-linkedin">
            AI Resilience
            <br />
            <span className="text-gray-700 font-light">Score™</span>
          </h1>
        </div>

        {/* Profile Summary */}
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 font-bold">
              {results.personalProfile.photoPlaceholder}
            </div>
            <div className="overflow-hidden">
              <p className="font-bold text-gray-900 truncate">
                {results.personalProfile.name}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {results.personalProfile.title}
              </p>
            </div>
          </div>

          {/* View Toggle */}
          <div className="flex bg-gray-200 p-1 rounded-lg">
            <button
              onClick={() => onViewChange('personal')}
              className={clsx(
                'flex-1 py-1.5 text-xs font-medium rounded-md transition-all',
                view === 'personal' ?
                'bg-white text-linkedin shadow-sm' :
                'text-gray-600 hover:text-gray-900'
              )}>
              
              Personal
            </button>
            <button
              onClick={() => onViewChange('corporate')}
              className={clsx(
                'flex-1 py-1.5 text-xs font-medium rounded-md transition-all',
                view === 'corporate' ?
                'bg-white text-linkedin shadow-sm' :
                'text-gray-600 hover:text-gray-900'
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
              'bg-linkedin/10 text-linkedin border-l-4 border-linkedin' :
              'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            )}>
            
              <item.icon
              className={clsx(
                'w-5 h-5 mr-3',
                activeSection === item.id ? 'text-linkedin' : 'text-gray-400'
              )} />
            
              {item.label}
            </button>
          )}
        </nav>

        <div className="p-4 border-t border-gray-200">
          <div className="text-xs text-center text-gray-400">
            Powered by AI Resilience Score™
          </div>
        </div>
      </aside>
    </>);

}