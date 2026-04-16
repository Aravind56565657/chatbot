import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, Clock, CheckCircle2, Calendar as CalendarIcon, 
  Search, Plus, LayoutDashboard, LogOut, Bell, 
  Settings, ChevronDown, Filter, Edit3, Trash2, X, AlertCircle,
  Stethoscope, Hash, UserCircle2
} from 'lucide-react';
import { appointmentAPI, serviceAPI, doctorAPI } from '../api';
import { format } from 'date-fns';

const styles = {
  glass: "backdrop-blur-xl border border-slate-200 bg-white/90 shadow-[0_18px_40px_rgba(15,23,42,0.06)]",
  sidebarItem: "w-full flex items-center space-x-3 px-4 py-3.5 rounded-2xl text-sm transition-all duration-300",
  activeSidebar: "bg-blue-50 text-blue-700 font-bold border border-blue-100 shadow-sm",
  inactiveSidebar: "text-slate-500 hover:text-slate-800 hover:bg-slate-50",
  statCard: "p-6 rounded-3xl border border-slate-200 bg-white hover:bg-slate-50 transition-all duration-500 shadow-[0_12px_30px_rgba(15,23,42,0.05)]",
  badge: "px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wider border",
};

const statusColors = {
  pending: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  confirmed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  cancelled: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  completed: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  rescheduled: "bg-violet-500/10 text-violet-500 border-violet-500/20",
};

const StatCard = ({ title, value, icon: Icon, color, delay }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
    className={styles.statCard}
  >
    <div className="flex items-center justify-between mb-4">
      <div className={`p-4 rounded-2xl ${color} bg-opacity-20 flex items-center justify-center`}>
        <Icon className="w-5 h-5 text-slate-700" />
      </div>
    </div>
    <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em]">{title}</p>
    <h3 className="text-3xl font-bold mt-1 text-slate-900">{value || 0}</h3>
  </motion.div>
);

const AdminPage = () => {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState([]);
  const [services, setServices] = useState([]);
  const [allDoctors, setAllDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedApt, setSelectedApt] = useState(null);
  const [filter, setFilter] = useState({ status: '', search: '' });
  const [stats, setStats] = useState({ total: 0, pending: 0, confirmed: 0, today: 0 });

  // Security Gate
  useEffect(() => {
    const isAuth = localStorage.getItem('adminAuth');
    if (!isAuth) {
      navigate('/admin/login');
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('adminAuth');
    navigate('/admin/login');
  };

  // Fetch doctors for the modal
  useEffect(() => {
    doctorAPI.getAll().then(res => setAllDoctors(res.data)).catch(console.error);
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [aptRes, svcRes] = await Promise.all([
        appointmentAPI.getAll({ ...filter, limit: 100 }),
        serviceAPI.getAll()
      ]);
      const apts = Array.isArray(aptRes.data?.appointments) ? aptRes.data.appointments : [];
      setAppointments(apts);
      setServices(svcRes.data);
      
      const today = new Date().toISOString().split('T')[0];
      setStats({
        total: aptRes.data?.totalCount || 0,
        pending: apts.filter(a => a?.status === 'pending').length,
        confirmed: apts.filter(a => a?.status === 'confirmed').length,
        today: apts.filter(a => String(a?.date).includes(today)).length
      });
    } catch (err) {
      setError("Sync failed.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [filter.status]);

  const handleAction = async (method, id, data) => {
    try {
      if (method === 'delete') {
        if (!window.confirm("Confirm cancellation?")) return;
        await appointmentAPI.delete(id);
      } else {
        // Find doctor name for the payload
        const doc = allDoctors.find(d => d._id === data.doctorId);
        if (doc) data.doctorName = doc.name;

        if (method === 'update') await appointmentAPI.update(id, data);
        else await appointmentAPI.create(data);
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      alert("Error: " + (err.response?.data?.error || "Failed"));
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-700">
      <div className="mesh-bg opacity-70" />
      <aside className="w-80 border-r border-slate-200 flex flex-col p-8 z-30 hidden xl:flex bg-white/85 backdrop-blur-3xl">
        <h1 className="text-xl font-bold text-slate-900 mb-3">Vanguard Admin</h1>
        <p className="text-sm text-slate-500 mb-9">Appointment operations and live booking records.</p>
        <nav className="space-y-2 mb-auto">
            {[{ name: 'Full Database', slug: '', icon: Users }, { name: 'Pending Review', slug: 'pending', icon: Clock }, { name: 'Confirmed List', slug: 'confirmed', icon: CheckCircle2 }].map(item => (
                <button key={item.slug} onClick={() => setFilter({ ...filter, status: item.slug })} className={`${styles.sidebarItem} ${filter.status === item.slug ? styles.activeSidebar : styles.inactiveSidebar}`}><item.icon className="w-4 h-4" /><span>{item.name}</span></button>
            ))}
        </nav>
        
        <button 
          onClick={handleLogout}
          className="mt-10 w-full flex items-center space-x-3 px-4 py-3.5 rounded-2xl text-sm transition-all duration-300 text-rose-500 hover:bg-rose-50 font-bold"
        >
          <LogOut className="w-4 h-4" />
          <span>Exit System</span>
        </button>
      </aside>

      <main className="flex-1 p-12 z-10 overflow-x-hidden">
        <header className="flex justify-between items-center mb-12">
            <div><h2 className="text-4xl font-extrabold text-slate-900 mb-2 tracking-tight">Management</h2><span className="text-xs text-emerald-600 uppercase font-black tracking-widest bg-emerald-50 px-2 py-1 rounded">Live Matrix</span></div>
            <button onClick={() => { setSelectedApt(null); setIsModalOpen(true); }} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-2xl flex items-center space-x-2 text-sm font-bold shadow-xl shadow-blue-600/20 transition-all"><Plus className="w-4 h-4" /><span>Add Record</span></button>
        </header>

        <div className="grid grid-cols-4 gap-6 mb-12">
            <StatCard title="Total Transactions" value={stats.total} icon={Users} color="bg-blue-600" delay={0.1} />
            <StatCard title="Awaiting Verification" value={stats.pending} icon={Clock} color="bg-orange-500" delay={0.2} />
            <StatCard title="Verified Secured" value={stats.confirmed} icon={CheckCircle2} color="bg-emerald-500" delay={0.3} />
            <StatCard title="Expected Today" value={stats.today} icon={CalendarIcon} color="bg-violet-600" delay={0.4} />
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden p-6 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
            {error && <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">{error}</div>}
            <table className="w-full text-left">
                <thead><tr className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] border-b border-slate-200"><th className="px-4 py-4">Client Detail</th><th className="px-4 py-4">Age/Sex</th><th className="px-4 py-4">Specialist</th><th className="px-4 py-4">Status</th><th className="px-4 py-4 text-right">Ops</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                    {appointments.map(apt => (
                        <tr key={apt._id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-5"><div className="text-sm font-bold text-slate-900">{apt.userName}</div><div className="text-[10px] text-blue-600 font-mono">#{apt.bookingId}</div></td>
                            <td className="px-4 py-5"><div className="text-xs font-bold text-slate-700">{apt.userAge || '??'}y</div><span className="text-[9px] text-slate-500 font-black uppercase tracking-widest">{apt.userGender || 'U'}</span></td>
                            <td className="px-4 py-5"><div className="text-xs font-bold text-slate-900">{apt.doctorName || 'No Doc'}</div><div className="text-[9px] text-slate-500 uppercase">{apt.serviceCategory}</div></td>
                            <td className="px-4 py-5"><span className={`${styles.badge} ${statusColors[apt.status]}`}>{apt.status}</span></td>
                            <td className="px-4 py-5 text-right"><div className="flex justify-end space-x-2"><button onClick={() => { setSelectedApt(apt); setIsModalOpen(true); }} className="p-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-500 hover:text-blue-600 transition-colors"><Edit3 className="w-4 h-4" /></button><button onClick={() => handleAction('delete', apt._id)} className="p-2 border border-slate-200 hover:bg-rose-50 rounded-lg text-slate-500 hover:text-rose-500 transition-colors"><Trash2 className="w-4 h-4" /></button></div></td>
                        </tr>
                    ))}
                    {!loading && appointments.length === 0 && (
                      <tr>
                        <td colSpan="5" className="px-4 py-16 text-center text-sm text-slate-500">No appointments found for the selected view.</td>
                      </tr>
                    )}
                </tbody>
            </table>
        </div>
      </main>

      <AnimatePresence>
        {isModalOpen && (
          <ModalContent 
            selectedApt={selectedApt} 
            services={services} 
            allDoctors={allDoctors} 
            onClose={() => setIsModalOpen(false)} 
            onSubmit={handleAction} 
          />
        )}
      </AnimatePresence>
    </div>
  );
};

const ModalContent = ({ selectedApt, services, allDoctors, onClose, onSubmit }) => {
  const [selectedCategory, setSelectedCategory] = useState(selectedApt?.serviceCategory || services[0]?.category || 'Cardiology');
  const filteredDoctors = allDoctors.filter(d => d.serviceCategory === selectedCategory);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-md">
       <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-white border border-slate-200 w-full max-w-xl rounded-3xl p-8 shadow-2xl">
          <div className="flex justify-between items-center mb-10"><h3 className="text-xl font-bold text-slate-900">Registry Record</h3><button onClick={onClose} className="text-slate-500 hover:text-slate-900"><X /></button></div>
          <form onSubmit={e => { e.preventDefault(); const d = new FormData(e.target); onSubmit(selectedApt ? 'update' : 'create', selectedApt?._id, Object.fromEntries(d.entries())); }} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1"><label className="text-[10px] text-slate-500 font-black uppercase">Name</label><input name="userName" defaultValue={selectedApt?.userName} required className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:border-blue-500 outline-none" /></div>
                  <div className="space-y-1"><label className="text-[10px] text-slate-500 font-black uppercase">Phone</label><input name="userPhone" defaultValue={selectedApt?.userPhone} required className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1"><label className="text-[10px] text-slate-500 font-black uppercase">Age</label><input name="userAge" type="number" defaultValue={selectedApt?.userAge} required className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm" /></div>
                  <div className="space-y-1"><label className="text-[10px] text-slate-500 font-black uppercase">Gender</label><select name="userGender" defaultValue={selectedApt?.userGender || 'Male'} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm">{['Male', 'Female', 'Other'].map(g => <option key={g} value={g} className="bg-white">{g}</option>)}</select></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1"><label className="text-[10px] text-slate-500 font-black uppercase">Service Group</label><select name="serviceCategory" value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm">{['Cardiology', 'Dental', 'Eye Care', 'Neurology', 'Orthopedics', 'Salon'].map(c => <option key={c} value={c} className="bg-white">{c}</option>)}</select></div>
                  <div className="space-y-1"><label className="text-[10px] text-slate-500 font-black uppercase">Doctor</label><select name="doctorId" defaultValue={selectedApt?.doctorId?._id || selectedApt?.doctorId} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm">{filteredDoctors.map(d => <option key={d._id} value={d._id} className="bg-white">{d.name}</option>)}</select></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1"><label className="text-[10px] text-slate-500 font-black uppercase">Service Name</label><input name="service" defaultValue={selectedApt?.service} required className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm" /></div>
                  <div className="space-y-1"><label className="text-[10px] text-slate-500 font-black uppercase">Date</label><input name="date" type="date" defaultValue={selectedApt?.date ? new Date(selectedApt.date).toISOString().split('T')[0] : ''} required className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1"><label className="text-[10px] text-slate-500 font-black uppercase">TimeSlot</label><input name="timeSlot" defaultValue={selectedApt?.timeSlot} required className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm" /></div>
                  <div className="space-y-1"><label className="text-[10px] text-slate-500 font-black uppercase">Status</label><select name="status" defaultValue={selectedApt?.status || 'pending'} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm">{Object.keys(statusColors).map(s => <option key={s} value={s} className="bg-white">{s}</option>)}</select></div>
              </div>
              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-2xl font-bold text-white shadow-xl mt-4">Commit Entry</button>
          </form>
       </motion.div>
    </div>
  )
}

export default AdminPage;
