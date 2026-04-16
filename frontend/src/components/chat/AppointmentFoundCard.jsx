import React from 'react';
import { motion } from 'framer-motion';
import { Calendar, Clock, User, Phone, Hash } from 'lucide-react';

const statusBadgeClasses = (status) => {
  switch ((status || '').toLowerCase()) {
    case 'confirmed':
      return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'pending':
      return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    case 'cancelled':
      return 'bg-red-500/20 text-red-400 border-red-500/30';
    case 'rescheduled':
      return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
    case 'completed':
      return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    default:
      return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  }
};

const AppointmentFoundCard = ({ appointment, mode, onPrimaryAction, onGoBack }) => {
  if (!appointment) return null;

  const status = (appointment.status || '').toString();
  const dateLabel = appointment.date ? new Date(appointment.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : '—';
  const timeLabel = appointment.timeSlot || '—';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="glass-card p-4 rounded-[28px] border border-white/10 shadow-2xl relative overflow-hidden my-4 max-w-[360px]"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <div className="w-10 h-10 bg-blue-500/10 rounded-2xl flex items-center justify-center">
            <Hash className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h3 className="text-xs font-black text-white uppercase tracking-[0.2em]">APPOINTMENT FOUND</h3>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">
              {appointment.bookingId}
            </p>
          </div>
        </div>

        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${statusBadgeClasses(status)}`}>
          {status ? status.charAt(0).toUpperCase() + status.slice(1) : '—'}
        </span>
      </div>

      <div className="bg-white/[0.03] rounded-2xl p-4 border border-white/5">
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <div className="flex items-center space-x-2">
            <span className="text-base">🔖</span>
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Booking ID</span>
          </div>
          <div className="text-[11px] font-bold text-white text-right">{appointment.bookingId}</div>

          <div className="flex items-center space-x-2">
            <span className="text-base">🏥</span>
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Service</span>
          </div>
          <div className="text-[11px] font-bold text-white text-right">{appointment.serviceCategory || '—'}</div>

          <div className="flex items-center space-x-2">
            <span className="text-base">👨‍⚕️</span>
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Doctor</span>
          </div>
          <div className="text-[11px] font-bold text-white text-right">{appointment.doctorName || '—'}</div>

          <div className="flex items-center space-x-2">
            <span className="text-base">📅</span>
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Date & Time</span>
          </div>
          <div className="text-[11px] font-bold text-white text-right">
            {dateLabel} · {timeLabel}
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-base">👤</span>
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Name</span>
          </div>
          <div className="text-[11px] font-bold text-white text-right">{appointment.userName || 'Guest'}</div>

          <div className="flex items-center space-x-2">
            <span className="text-base">📞</span>
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Phone</span>
          </div>
          <div className="text-[11px] font-bold text-white text-right">{appointment.userPhone || '—'}</div>

          <div className="flex items-center space-x-2">
            <span className="text-base">🔴</span>
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Status</span>
          </div>
          <div className="text-[11px] font-bold text-white text-right">
            {status ? status.charAt(0).toUpperCase() + status.slice(1) : '—'}
          </div>
        </div>
      </div>

      <div className="mt-4">
        {mode === 'cancel' ? (
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onPrimaryAction}
              className="py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[10px] font-bold uppercase tracking-widest border border-red-500/10 rounded-xl transition-all"
            >
              ❌ Cancel This Appointment
            </button>
            <button
              onClick={onGoBack}
              className="py-3 bg-white/5 text-gray-400 text-[10px] font-bold uppercase tracking-widest border border-white/5 hover:bg-white/10 rounded-xl transition-all"
            >
              🔙 Go Back
            </button>
          </div>
        ) : (
          <button
            onClick={onPrimaryAction}
            className="w-full py-3 bg-blue-gradient text-white text-[10px] font-bold uppercase tracking-widest rounded-xl shadow-lg hover:shadow-blue-500/20 active:scale-95 transition-all"
          >
            🔄 Reschedule This Appointment
          </button>
        )}
      </div>
    </motion.div>
  );
};

export default AppointmentFoundCard;

