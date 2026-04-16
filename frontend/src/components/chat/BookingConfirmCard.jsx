import React from 'react';
import { motion } from 'framer-motion';
import { Calendar, Clock, User, Phone, Mail, CheckCircle, XCircle, AlertCircle, Stethoscope } from 'lucide-react';

const BookingConfirmCard = ({ data, onConfirm, onCancel, isConfirmed = false, isCancellation = false }) => {
  if (!data) return null;

  const accentColor = isCancellation ? 'rose' : 'blue';
  const dateLabel = data.date
    ? new Date(data.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    : 'Pending';
  const safeTime = data.timeSlot || 'Pending';
  const serviceLabel = data.service || data.serviceCategory || 'Consultation';
  const doctorLabel = data.doctorName || 'Senior Consultant';
  const emailLabel = data.userEmail || 'Not provided';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`glass-card p-5 rounded-[28px] border border-slate-200 shadow-2xl relative overflow-hidden my-4 max-w-[380px] bg-white ${isCancellation ? 'bg-rose-50/60' : ''}`}
    >
      <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <div className={`p-2 rounded-xl ${isCancellation ? 'bg-rose-50' : 'bg-blue-50'} border ${isCancellation ? 'border-rose-100' : 'border-blue-100'}`}>
              {isConfirmed ? (
                 <CheckCircle className={`w-4 h-4 ${isCancellation ? 'text-rose-500' : 'text-blue-500'}`} />
              ) : isCancellation ? (
                 <XCircle className="w-4 h-4 text-rose-500" />
              ) : (
                 <AlertCircle className="w-4 h-4 text-blue-500" />
              )}
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                {isConfirmed ? 'Booking Confirmed' : isCancellation ? 'Confirm Cancellation' : 'Review Appointment'}
              </h3>
              <p className={`text-[10px] font-medium ${isCancellation ? 'text-rose-500' : 'text-blue-600'}`}>
                {isConfirmed ? `Ref: ${data.bookingId}` : 'Action Required'}
              </p>
            </div>
          </div>
      </div>

      <div className="bg-slate-50 rounded-2xl p-4 space-y-4 mb-6 border border-slate-200">
         <div className="flex justify-between items-start gap-3">
            <div className="space-y-1">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Service & Doctor</span>
                <div className="flex items-center text-[13px] font-semibold text-slate-900">
                  <Stethoscope className="w-4 h-4 mr-2 text-blue-500" />
                  <span>{serviceLabel}</span>
                </div>
                <p className="text-[11px] text-blue-600 font-semibold uppercase">{doctorLabel}</p>
            </div>
            {!isConfirmed && (
              <span className="rounded-full bg-blue-50 border border-blue-100 px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest text-blue-600">
                Review before confirm
              </span>
            )}
         </div>

         <div className="grid grid-cols-2 gap-3 border-t border-slate-200 pt-4">
            <div className="flex items-center space-x-2 text-slate-600">
                <Calendar className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-[11px]">{dateLabel}</span>
            </div>
            <div className="flex items-center space-x-2 text-slate-600">
                <Clock className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-[11px]">{safeTime}</span>
            </div>
         </div>

         <div className="grid grid-cols-2 gap-4 border-t border-slate-200 pt-4">
            <div className="space-y-1">
                <span className="text-[9px] text-slate-500 uppercase font-bold">Patient Name</span>
                <div className="flex items-center text-[11px] text-slate-800">
                  <User className="w-3.5 h-3.5 mr-2 text-slate-400" />
                  <p className="truncate">{data.userName || 'Guest'}</p>
                </div>
            </div>
            <div className="space-y-1">
                <span className="text-[9px] text-slate-500 uppercase font-bold">Gender & Age</span>
                <p className="text-[11px] text-slate-800">{data.userGender || 'Male'}, {data.userAge || '22'}</p>
            </div>
         </div>

         <div className="grid grid-cols-1 gap-3 border-t border-slate-200 pt-4">
            <div className="flex items-center text-[11px] text-slate-600">
              <Phone className="w-3.5 h-3.5 mr-2 text-slate-400" />
              <span>{data.userPhone || 'No phone provided'}</span>
            </div>
            <div className="flex items-center text-[11px] text-slate-600">
              <Mail className="w-3.5 h-3.5 mr-2 text-slate-400" />
              <span>{emailLabel}</span>
            </div>
         </div>
      </div>

      {!isConfirmed && (
        <div className="space-y-2">
          <button 
            onClick={onConfirm}
            className="w-full py-3 rounded-xl bg-blue-gradient text-white text-xs font-bold uppercase tracking-[0.2em] shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
          >
            {isCancellation ? 'Yes, Cancel Appt' : 'Confirm Booking'}
          </button>
          {!isCancellation && (
            <button 
                onClick={onCancel}
                className="w-full py-3 rounded-xl bg-white text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em] border border-slate-200 hover:bg-slate-50 transition-all"
            >
                Modify Details & Restart Flow
            </button>
          )}
        </div>
      )}

      {isConfirmed && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
             <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest">Appointment saved successfully</p>
        </div>
      )}
    </motion.div>
  );
};

export default BookingConfirmCard;
