import React from 'react';
import { motion } from 'framer-motion';
import { Hash, Calendar, Phone, User } from 'lucide-react';

const statusBadgeClasses = (status) => {
  switch ((status || '').toLowerCase()) {
    case 'confirmed':
      return 'bg-green-50 text-green-600 border-green-200';
    case 'pending':
      return 'bg-amber-50 text-amber-600 border-amber-200';
    case 'cancelled':
      return 'bg-red-50 text-red-600 border-red-200';
    case 'rescheduled':
      return 'bg-purple-50 text-purple-600 border-purple-200';
    case 'completed':
      return 'bg-blue-50 text-blue-600 border-blue-200';
    default:
      return 'bg-slate-100 text-slate-500 border-slate-200';
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
      <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] px-2 flex items-center justify-between">
        <span>Your Appointments</span>
        <span className="bg-blue-50 text-blue-600 h-5 px-2 rounded-full text-[9px] flex items-center border border-blue-100">
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
            className="glass-card rounded-[24px] p-4 border border-slate-200 bg-white"
          >
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <span className="p-1.5 bg-blue-50 rounded-lg border border-blue-100">
                  <Hash className="w-3 h-3 text-blue-500" />
                </span>
                <span className="text-[10px] font-black tracking-widest text-slate-500">{apt.bookingId}</span>
              </div>

              <div className="flex items-center text-xs font-bold text-slate-900">
                <span className="mr-2">
                  {apt.serviceCategory === 'Dental' ? '🦷' : apt.serviceCategory === 'Cardiology' ? '🫀' : '🏥'}
                </span>
                <span className="truncate">{apt.serviceCategory} · {apt.doctorName}</span>
              </div>

              <div className="flex items-center text-[10px] font-medium text-slate-500">
                <Calendar className="w-3 h-3 mr-2 text-blue-500" />
                <span>
                  {formatDateLabel(apt.date)} · {displayTime(apt.timeSlot)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="flex items-center text-[10px] text-slate-500">
                  <User className="w-3 h-3 mr-2 text-slate-400" />
                  <span className="truncate">{apt.userName || 'Guest'}</span>
                </div>
                <div className="flex items-center text-[10px] text-slate-500">
                  <Phone className="w-3 h-3 mr-2 text-slate-400" />
                  <span>{apt.userPhone || '—'}</span>
                </div>
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
                className="w-full py-2.5 bg-blue-50 hover:bg-blue-100 text-[10px] font-bold text-blue-600 rounded-lg transition-colors border border-blue-200"
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

