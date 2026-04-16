import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

const BookingFormModal = ({ isOpen, onClose, appointment, onSubmit, services }) => {
  const [formData, setFormData] = useState({
    userName: '',
    userPhone: '',
    service: '',
    date: '',
    timeSlot: '',
    status: 'pending'
  });

  useEffect(() => {
    if (appointment) {
      setFormData({
        userName: appointment.userName,
        userPhone: appointment.userPhone,
        service: appointment.service,
        date: appointment.date.split('T')[0],
        timeSlot: appointment.timeSlot,
        status: appointment.status
      });
    } else {
        setFormData({
            userName: '',
            userPhone: '',
            service: services[0]?.name || '',
            date: '',
            timeSlot: '',
            status: 'pending'
        });
    }
  }, [appointment, services]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="glass-morphism-glow w-full max-w-md rounded-2xl p-6 relative"
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white">
          <X className="w-6 h-6" />
        </button>

        <h2 className="text-xl font-bold mb-6">{appointment ? 'Edit Appointment' : 'New Appointment'}</h2>

        <form onSubmit={(e) => { e.preventDefault(); onSubmit(formData); }} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Customer Name</label>
            <input
              type="text"
              required
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:border-electric-blue outline-none"
              value={formData.userName}
              onChange={(e) => setFormData({...formData, userName: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Phone Number</label>
            <input
              type="text"
              required
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:border-electric-blue outline-none"
              value={formData.userPhone}
              onChange={(e) => setFormData({...formData, userPhone: e.target.value})}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Service</label>
              <select
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:border-electric-blue outline-none appearance-none"
                value={formData.service}
                onChange={(e) => setFormData({...formData, service: e.target.value})}
              >
                {services.map(s => <option key={s._id} value={s.name}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Status</label>
              <select
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:border-electric-blue outline-none appearance-none"
                value={formData.status}
                onChange={(e) => setFormData({...formData, status: e.target.value})}
              >
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Date</label>
                <input
                type="date"
                required
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:border-electric-blue outline-none"
                value={formData.date}
                onChange={(e) => setFormData({...formData, date: e.target.value})}
                />
            </div>
            <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Time Slot</label>
                <input
                type="text"
                required
                placeholder="e.g. 3:00 PM"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:border-electric-blue outline-none"
                value={formData.timeSlot}
                onChange={(e) => setFormData({...formData, timeSlot: e.target.value})}
                />
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-blue-gradient py-3 rounded-xl font-bold mt-4 hover:opacity-90 transition-opacity"
          >
            {appointment ? 'Save Changes' : 'Create Appointment'}
          </button>
        </form>
      </motion.div>
    </div>
  );
};

export default BookingFormModal;
