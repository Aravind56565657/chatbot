import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Star, Award, Briefcase, GraduationCap, ChevronRight } from 'lucide-react';
import { doctorAPI } from '../../api';

const DoctorCardRow = ({ category, onSelect }) => {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        setLoading(true);
        // Try category-specific first
        let response = await doctorAPI.getByCategory(category);
        
        // If no doctors found for category, fetch ALL to avoid blank screen
        if (!response.data || response.data.length === 0) {
          console.warn(`No specialists found for category: ${category}. Fetching all.`);
          response = await doctorAPI.getAll();
        }
        
        setDoctors(response.data);
      } catch (err) {
        console.error("Fetch doctors failed", err);
      } finally {
        setLoading(false);
      }
    };
    fetchDoctors();
  }, [category]);

  if (loading) return <div className="text-gray-500 text-[10px] animate-pulse uppercase tracking-[0.2em] mt-4 ml-4">Seeking Specialists...</div>;
  
  if (doctors.length === 0) return (
    <div className="p-4 glass-card rounded-2xl border border-rose-500/20 text-rose-400 text-xs italic">
      No specialists currently on duty. Please contact support.
    </div>
  );

  return (
    <div className="flex overflow-x-auto gap-4 pb-4 mt-6 no-scrollbar px-2 -mx-2">
      {doctors.map((doc, index) => (
        <motion.div
          key={doc._id}
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.1 }}
          whileHover={{ scale: 1.02 }}
          className="flex-shrink-0 w-[240px] glass-card p-6 rounded-[24px] border border-white/5 hover:border-blue-500/30 transition-all cursor-pointer group bg-gradient-to-br from-white/[0.03] to-transparent shadow-xl"
          onClick={() => onSelect(doc.name, doc._id)}
        >
          <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center text-2xl">
                {doc.serviceCategory === 'Salon' ? '💇' : '👨‍⚕️'}
              </div>
              <div className="flex items-center space-x-1 px-2 py-1 bg-amber-500/10 rounded-lg">
                <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                <span className="text-[10px] font-bold text-amber-500">{doc.rating}</span>
              </div>
          </div>

          <div className="space-y-1 mb-4">
              <h4 className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors uppercase tracking-tight">{doc.name}</h4>
              <p className="text-[10px] text-gray-400 font-medium leading-tight">{doc.specialization}</p>
          </div>

          <div className="grid grid-cols-1 gap-2 border-t border-white/5 pt-4">
              <div className="flex items-center text-[10px] text-gray-500">
                  <GraduationCap className="w-3 h-3 mr-2 text-blue-400/50" />
                  <span className="truncate">{doc.qualification || 'Senior Consultant'}</span>
              </div>
              <div className="flex items-center text-[10px] text-gray-500">
                  <Briefcase className="w-3 h-3 mr-2 text-blue-400/50" />
                  <span>{doc.experience || 5} yrs experience</span>
              </div>
          </div>

          <button className="w-full mt-5 py-2.5 rounded-xl bg-blue-600/10 text-blue-400 text-[10px] font-bold uppercase tracking-widest border border-blue-500/20 group-hover:bg-blue-600 group-hover:text-white transition-all flex items-center justify-center">
              <span>Select Specialist</span>
              <ChevronRight className="w-3 h-3 ml-1" />
          </button>
        </motion.div>
      ))}
    </div>
  );
};

export default DoctorCardRow;
