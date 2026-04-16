import React from 'react';
import { motion } from 'framer-motion';
import { RotateCcw } from 'lucide-react';

const RescheduleConfirmCard = ({ oldData, newData, onConfirm, onCancel, isSuccess }) => {
  const formatTimeSlot = (t) => {
    const s = String(t || '').trim();
    if (!s) return '—';
    const normalized = s.replace(/\s+/g, '');
    const upper = normalized.toUpperCase();
    if (upper.endsWith('AM') || upper.endsWith('PM')) {
      return `${upper.slice(0, -2)} ${upper.slice(-2)}`;
    }
    return s;
  };
    
    if (isSuccess) {
        return (
            <motion.div 
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="glass-card p-6 rounded-3xl border border-blue-500/20 text-center space-y-4 shadow-[0_0_50px_rgba(59,130,246,0.1)]"
            >
        <motion.div
          animate={{ rotate: [0, 30, -30, 0] }}
          transition={{ duration: 0.9, repeat: 1 }}
          className="mx-auto w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center blue-glow"
        >
          <RotateCcw className="w-10 h-10 text-blue-400" />
        </motion.div>

        <h3 className="text-xl font-black text-white tracking-tight">Appointment Rescheduled!</h3>
        <p className="text-xs text-blue-400 font-bold uppercase tracking-widest">Your new appointment has been secured.</p>

        <div className="bg-white/5 rounded-2xl p-4 border border-white/5 space-y-2 text-left">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">OLD</span>
            <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest">
              {oldData?.bookingId} to RESCHEDULED
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">NEW CONFIRMATION ID</span>
            <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">{newData?.bookingId}</span>
          </div>
        </div>

        <p className="text-xs text-gray-400 leading-relaxed">
          See you on{' '}
          <span className="text-white font-bold">
            {newData?.date ? new Date(newData.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : '—'}
          </span>{' '}
          at <span className="text-white font-bold">{formatTimeSlot(newData?.timeSlot)}</span>!
        </p>
            </motion.div>
        );
    }

  const oldDateLabel = oldData?.date ? new Date(oldData.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : '—';
  const newDateLabel = newData?.date ? new Date(newData.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : '—';

    return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="glass-card p-5 rounded-[28px] border border-white/10 shadow-2xl relative overflow-hidden my-4 max-w-[360px]"
    >
      <h3 className="text-xs font-black text-white uppercase tracking-[0.2em] mb-3">
        RESCHEDULE CONFIRMATION
      </h3>

      <div className="bg-white/[0.03] rounded-2xl p-4 border border-white/5">
        <div className="grid grid-cols-[1fr_1.3fr] gap-x-4 gap-y-3">
          <div className="flex items-center space-x-2">
            <span>🔖</span>
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Booking ID</span>
          </div>
          <div className="text-[11px] font-bold text-white text-right">{oldData?.bookingId}</div>

          <div className="flex items-center space-x-2">
            <span>🏥</span>
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Service</span>
          </div>
          <div className="text-[11px] font-bold text-white text-right">{oldData?.serviceCategory || oldData?.service || '—'}</div>

          <div className="flex items-center space-x-2">
            <span>👨‍⚕️</span>
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Doctor</span>
          </div>
          <div className="text-[11px] font-bold text-white text-right">{oldData?.doctorName || '—'}</div>

          <div className="flex items-center space-x-2">
            <span>❌</span>
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Old Date/Time</span>
          </div>
          <div className="text-[11px] font-bold text-white text-right">
            {oldDateLabel} · {formatTimeSlot(oldData?.timeSlot)}
          </div>

          <div className="flex items-center space-x-2">
            <span>✅</span>
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">New Date/Time</span>
          </div>
          <div className="text-[11px] font-bold text-white text-right">
            {newDateLabel} · {formatTimeSlot(newData?.timeSlot)}
          </div>

          <div className="flex items-center space-x-2">
            <span>👤</span>
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Name</span>
          </div>
          <div className="text-[11px] font-bold text-white text-right">{oldData?.userName || '—'}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-4">
        <button
          onClick={onConfirm}
          className="py-3 bg-blue-gradient text-white text-[10px] font-bold uppercase tracking-widest rounded-xl shadow-lg hover:shadow-blue-500/20 transition-all active:scale-[0.99]"
        >
          ✅ Confirm Reschedule
        </button>
        <button
          onClick={onCancel}
          className="py-3 bg-white/5 text-gray-400 text-[10px] font-bold uppercase tracking-widest border border-white/5 hover:bg-white/10 rounded-xl transition-all"
        >
          🔙 Choose Different Time
        </button>
      </div>
    </motion.div>
    );
};

export default RescheduleConfirmCard;
