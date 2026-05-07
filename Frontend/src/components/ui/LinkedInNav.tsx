import React from 'react';
import { MessageCircle, UserCircle } from 'lucide-react';
import { LiveCounter } from './LiveCounter';
import { ThemeToggle } from './ThemeToggle';
import upchangeLogo from '../../assets/upchange-logo.png';

export interface LinkedInNavProps {
  /** Shown left of the logo (e.g. back button on sub-pages). */
  leadingSlot?: React.ReactNode;
  /** Opens Career Mentor chat when provided. */
  onCareerMentor?: () => void;
}

export function LinkedInNav({ leadingSlot, onCareerMentor }: LinkedInNavProps) {
  return (
    <nav className="sticky top-0 z-50 w-full bg-dark-bg border-b border-dark-border h-14 px-4 md:px-6 lg:px-8 grid grid-cols-3 items-center">
      <div className="flex items-center min-w-0">
        {leadingSlot}
        <img src={upchangeLogo} alt="UpChange" className="h-7 w-auto logo-themed shrink-0" />
      </div>

      <div className="flex items-center justify-center gap-3">
        <span className="text-lg font-semibold text-dark-textPri hidden md:block whitespace-nowrap">
          AI Resilience Score™
        </span>
        <LiveCounter />
      </div>

      <div className="flex items-center justify-end gap-2 sm:gap-4">
        {onCareerMentor && (
          <button
            type="button"
            onClick={onCareerMentor}
            className="flex items-center gap-1.5 rounded-lg border border-dark-border bg-dark-card px-2.5 py-1.5 text-xs font-medium text-dark-textPri hover:border-dark-accent hover:text-dark-accent transition-colors"
          >
            <MessageCircle className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Career Mentor</span>
          </button>
        )}
        <ThemeToggle />
        <div className="flex flex-col items-center cursor-pointer opacity-60 hover:opacity-100 transition-opacity">
          <UserCircle className="w-6 h-6 text-dark-textSec" />
          <span className="text-[10px] text-dark-textSec hidden md:block">Me</span>
        </div>
      </div>
    </nav>);

}