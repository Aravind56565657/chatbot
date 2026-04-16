import React from 'react';
import { motion } from 'framer-motion';

const MessageBubble = ({ message, isBot }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className={`flex ${isBot ? 'justify-start' : 'justify-end'} mb-6 group`}
    >
      <div
        className={`max-w-[85%] px-6 py-4 rounded-[24px] relative shadow-2xl ${
          isBot
            ? 'bg-white border border-slate-200 text-slate-700 rounded-bl-none shadow-[0_10px_25px_rgba(15,23,42,0.06)]'
            : 'bg-blue-gradient text-white rounded-br-none blue-glow'
        }`}
      >
        <p className="text-sm font-medium leading-relaxed tracking-wide whitespace-pre-wrap">{message}</p>
        <span className={`absolute bottom-[-18px] text-[10px] uppercase tracking-widest font-extrabold text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity ${isBot ? 'left-2' : 'right-2'}`}>
            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </motion.div>
  );
};

export default MessageBubble;
