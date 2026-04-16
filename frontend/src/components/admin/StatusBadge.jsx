import React from 'react';

const StatusBadge = ({ status }) => {
  const styles = {
    pending: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    confirmed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    cancelled: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    completed: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    rescheduled: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  };

  return (
    <span className={`px-3 py-1.5 rounded-xl text-[10px] font-extrabold uppercase tracking-widest border transition-all duration-300 group-hover:scale-105 ${styles[status] || styles.pending}`}>
      {status}
    </span>
  );
};

export default StatusBadge;
