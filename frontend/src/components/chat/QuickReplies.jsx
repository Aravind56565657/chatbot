import React from 'react';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';

const QuickReplies = ({ options, onSelect }) => {
  if (!options || options.length === 0) return null;

  return (
    <div className="flex flex-col space-y-2 mt-4 max-w-[300px]">
      <div className="glass-card rounded-3xl overflow-hidden border border-slate-200 shadow-xl">
        {options.map((opt, index) => (
          <motion.button
            key={opt.text}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            onClick={() => onSelect(opt.text)}
            className="w-full group flex items-center justify-between p-4 bg-white hover:bg-blue-50 transition-all border-b border-slate-100 last:border-0"
          >
            <div className="flex items-center space-x-4">
              <span className="text-lg grayscale group-hover:grayscale-0 transition-all">{opt.icon || '✨'}</span>
              <span className="text-xs font-bold text-slate-700 group-hover:text-blue-700 tracking-wide">{opt.text}</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
          </motion.button>
        ))}
      </div>
      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest pl-4">Select an option above to proceed</p>
    </div>
  );
};

export default QuickReplies;
