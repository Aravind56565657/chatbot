import React from 'react';
import { motion } from 'framer-motion';
import { Hash, Calendar } from 'lucide-react';

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

const formatDateLabel = (d) =>
  d ? new Date(d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : '—';

const displayTime = (t) => {
  const s = String(t || '').trim();
  if (!s) return '—';
  const normalized = s.replace(/\s+/g, '');
  const upper = normalized.toUpperCase();
  if (upper.endsWith('AM') || upper.endsWith('PM')) {
    return `${upper.slice(0, -2)} ${upper.slice(-2)}`;
  }
  return s;
};

const RescheduleAppointmentsMiniList = ({ appointments, onSelectReschedule }) => {
  if (!appointments || appointments.length === 0) return null;

  return (
    <div className="space-y-3 w-full max-w-[360px] mt-4">
      <h3 className="text-xs font-black text-gray-500 uppercase tracking-[0.2em] px-2 flex items-center justify-between">
        <span>Your Appointments</span>
        <span className="bg-blue-500/10 text-blue-400 h-5 px-2 rounded-full text-[9px] flex items-center">
          {appointments.length} found
        </span>
      </h3>

      {appointments.map((apt, idx) => {
        const status = apt.status || 'pending';
        return (
          <motion.div
            key={apt._id || idx}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="glass-card rounded-2xl p-4 border border-white/5"
          >
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <span className="p-1.5 bg-blue-500/10 rounded-lg">
                  <Hash className="w-3 h-3 text-blue-400" />
                </span>
                <span className="text-[10px] font-black tracking-widest text-white/60">{apt.bookingId}</span>
              </div>

              <div className="flex items-center text-xs font-bold text-white">
                <span className="mr-2">
                  {apt.serviceCategory === 'Dental' ? '🦷' : apt.serviceCategory === 'Cardiology' ? '🫀' : '🏥'}
                </span>
                <span className="truncate">{apt.serviceCategory} · {apt.doctorName}</span>
              </div>

              <div className="flex items-center text-[10px] font-medium text-gray-400">
                <Calendar className="w-3 h-3 mr-2 text-blue-500" />
                <span>
                  {formatDateLabel(apt.date)} · {displayTime(apt.timeSlot)}
                </span>
              </div>

              <div className="flex items-center justify-between mt-2">
                <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-widest border ${statusBadgeClasses(status)}`}>
                  Status: {String(status).charAt(0).toUpperCase() + String(status).slice(1)}
                </span>
              </div>
            </div>

            <div className="mt-3">
              <button
                onClick={() => onSelectReschedule && onSelectReschedule(apt)}
                className="w-full py-2 bg-white/5 hover:bg-white/10 text-[10px] font-bold text-blue-400 rounded-lg transition-colors border border-white/10"
              >
                Select to Reschedule
              </button>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

export default RescheduleAppointmentsMiniList;

