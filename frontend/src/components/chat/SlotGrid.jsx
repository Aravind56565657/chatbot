import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Clock, XCircle, CheckCircle2 } from 'lucide-react';
import { appointmentAPI } from '../../api';

const SlotGrid = ({ doctorId, date, onSelect, readOnly = false }) => {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const SLOT_TIMES = ["9:00 AM", "10:00 AM", "11:00 AM", "12:00 PM", "2:00 PM", "3:00 PM", "4:00 PM", "5:00 PM", "6:00 PM"];

    const generateMockSlots = () => {
      return SLOT_TIMES.map(t => ({
        time: t,
        available: Math.random() > 0.3 // fallback for dev/testing
      }));
    };

    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        if (!doctorId || !date) {
          if (!cancelled) {
            setSlots(generateMockSlots());
            setLoading(false);
          }
          return;
        }
        const r = await appointmentAPI.getAvailability(doctorId, date);
        const apiSlots = r.data?.slots || [];
        const normalized = apiSlots.length
          ? apiSlots
          : generateMockSlots();
        if (!cancelled) {
          setSlots(normalized);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setSlots(generateMockSlots());
          setLoading(false);
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [doctorId, date]);

  if (loading) return (
    <div className="flex items-center space-x-3 p-4 bg-white/5 rounded-2xl animate-pulse mt-4 ml-2 max-w-[200px]">
        <Clock className="w-4 h-4 text-blue-500" />
        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest leading-none">Syncing slots...</span>
    </div>
  );

  return (
    <div className="grid grid-cols-3 gap-3 mt-6 w-full max-w-[340px] px-2">
      {slots.map((slot, index) => (
        <motion.button
          key={slot.time}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: index * 0.05 }}
          disabled={!slot.available || readOnly}
          onClick={() => onSelect && onSelect(slot.time)}
          className={`relative p-4 rounded-3xl border text-xs font-black transition-all flex flex-col items-center justify-center space-y-1 ${
            slot.available 
              ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/40'
              : 'bg-red-500/5 border-red-500/20 text-red-400 cursor-not-allowed grayscale-[0.5]'
          } ${readOnly ? 'cursor-default pointer-events-none' : ''}`}
        >
          <Clock className={`w-3 h-3 mb-1 opacity-40 ${slot.available ? 'text-emerald-500' : 'text-red-500'}`} />
          <span className="text-[10px]">{slot.time}</span>
          
          <div className="absolute top-2 right-2">
              {slot.available ? (
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
              ) : (
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
              )}
          </div>

          {!slot.available && (
              <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none">
                <XCircle className="w-10 h-10 text-red-500" />
              </div>
          )}
        </motion.button>
      ))}
    </div>
  );
};

export default SlotGrid;
