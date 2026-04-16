import React from 'react';
import { format } from 'date-fns';
import { Edit3, Trash2, Calendar, Clock, Contact, Users } from 'lucide-react';
import StatusBadge from './StatusBadge';

const AppointmentsTable = ({ appointments, onEdit, onCancel }) => {
  // Hard safety: ensure appointments is ALWAYS an array
  const safeAppointments = Array.isArray(appointments) ? appointments : [];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-separate border-spacing-y-2 px-4">
        <thead>
          <tr className="text-gray-500 text-[10px] uppercase font-extrabold tracking-[0.2em] opacity-60">
            <th className="px-6 py-4">Session Reference</th>
            <th className="px-6 py-4">Principal Client</th>
            <th className="px-6 py-4">Service Details</th>
            <th className="px-6 py-4">Scheduled Window</th>
            <th className="px-6 py-4">Status</th>
            <th className="px-6 py-4 text-right">Operations</th>
          </tr>
        </thead>
        <tbody>
          {safeAppointments.length > 0 ? (
            safeAppointments.map((apt, index) => (
              <tr key={apt?._id || `apt-${index}`} className="glass-card group hover:bg-white/[0.04]">
                <td className="px-6 py-5 first:rounded-l-2xl border-y border-l border-white/5">
                  <span className="text-sm font-mono font-bold text-blue-400 opacity-80 group-hover:opacity-100 transition-opacity">#{apt?.bookingId || 'N/A'}</span>
                </td>
                <td className="px-6 py-5 border-y border-white/5">
                  <div className="flex items-center">
                      <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center mr-3">
                          <Contact className="w-4 h-4 text-blue-400/60" />
                      </div>
                      <div>
                          <div className="text-sm font-bold text-gray-200">{apt?.userName || 'Anonymous'}</div>
                          <div className="text-[10px] text-gray-500 font-medium">{apt?.userPhone || 'No Phone'}</div>
                      </div>
                  </div>
                </td>
                <td className="px-6 py-5 border-y border-white/5">
                  <div className="text-sm font-semibold text-gray-300">{apt?.service || 'Unspecified'}</div>
                  <div className="text-[10px] text-blue-500/50 font-bold uppercase tracking-widest">{apt?.serviceCategory || 'Service'}</div>
                </td>
                <td className="px-6 py-5 border-y border-white/5">
                  <div className="flex flex-col space-y-1">
                      <div className="flex items-center text-xs font-medium text-gray-400">
                        <Calendar className="w-3 h-3 mr-2 opacity-40" />
                        {apt?.date ? (
                          (() => {
                            try {
                              return format(new Date(apt.date), 'MMM dd, yyyy');
                            } catch (e) {
                              return 'Invalid Date';
                            }
                          })()
                        ) : 'TBD'}
                      </div>
                      <div className="flex items-center text-xs font-bold text-white/80">
                        <Clock className="w-3 h-3 mr-2 opacity-40" />
                        {apt?.timeSlot || 'TBD'}
                      </div>
                  </div>
                </td>
                <td className="px-6 py-5 border-y border-white/5">
                  <StatusBadge status={apt?.status} />
                </td>
                <td className="px-6 py-5 last:rounded-r-2xl border-y border-r border-white/5 text-right">
                  <div className="flex justify-end space-x-3">
                    <button 
                      onClick={() => onEdit && onEdit(apt)}
                      className="p-2.5 bg-white/5 hover:bg-blue-600/20 rounded-xl text-gray-500 hover:text-blue-400 transition-all border border-white/5"
                      title="Edit Entry"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => apt?._id && onCancel && onCancel(apt._id)}
                      className="p-2.5 bg-white/5 hover:bg-rose-600/20 rounded-xl text-gray-500 hover:text-rose-400 transition-all border border-white/5"
                      title="Terminate"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="6" className="px-6 py-20 text-center">
                <div className="flex flex-col items-center opacity-20">
                    <div className="w-20 h-20 border-2 border-dashed border-gray-500 rounded-full mb-4 flex items-center justify-center">
                        <Users className="w-10 h-10" />
                    </div>
                    <p className="text-sm font-bold tracking-widest uppercase">No Active Records Found</p>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default AppointmentsTable;
