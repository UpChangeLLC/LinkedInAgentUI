import React from 'react';
import { UserCircle } from 'lucide-react';
import { LiveCounter } from './LiveCounter';
export function LinkedInNav() {
  return (
    <nav className="sticky top-0 z-50 w-full bg-white border-b border-gray-200 h-14 px-4 md:px-6 lg:px-8 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 bg-[#0A66C2] rounded-[4px]">
            <span className="text-white font-bold text-xl pb-1">in</span>
          </div>
          <span className="text-lg font-semibold text-gray-700 hidden md:block">
            AI Resilience Score™
          </span>
        </div>
        <LiveCounter />
      </div>

      <div className="flex items-center gap-4">
        <div className="flex flex-col items-center cursor-pointer opacity-60 hover:opacity-100 transition-opacity">
          <UserCircle className="w-6 h-6 text-gray-600" />
          <span className="text-[10px] text-gray-600 hidden md:block">Me</span>
        </div>
      </div>
    </nav>);

}