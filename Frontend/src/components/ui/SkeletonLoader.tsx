import { motion } from 'framer-motion';

interface SkeletonProps {
  className?: string;
}

function Pulse({ className = '' }: SkeletonProps) {
  return (
    <motion.div
      className={`bg-gray-200 rounded animate-pulse ${className}`}
      initial={{ opacity: 0.5 }}
      animate={{ opacity: [0.5, 0.8, 0.5] }}
      transition={{ duration: 1.5, repeat: Infinity }}
    />
  );
}

export function SkeletonText({ className = '' }: SkeletonProps) {
  return <Pulse className={`h-4 ${className}`} />;
}

export function SkeletonHeading({ className = '' }: SkeletonProps) {
  return <Pulse className={`h-7 ${className}`} />;
}

export function SkeletonCircle({ className = '' }: SkeletonProps) {
  return <Pulse className={`rounded-full ${className}`} />;
}

/** Full card skeleton for dashboard sections */
export function SkeletonCard() {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-4">
      <div className="flex items-center gap-3">
        <SkeletonCircle className="w-8 h-8" />
        <SkeletonHeading className="w-48" />
      </div>
      <div className="space-y-2">
        <SkeletonText className="w-full" />
        <SkeletonText className="w-3/4" />
        <SkeletonText className="w-5/6" />
      </div>
      <div className="flex gap-2 pt-2">
        <Pulse className="h-6 w-16 rounded-full" />
        <Pulse className="h-6 w-20 rounded-full" />
        <Pulse className="h-6 w-14 rounded-full" />
      </div>
    </div>
  );
}

/** Score gauge skeleton */
export function SkeletonScoreGauge() {
  return (
    <div className="flex flex-col items-center space-y-3">
      <SkeletonCircle className="w-32 h-32" />
      <SkeletonText className="w-24" />
    </div>
  );
}

/** Section skeleton — shows 2 cards */
export function SkeletonSection() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <SkeletonCircle className="w-6 h-6" />
        <SkeletonHeading className="w-56" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  );
}

/** Results dashboard loading state with profile info */
export function SkeletonDashboard({ message }: { message?: string }) {
  return (
    <div className="space-y-8">
      {message && (
        <div className="text-center text-sm text-gray-500 animate-pulse">
          {message}
        </div>
      )}
      <div className="flex flex-col md:flex-row items-stretch gap-8">
        <div className="flex-1">
          <SkeletonCard />
        </div>
        <div className="w-full md:w-72">
          <div className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col items-center">
            <SkeletonText className="w-32 mb-4" />
            <SkeletonScoreGauge />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <SkeletonSection />
    </div>
  );
}
