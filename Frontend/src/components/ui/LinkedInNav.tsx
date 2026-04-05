import React from 'react';
import { UserCircle } from 'lucide-react';
import { LiveCounter } from './LiveCounter';
import { ThemeToggle } from './ThemeToggle';
import upchangeLogo from '../../assets/upchange-logo.png';
export function LinkedInNav() {
  return (
    <nav className="sticky top-0 z-50 w-full bg-dark-bg border-b border-dark-border h-14 px-4 md:px-6 lg:px-8 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <img src={upchangeLogo} alt="UpChange" className="h-7 w-auto logo-themed" />
          <span className="text-lg font-semibold text-dark-textPri hidden md:block">
            AI Resilience Score™
          </span>
        </div>
        <LiveCounter />
      </div>

      <div className="flex items-center gap-4">
        <ThemeToggle />
        <div className="flex flex-col items-center cursor-pointer opacity-60 hover:opacity-100 transition-opacity">
          <UserCircle className="w-6 h-6 text-dark-textSec" />
          <span className="text-[10px] text-dark-textSec hidden md:block">Me</span>
        </div>
      </div>
    </nav>);

}