import React from 'react';
import { motion } from 'framer-motion';
import { Ban } from 'lucide-react';

const AppointmentNotFoundCard = ({ variant, bookingId, onTryAgain, onSearchByPhone }) => {
  const isBookingIdVariant = variant === 'bookingId';

  const message = isBookingIdVariant
    ? "I couldn't find any appointment with that ID.\nPlease double-check and try again."
    : "No active appointments found for this number.";

  const tryLabel = isBookingIdVariant ? '🔁 Try Again' : '🔁 Try Again';
  const secondLabel = isBookingIdVariant ? '📞 Search by Phone Instead' : '📅 Book New Appointment';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25 }}
      className="glass-card p-6 rounded-3xl border border-white/5 text-center space-y-3 max-w-[360px] mt-4"
    >
      <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
        <Ban className="w-8 h-8 text-red-400/50" />
      </div>

      <h3 className="text-white font-bold tracking-tight">
        {isBookingIdVariant ? 'APPOINTMENT NOT FOUND' : 'NO APPOINTMENTS FOUND'}
      </h3>
      <p className="text-xs text-gray-500 whitespace-pre-wrap">{message}</p>

      <div className="grid grid-cols-2 gap-2 pt-2">
        <button
          onClick={onTryAgain}
          className="py-3 bg-white/5 text-gray-400 text-[10px] font-bold uppercase tracking-widest border border-white/5 hover:bg-white/10 rounded-xl transition-all"
        >
          {tryLabel}
        </button>
        <button
          onClick={onSearchByPhone}
          className="py-3 bg-blue-gradient text-white text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all"
        >
          {secondLabel}
        </button>
      </div>
    </motion.div>
  );
};

export default AppointmentNotFoundCard;

