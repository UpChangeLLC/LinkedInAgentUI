import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle } from 'lucide-react';
interface AnalyzingPageProps {
  onComplete: () => void;
}
export function AnalyzingPage({ onComplete }: AnalyzingPageProps) {
  const [phase, setPhase] = useState(0);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  useEffect(() => {
    const phases = [
    {
      duration: 3000,
      endProgress: 15
    },
    {
      duration: 3000,
      endProgress: 40
    },
    {
      duration: 3000,
      endProgress: 65
    },
    {
      duration: 2500,
      endProgress: 80
    },
    {
      duration: 2500,
      endProgress: 95
    },
    {
      duration: 1500,
      endProgress: 100
    }];

    let currentPhase = 0;
    let startTime = Date.now();
    let cancelled = false;
    const updateProgress = () => {
      if (cancelled) return;
      const now = Date.now();
      const phaseConfig = phases[currentPhase];
      if (!phaseConfig) {
        setProgress(100);
        setPhase(5); // Keep at last valid phase
        setDone(true);
        return;
      }
      const phaseElapsed = now - startTime;
      const phaseProgress = Math.min(phaseElapsed / phaseConfig.duration, 1);
      const prevEndProgress =
      currentPhase === 0 ? 0 : phases[currentPhase - 1].endProgress;
      const currentGlobalProgress =
      prevEndProgress +
      phaseProgress * (phaseConfig.endProgress - prevEndProgress);
      setProgress(currentGlobalProgress);
      if (phaseProgress >= 1) {
        currentPhase++;
        if (currentPhase < phases.length) {
          setPhase(currentPhase);
          startTime = Date.now();
          requestAnimationFrame(updateProgress);
        } else {
          setProgress(100);
          setPhase(5);
          setDone(true);
        }
      } else {
        requestAnimationFrame(updateProgress);
      }
    };
    requestAnimationFrame(updateProgress);
    return () => {
      cancelled = true;
    };
  }, []);
  // Note: We no longer auto-navigate on completion here.
  // Navigation to results occurs when the backend response arrives
  // and the app state updates currentPage to 'results'.
  const phaseTitles = [
  'Scanning LinkedIn Profile',
  'Analyzing Industry Disruption',
  'Mapping Workflow Vulnerability',
  'Computing Governance Risk',
  'Generating Executive Roadmap',
  'Finalizing Report'];

  const renderPhaseContent = () => {
    switch (phase) {
      case 0:
        return (
          <div className="space-y-4 font-mono text-sm md:text-base text-left max-w-md mx-auto">
            <TypewriterLine text="Fetching LinkedIn profile data..." delay={0} />
            <TypewriterLine text="Extracting role and experience..." delay={0.5} />
            <TypewriterLine text="Identifying industry context..." delay={1} />
            <TypewriterLine text="Mapping skills and endorsements..." delay={1.5} />
            <TypewriterLine text="Profile data loaded successfully" delay={2} />
          </div>);

      case 1:
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
            <MetricCard label="Industry AI Adoption" value="Analyzing..." delay={0} />
            <MetricCard label="Competitor Landscape" value="Scanning..." delay={0.2} />
            <MetricCard label="Market Disruption Level" value="Computing..." delay={0.4} />
            <MetricCard label="Automation Exposure" value="Assessing..." delay={0.6} />
          </div>);

      case 2:
        return (
          <div className="space-y-4 max-w-lg mx-auto">
            <WorkflowBar
              label="Strategic Reporting"
              percentage={78}
              delay={0} />
            
            <WorkflowBar label="Market Analysis" percentage={65} delay={0.2} />
            <WorkflowBar
              label="Team Communications"
              percentage={42}
              delay={0.4} />
            
            <WorkflowBar
              label="Budget Forecasting"
              percentage={71}
              delay={0.6} />
            
          </div>);

      case 3:
        return (
          <div className="space-y-3 max-w-md mx-auto">
            <GovernanceCheck
              label="Data Privacy Compliance"
              status="warning"
              delay={0} />
            
            <GovernanceCheck
              label="AI Usage Policy"
              status="danger"
              delay={0.4} />
            
            <GovernanceCheck
              label="Vendor Risk Framework"
              status="warning"
              delay={0.8} />
            
            <GovernanceCheck
              label="Bias Monitoring"
              status="danger"
              delay={1.2} />
            
          </div>);

      case 4:
        return (
          <div className="text-center space-y-6">
            <div className="flex justify-center space-x-2">
              {[1, 2, 3, 4].map((i) =>
              <motion.div
                key={i}
                initial={{
                  height: 0
                }}
                animate={{
                  height: 40 + Math.random() * 40
                }}
                transition={{
                  duration: 0.5,
                  delay: i * 0.2
                }}
                className="w-8 bg-linkedin rounded-t-md" />

              )}
            </div>
            <p className="text-xl text-gray-300">
              Calibrating recommendations...
            </p>
            <p className="text-sm text-gray-500">
              Cross-referencing executive benchmarks
            </p>
          </div>);

      case 5:
        return (
          <div className="text-center">
            <motion.div
              initial={{
                scale: 0.8,
                opacity: 0
              }}
              animate={{
                scale: 1,
                opacity: 1
              }}
              className="text-4xl font-bold text-white mb-4">
              
              Your AI Resilience Score™ is ready
            </motion.div>
          </div>);

      default:
        return null;
    }
  };
  return (
    <div className="min-h-screen bg-navy-900 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Particles */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(20)].map((_, i) =>
        <motion.div
          key={i}
          className="absolute w-1 h-1 bg-linkedin/30 rounded-full"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`
          }}
          animate={{
            y: [0, Math.random() * -100],
            opacity: [0, 1, 0]
          }}
          transition={{
            duration: 2 + Math.random() * 3,
            repeat: Infinity,
            ease: 'linear'
          }} />

        )}
      </div>

      <div className="w-full max-w-3xl z-10">
        <div className="text-center mb-12">
          <h2 className="text-linkedin-light font-mono text-sm mb-2 uppercase tracking-widest">
            Phase {Math.min(phase + 1, 6)}/6
          </h2>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-8">
            {phaseTitles[Math.min(phase, 5)]}
          </h1>
        </div>

        <div className="min-h-[300px] flex items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={phase}
              initial={{
                opacity: 0,
                y: 20
              }}
              animate={{
                opacity: 1,
                y: 0
              }}
              exit={{
                opacity: 0,
                y: -20
              }}
              transition={{
                duration: 0.3
              }}
              className="w-full">
              
              {renderPhaseContent()}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-12 max-w-xl mx-auto">
          <div className="flex justify-between text-xs text-gray-400 mb-2 font-mono">
            <span>System Status: ONLINE</span>
            <span>{Math.round(progress)}% Complete</span>
          </div>
          <div className="h-1 w-full bg-navy-800 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-linkedin"
              style={{
                width: `${progress}%`
              }} />
            
          </div>
        </div>
      </div>
    </div>);

}
function TypewriterLine({ text, delay }: {text: string;delay: number;}) {
  return (
    <motion.div
      initial={{
        opacity: 0,
        x: -10
      }}
      animate={{
        opacity: 1,
        x: 0
      }}
      transition={{
        delay
      }}
      className="flex items-center text-green-400">
      
      <CheckCircle className="w-4 h-4 mr-3 flex-shrink-0" />
      <span>{text}</span>
    </motion.div>);

}
function MetricCard({
  label,
  value,
  delay




}: {label: string;value: string;delay: number;}) {
  return (
    <motion.div
      initial={{
        opacity: 0,
        scale: 0.9
      }}
      animate={{
        opacity: 1,
        scale: 1
      }}
      transition={{
        delay
      }}
      className="bg-navy-800 border border-navy-700 p-4 rounded-lg flex justify-between items-center">
      
      <span className="text-gray-400 text-sm">{label}</span>
      <span className="text-white font-bold text-lg">{value}</span>
    </motion.div>);

}
function WorkflowBar({
  label,
  percentage,
  delay




}: {label: string;percentage: number;delay: number;}) {
  return (
    <motion.div
      initial={{
        opacity: 0
      }}
      animate={{
        opacity: 1
      }}
      transition={{
        delay
      }}
      className="space-y-1">
      
      <div className="flex justify-between text-sm">
        <span className="text-gray-300">{label}</span>
        <span className="text-red-400">{percentage}% Automatable</span>
      </div>
      <div className="h-2 bg-navy-800 rounded-full overflow-hidden">
        <motion.div
          initial={{
            width: 0
          }}
          animate={{
            width: `${percentage}%`
          }}
          transition={{
            delay: delay + 0.2,
            duration: 1
          }}
          className="h-full bg-gradient-to-r from-linkedin to-red-500" />
        
      </div>
    </motion.div>);

}
function GovernanceCheck({
  label,
  status,
  delay




}: {label: string;status: 'warning' | 'danger';delay: number;}) {
  return (
    <motion.div
      initial={{
        opacity: 0,
        x: 20
      }}
      animate={{
        opacity: 1,
        x: 0
      }}
      transition={{
        delay
      }}
      className="flex items-center justify-between bg-navy-800/50 p-3 rounded border border-navy-700">
      
      <span className="text-gray-300">{label}</span>
      <span
        className={`text-xs font-bold px-2 py-1 rounded ${status === 'warning' ? 'bg-yellow-900/50 text-yellow-500' : 'bg-red-900/50 text-red-500'}`}>
        
        {status === 'warning' ? 'PARTIAL' : 'MISSING'}
      </span>
    </motion.div>);

}