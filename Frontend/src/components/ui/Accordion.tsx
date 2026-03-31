import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
interface AccordionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
}
export function Accordion({
  title,
  children,
  defaultOpen = false,
  className = ''
}: AccordionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div
      className={`border border-surface-border rounded-lg overflow-hidden bg-white ${className}`}>
      
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-surface-off transition-colors">
        
        <span className="font-semibold text-navy-900">{title}</span>
        <motion.div
          animate={{
            rotate: isOpen ? 180 : 0
          }}
          transition={{
            duration: 0.2
          }}>
          
          <ChevronDown className="w-5 h-5 text-gray-400" />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {isOpen &&
        <motion.div
          initial={{
            height: 0,
            opacity: 0
          }}
          animate={{
            height: 'auto',
            opacity: 1
          }}
          exit={{
            height: 0,
            opacity: 0
          }}
          transition={{
            duration: 0.3,
            ease: 'easeInOut'
          }}>
          
            <div className="px-6 pb-6 pt-0 text-gray-600 border-t border-surface-border/50 mt-2">
              <div className="pt-4">{children}</div>
            </div>
          </motion.div>
        }
      </AnimatePresence>
    </div>);

}