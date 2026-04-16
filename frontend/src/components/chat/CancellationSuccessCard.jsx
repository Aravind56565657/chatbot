import React from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';

const CancellationSuccessCard = ({ bookingId, onBookNew, onMainMenu }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="glass-card p-5 rounded-[28px] border border-white/10 shadow-2xl relative overflow-hidden my-4 max-w-[380px] text-center"
    >
      <motion.div
        animate={{ rotate: [0, 10, -10, 0] }}
        transition={{ duration: 0.8, repeat: 1 }}
        className="mx-auto w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center"
      >
        <X className="w-10 h-10 text-red-400" />
      </motion.div>

      <h3 className="mt-3 text-xl font-black text-white tracking-tight">❌ Appointment Cancelled</h3>

      <p className="mt-2 text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">
        Your appointment {bookingId} has been successfully cancelled.
      </p>

      <p className="mt-3 text-xs text-gray-400 font-bold uppercase tracking-widest leading-relaxed">
        Need to rebook? We're here to help.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-2">
        <button
          onClick={onBookNew}
          className="w-full py-3 bg-blue-gradient text-white text-[10px] font-bold rounded-xl transition-all active:scale-[0.99]"
        >
          📅 Book New Appointment
        </button>
        <button
          onClick={onMainMenu}
          className="w-full py-3 bg-white/5 text-gray-400 text-[10px] font-bold rounded-xl border border-white/5 hover:bg-white/10 transition-all"
        >
          🔙 Main Menu
        </button>
      </div>
    </motion.div>
  );
};

export default CancellationSuccessCard;

