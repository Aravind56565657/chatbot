import React from 'react';
import { motion } from 'framer-motion';

const TypingIndicator = () => {
  return (
    <div className="flex justify-start mb-4">
      <div className="glass-card p-4 rounded-2xl border border-slate-200 bg-white">
        <div className="flex space-x-1">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ repeat: Infinity, duration: 1.5, delay: i * 0.2 }}
              className="w-2 h-2 bg-blue-500 rounded-full"
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default TypingIndicator;
