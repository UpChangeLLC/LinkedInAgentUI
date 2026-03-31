import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users } from 'lucide-react';
export function LiveCounter() {
  const [count, setCount] = useState(12405);
  useEffect(() => {
    // Simulate live updates
    const interval = setInterval(() => {
      if (Math.random() > 0.7) {
        setCount((prev) => prev + Math.floor(Math.random() * 3) + 1);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, []);
  return (
    <div className="hidden md:flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200">
      <div className="relative">
        <Users className="w-4 h-4 text-gray-500" />
        <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full border-2 border-white animate-pulse"></span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-sm font-bold text-gray-900 tabular-nums">
          {count.toLocaleString()}
        </span>
        <span className="text-xs text-gray-500 font-medium">
          execs analyzed
        </span>
      </div>
    </div>);

}