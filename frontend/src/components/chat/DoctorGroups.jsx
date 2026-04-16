import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { doctorAPI } from '../../api';
import DoctorCardRow from './DoctorCardRow';

const specialtyOrder = [
  { category: 'Cardiology', icon: '🫀' },
  { category: 'Dental', icon: '🦷' },
  { category: 'Eye Care', icon: '👁️' },
  { category: 'Neurology', icon: '🧠' },
  { category: 'Orthopedics', icon: '🦴' },
  { category: 'Salon', icon: '💇' },
];

const DoctorGroups = ({ onBookWithDoctor, onMainMenu }) => {
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const r = await doctorAPI.getAll();
        const cats = Array.from(new Set((r.data || []).map(d => d.serviceCategory))).sort();
        if (!cancelled) setCategories(cats);
      } catch (e) {
        if (!cancelled) setCategories([]);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  const ordered = useMemo(() => {
    const present = new Set(categories);
    return specialtyOrder.filter(s => present.has(s.category));
  }, [categories]);

  if (!ordered.length) {
    return (
      <div className="glass-card p-6 rounded-3xl border border-white/5 text-center text-gray-500 text-xs">
        No doctors found.
      </div>
    );
  }

  return (
    <div className="w-full max-w-[360px]">
      {ordered.map((s) => (
        <motion.div
          key={s.category}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="mt-5"
        >
          <div className="text-xs font-black text-blue-400 uppercase tracking-widest mb-2 px-2 flex items-center gap-2">
            <span>{s.icon}</span>
            <span>{s.category}</span>
          </div>
          <DoctorCardRow
            category={s.category}
            onSelect={() => {
              onBookWithDoctor && onBookWithDoctor();
            }}
          />
        </motion.div>
      ))}

      <button
        onClick={() => onBookWithDoctor && onBookWithDoctor()}
        className="w-full py-3 mt-6 bg-blue-gradient text-white text-xs font-bold rounded-xl shadow-lg hover:shadow-blue-500/20 active:scale-95 transition-all"
      >
        📅 Book with a Doctor
      </button>

      <button
        onClick={() => onMainMenu && onMainMenu()}
        className="w-full py-3 mt-2 bg-white/5 text-gray-400 text-xs font-bold rounded-xl border border-white/5 hover:bg-white/10 transition-all"
      >
        🔙 Main Menu
      </button>
    </div>
  );
};

export default DoctorGroups;

