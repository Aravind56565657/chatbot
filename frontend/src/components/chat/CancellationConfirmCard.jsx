import React from 'react';
import { motion } from 'framer-motion';
import { Calendar, Phone, User, XCircle } from 'lucide-react';

const CancellationConfirmCard = ({ appointment, onConfirm, onKeep, variant = 'default' }) => {
  if (!appointment) return null;

  const bookingId = appointment.bookingId;
  const isMyBookings = variant === 'myBookings';

  const question = isMyBookings
    ? `Are you sure you want to cancel ${bookingId}?`
    : 'Are you sure you want to cancel this appointment? This cannot be undone.';

  const confirmLabel = isMyBookings ? '✅ Yes Cancel' : '✅ Yes, Cancel It';
  const keepLabel = isMyBookings ? '🔙 Keep It' : '🔙 Keep Appointment';
  const dateLabel = appointment.date
    ? new Date(appointment.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
    : '—';
  const timeLabel = appointment.timeSlot || '—';

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="glass-card p-5 rounded-[28px] border border-slate-200 shadow-2xl relative overflow-hidden my-4 max-w-[380px] bg-white"
    >
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center border border-red-100">
          <XCircle className="w-7 h-7 text-red-500" />
        </div>
        <div className="text-right flex-1">
          <h3 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em]">Cancel Confirmation</h3>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">
            Booking {appointment.bookingId}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 space-y-3 mb-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-slate-900">{appointment.serviceCategory || appointment.service || 'Appointment'}</p>
            <p className="text-[11px] text-slate-500">{appointment.doctorName || 'Assigned specialist'}</p>
          </div>
          <span className="rounded-full bg-red-50 border border-red-200 px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest text-red-500">
            Cannot be undone
          </span>
        </div>

        <div className="grid grid-cols-1 gap-2 text-[11px] text-slate-600">
          <div className="flex items-center">
            <Calendar className="w-3.5 h-3.5 mr-2 text-blue-500" />
            <span>{dateLabel} · {timeLabel}</span>
          </div>
          <div className="flex items-center">
            <User className="w-3.5 h-3.5 mr-2 text-slate-400" />
            <span>{appointment.userName || 'Guest'}</span>
          </div>
          <div className="flex items-center">
            <Phone className="w-3.5 h-3.5 mr-2 text-slate-400" />
            <span>{appointment.userPhone || 'No phone available'}</span>
          </div>
        </div>
      </div>

      <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
        {question}
      </p>

      <div className="grid grid-cols-2 gap-2 mt-5">
        <button
          onClick={onConfirm}
          className="py-3 bg-red-50 hover:bg-red-100 text-red-500 text-[10px] font-bold uppercase tracking-widest border border-red-200 rounded-xl transition-all"
        >
          {confirmLabel}
        </button>
        <button
          onClick={onKeep}
          className="py-3 bg-white text-slate-500 text-[10px] font-bold uppercase tracking-widest border border-slate-200 hover:bg-slate-50 rounded-xl transition-all"
        >
          {keepLabel}
        </button>
      </div>
    </motion.div>
  );
};

export default CancellationConfirmCard;

