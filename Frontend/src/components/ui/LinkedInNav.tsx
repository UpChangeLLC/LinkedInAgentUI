import React from 'react';
import { UserCircle } from 'lucide-react';
import { LiveCounter } from './LiveCounter';
import { ThemeToggle } from './ThemeToggle';
import upchangeLogo from '../../assets/upchange-logo.png';
export function LinkedInNav() {
  return (
    <nav className="sticky top-0 z-50 w-full bg-dark-bg border-b border-dark-border h-14 px-4 md:px-6 lg:px-8 grid grid-cols-3 items-center">
      <div className="flex items-center">
        <img src={upchangeLogo} alt="UpChange" className="h-7 w-auto logo-themed" />
      </div>

      <div className="flex items-center justify-center gap-3">
        <span className="text-lg font-semibold text-dark-textPri hidden md:block whitespace-nowrap">
          AI Resilience Score™
        </span>
        <LiveCounter />
      </div>

      <div className="flex items-center justify-end gap-4">
        <ThemeToggle />
        <div className="flex flex-col items-center cursor-pointer opacity-60 hover:opacity-100 transition-opacity">
          <UserCircle className="w-6 h-6 text-dark-textSec" />
          <span className="text-[10px] text-dark-textSec hidden md:block">Me</span>
        </div>
      </div>
    </nav>);

}