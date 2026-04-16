import React from 'react';
import { motion } from 'framer-motion';
import { 
    Clock, MapPin, IndianRupee, Phone, Mail, 
    Globe, Calendar, Map as MapIcon
} from 'lucide-react';

const InquiryCard = ({ type, onAction }) => {
    
    const renderPrices = () => (
        <div className="space-y-4">
            <h3 className="text-sm font-bold text-blue-600 uppercase tracking-widest flex items-center">
                <IndianRupee className="w-4 h-4 mr-2" /> Our Services & Prices
            </h3>
            <div className="glass-card rounded-2xl overflow-hidden border border-slate-200 bg-white">
                <div className="grid grid-cols-[1fr_auto] px-3 py-2 border-b border-slate-200 bg-slate-50">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Service</p>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Price</p>
                </div>
                {[
                    { name: 'Cardiology', price: '₹800', time: '45 min', icon: '🫀' },
                    { name: 'Dental', price: '₹500', time: '30 min', icon: '🦷' },
                    { name: 'Eye Care', price: '₹600', time: '30 min', icon: '👁️' },
                    { name: 'Neurology', price: '₹1000', time: '45 min', icon: '🧠' },
                    { name: 'Orthopedics', price: '₹700', time: '45 min', icon: '🦴' },
                    { name: 'Salon', price: '₹400', time: '60 min', icon: '💇' },
                ].map((s, i) => (
                    <div key={i} className="flex justify-between items-center p-3 border-b border-slate-100 last:border-0 hover:bg-slate-50">
                        <div className="flex items-center space-x-3">
                            <span className="text-lg">{s.icon}</span>
                            <div>
                                <p className="text-xs font-bold text-slate-900">{s.name}</p>
                                <p className="text-[10px] text-slate-500 font-medium">Consultation</p>
                            </div>
                        </div>
                        <p className="text-sm font-black text-blue-600">{s.price}</p>
                    </div>
                ))}
            </div>
        </div>
    );

    const renderDuration = () => (
        <div className="space-y-4">
            <h3 className="text-sm font-bold text-blue-600 uppercase tracking-widest flex items-center">
                <Clock className="w-4 h-4 mr-2" /> Service Duration
            </h3>
            <div className="glass-card rounded-2xl overflow-hidden border border-slate-200 bg-white">
                <div className="grid grid-cols-[1fr_auto] px-3 py-2 border-b border-slate-200 bg-slate-50">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Service</p>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Duration</p>
                </div>
                {[
                    { name: 'Cardiology', time: '45 min', icon: '🫀' },
                    { name: 'Dental', time: '30 min', icon: '🦷' },
                    { name: 'Eye Care', time: '30 min', icon: '👁️' },
                    { name: 'Neurology', time: '45 min', icon: '🧠' },
                    { name: 'Orthopedics', time: '45 min', icon: '🦴' },
                    { name: 'Salon', time: '60 min', icon: '💇' },
                ].map((s, i) => (
                    <div key={i} className="flex justify-between items-center p-3 border-b border-slate-100 last:border-0 hover:bg-slate-50">
                        <div className="flex items-center space-x-3">
                            <span className="text-lg">{s.icon}</span>
                            <div>
                                <p className="text-xs font-bold text-slate-900">{s.name}</p>
                                <p className="text-[10px] text-slate-500 font-medium">Estimated time</p>
                            </div>
                        </div>
                        <p className="text-sm font-black text-blue-600">{s.time}</p>
                    </div>
                ))}
            </div>
        </div>
    );

    const renderHours = () => (
        <div className="space-y-4">
            <h3 className="text-sm font-bold text-blue-600 uppercase tracking-widest flex items-center">
                <Clock className="w-4 h-4 mr-2" /> Working Hours
            </h3>
            <div className="glass-card rounded-2xl p-4 border border-slate-200 bg-white space-y-3">
                <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-500">Monday - Friday</span>
                    <span className="text-xs font-bold text-slate-900 text-right">9:00 AM - 6:00 PM</span>
                </div>
                <div className="flex justify-between items-center border-t border-slate-100 pt-3">
                    <span className="text-xs font-bold text-slate-500">Saturday</span>
                    <span className="text-xs font-bold text-slate-900 text-right">9:00 AM - 3:00 PM</span>
                </div>
                <div className="flex justify-between items-center border-t border-slate-100 pt-3">
                    <span className="text-xs font-bold text-slate-500">Sunday</span>
                    <span className="text-xs font-bold text-red-500 text-right">Closed</span>
                </div>
            </div>
        </div>
    );

    const renderContact = () => (
        <div className="space-y-4">
            <h3 className="text-sm font-bold text-blue-600 uppercase tracking-widest flex items-center">
                <MapPin className="w-4 h-4 mr-2" /> Location & Contact
            </h3>
            <div className="glass-card rounded-2xl p-4 border border-slate-200 bg-white space-y-4">
                <div className="flex items-start space-x-3">
                    <MapIcon className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-slate-600 font-medium leading-relaxed">
                        123 Wellness Avenue, <br /> Guntur, AP - 522001
                    </p>
                </div>
                <div className="flex items-center space-x-3">
                    <Phone className="w-4 h-4 text-blue-500 shrink-0" />
                    <p className="text-xs text-slate-900 font-bold">+91 9515574466</p>
                </div>
                <div className="flex items-center space-x-3">
                    <Mail className="w-4 h-4 text-blue-500 shrink-0" />
                    <p className="text-xs text-slate-900 font-bold">info@elitewellness.com</p>
                </div>
                <div className="flex items-center space-x-3">
                    <Globe className="w-4 h-4 text-blue-500 shrink-0" />
                    <p className="text-xs text-blue-700 font-bold underline decoration-blue-300">www.elitewellness.com</p>
                </div>
            </div>
        </div>
    );

    return (
        <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-[320px] mt-4"
        >
            {type === 'prices' && renderPrices()}
            {type === 'duration' && renderDuration()}
            {type === 'hours' && renderHours()}
            {type === 'contact' && renderContact()}

            <div className="mt-5 flex space-x-2">
                <button 
                    onClick={() => onAction('Book Appointment')}
                    className="flex-1 py-3 bg-blue-gradient text-white text-[10px] font-bold rounded-xl shadow-lg hover:shadow-blue-500/20 active:scale-95 transition-all"
                >
                    📅 Book Appointment
                </button>
                <button
                    onClick={() => onAction('Main Menu')}
                    className="flex-1 py-3 bg-white text-slate-500 text-[10px] font-bold rounded-xl border border-slate-200 hover:bg-slate-50 transition-all"
                >
                    🔙 Main Menu
                </button>
            </div>
        </motion.div>
    );
};

export default InquiryCard;
