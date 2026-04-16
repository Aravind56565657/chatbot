import React from 'react';
import { motion } from 'framer-motion';
import { 
    Calendar, CheckCircle2, XCircle, 
    RefreshCcw, ChevronRight, Hash, Ban
} from 'lucide-react';

const AppointmentListCard = ({ appointments, onAction, onRescheduleAppointment, onCancelAppointment }) => {
    
    const getStatusColor = (status) => {
        switch (status?.toLowerCase()) {
            case 'confirmed': return 'bg-green-500/20 text-green-400 border-green-500/30';
            case 'pending': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
            case 'cancelled': return 'bg-red-500/20 text-red-400 border-red-500/30';
            case 'rescheduled': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
            case 'completed': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
            default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
        }
    };

    if (!appointments || appointments.length === 0) {
        return (
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="glass-card p-6 rounded-3xl border border-slate-200 text-center space-y-3"
            >
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
                    <Ban className="w-8 h-8 text-red-400/50" />
                </div>
                <h3 className="text-slate-900 font-bold tracking-tight">No Bookings Found</h3>
                <p className="text-xs text-slate-500">We couldn't find any appointments for this search.</p>
                <button 
                    onClick={() => onAction('Book Appointment')}
                    className="w-full py-3 bg-blue-gradient text-white text-xs font-bold rounded-xl mt-4"
                >
                    📅 Book Your First Appointment
                </button>
            </motion.div>
        );
    }

    return (
        <div className="space-y-4 w-full max-w-[340px] mt-4">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] px-2 flex items-center justify-between">
                <span>Your Appointments</span>
                <span className="bg-blue-50 text-blue-600 h-5 px-2 rounded-full text-[9px] flex items-center border border-blue-100">{appointments.length} found</span>
            </h3>
            
            <div className="space-y-3">
                {appointments.map((apt, index) => (
                    <motion.div
                        key={apt._id || index}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="glass-card rounded-[24px] p-4 border border-slate-200 relative overflow-hidden shadow-xl bg-white"
                    >
                        <div className="flex justify-between items-start mb-3">
                            <div className="flex items-center space-x-2">
                                <span className="p-1.5 bg-blue-50 rounded-lg border border-blue-100">
                                    <Hash className="w-3 h-3 text-blue-500" />
                                </span>
                                <span className="text-[10px] font-black tracking-widest text-slate-500">{apt.bookingId}</span>
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-widest border ${getStatusColor(apt.status)}`}>
                                {apt.status}
                            </span>
                        </div>

                        <div className="space-y-2 mb-4">
                            <div className="flex items-center text-xs font-bold text-slate-900">
                                <span className="mr-2 text-base">
                                    {apt.serviceCategory === 'Dental' ? '🦷' : apt.serviceCategory === 'Cardiology' ? '🫀' : '🏥'}
                                </span>
                                {apt.serviceCategory} · {apt.doctorName}
                            </div>
                            <div className="flex items-center text-[10px] font-medium text-slate-500">
                                <Calendar className="w-3 h-3 mr-2 text-blue-500" />
                                {new Date(apt.date).toLocaleDateString()} · {apt.timeSlot}
                            </div>
                        </div>

                        {(apt.status === 'pending' || apt.status === 'confirmed') ? (
                            <div className="grid grid-cols-2 gap-2 mt-4">
                                <button
                                    onClick={() => onRescheduleAppointment ? onRescheduleAppointment(apt) : onAction(`reschedule booking ${apt.bookingId}`)}
                                    className="flex items-center justify-center space-x-2 py-2 bg-violet-50 hover:bg-violet-100 text-[10px] font-bold text-violet-700 rounded-lg transition-colors border border-violet-100"
                                >
                                    <RefreshCcw className="w-3 h-3 text-violet-500" />
                                    <span>🔄 Reschedule</span>
                                </button>
                                <button
                                    onClick={() => onCancelAppointment ? onCancelAppointment(apt) : onAction(`cancel booking ${apt.bookingId}`)}
                                    className="flex items-center justify-center space-x-2 py-2 bg-red-500/10 hover:bg-red-500/20 text-[10px] font-bold text-red-400 rounded-lg transition-colors border border-red-500/10"
                                >
                                    <XCircle className="w-3 h-3" />
                                    <span>❌ Cancel</span>
                                </button>
                            </div>
                        ) : (
                            <p className="text-[10px] text-slate-500 mt-3">
                                ({apt.status === 'cancelled' ? 'cancelled' : apt.status} — no actions)
                            </p>
                        )}
                    </motion.div>
                ))}
            </div>
            
            <button 
                onClick={() => onAction('Main Menu')}
                className="w-full py-3 border border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-widest rounded-xl hover:text-slate-900 hover:bg-white transition-colors"
            >
                🔙 Return to Main Menu
            </button>
        </div>
    );
};

export default AppointmentListCard;
