import React from 'react';
import { motion } from 'framer-motion';
import { 
    Clock, MapPin, IndianRupee, Phone, Mail, 
    Globe, Calendar, Map as MapIcon, Info
} from 'lucide-react';

const InquiryCard = ({ type, onAction }) => {
    
    const renderPrices = () => (
        <div className="space-y-4">
            <h3 className="text-sm font-bold text-blue-400 uppercase tracking-widest flex items-center">
                <IndianRupee className="w-4 h-4 mr-2" /> Our Services & Prices
            </h3>
            <div className="glass-card rounded-2xl overflow-hidden border border-white/5">
                {[
                    { name: 'Cardiology', price: '₹800', time: '45 min', icon: '🫀' },
                    { name: 'Dental', price: '₹500', time: '30 min', icon: '🦷' },
                    { name: 'Eye Care', price: '₹600', time: '30 min', icon: '👁️' },
                    { name: 'Neurology', price: '₹1000', time: '45 min', icon: '🧠' },
                    { name: 'Orthopedics', price: '₹700', time: '45 min', icon: '🦴' },
                    { name: 'Salon', price: '₹400', time: '60 min', icon: '💇' },
                ].map((s, i) => (
                    <div key={i} className="flex justify-between items-center p-3 border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                        <div className="flex items-center space-x-3">
                            <span className="text-lg">{s.icon}</span>
                            <div>
                                <p className="text-xs font-bold text-white">{s.name}</p>
                                <p className="text-[10px] text-gray-500 font-medium">{s.time}</p>
                            </div>
                        </div>
                        <p className="text-sm font-black text-blue-400">{s.price}</p>
                    </div>
                ))}
            </div>
        </div>
    );

    const renderDuration = () => (
        <div className="space-y-4">
            <h3 className="text-sm font-bold text-blue-400 uppercase tracking-widest flex items-center">
                <Clock className="w-4 h-4 mr-2" /> Service Duration
            </h3>
            <div className="glass-card rounded-2xl overflow-hidden border border-white/5">
                {[
                    { name: 'Cardiology', time: '45 min', icon: '🫀' },
                    { name: 'Dental', time: '30 min', icon: '🦷' },
                    { name: 'Eye Care', time: '30 min', icon: '👁️' },
                    { name: 'Neurology', time: '45 min', icon: '🧠' },
                    { name: 'Orthopedics', time: '45 min', icon: '🦴' },
                    { name: 'Salon', time: '60 min', icon: '💇' },
                ].map((s, i) => (
                    <div key={i} className="flex justify-between items-center p-3 border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                        <div className="flex items-center space-x-3">
                            <span className="text-lg">{s.icon}</span>
                            <div>
                                <p className="text-xs font-bold text-white">{s.name}</p>
                                <p className="text-[10px] text-gray-500 font-medium">{s.time}</p>
                            </div>
                        </div>
                        <p className="text-sm font-black text-blue-400">{s.time}</p>
                    </div>
                ))}
            </div>
        </div>
    );

    const renderHours = () => (
        <div className="space-y-4">
            <h3 className="text-sm font-bold text-blue-400 uppercase tracking-widest flex items-center">
                <Clock className="w-4 h-4 mr-2" /> Working Hours
            </h3>
            <div className="glass-card rounded-2xl p-4 border border-white/5 space-y-3">
                <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-gray-400">Monday - Friday</span>
                    <span className="text-xs font-bold text-white text-right">9:00 AM - 6:00 PM</span>
                </div>
                <div className="flex justify-between items-center border-t border-white/5 pt-3">
                    <span className="text-xs font-bold text-gray-400">Saturday</span>
                    <span className="text-xs font-bold text-white text-right">9:00 AM - 3:00 PM</span>
                </div>
                <div className="flex justify-between items-center border-t border-white/5 pt-3">
                    <span className="text-xs font-bold text-gray-400">Sunday</span>
                    <span className="text-xs font-bold text-red-400 text-right">Closed</span>
                </div>
            </div>
        </div>
    );

    const renderContact = () => (
        <div className="space-y-4">
            <h3 className="text-sm font-bold text-blue-400 uppercase tracking-widest flex items-center">
                <MapPin className="w-4 h-4 mr-2" /> Location & Contact
            </h3>
            <div className="glass-card rounded-2xl p-4 border border-white/5 space-y-4">
                <div className="flex items-start space-x-3">
                    <MapIcon className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-gray-300 font-medium leading-relaxed">
                        123 Wellness Avenue, <br /> Guntur, AP - 522001
                    </p>
                </div>
                <div className="flex items-center space-x-3">
                    <Phone className="w-4 h-4 text-blue-500 shrink-0" />
                    <p className="text-xs text-white font-bold">+91 9515574466</p>
                </div>
                <div className="flex items-center space-x-3">
                    <Mail className="w-4 h-4 text-blue-500 shrink-0" />
                    <p className="text-xs text-white font-bold">info@elitewellness.com</p>
                </div>
                <div className="flex items-center space-x-3">
                    <Globe className="w-4 h-4 text-blue-500 shrink-0" />
                    <p className="text-xs text-white font-bold underline decoration-blue-500/30">www.elitewellness.com</p>
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
                    className="flex-1 py-3 bg-white/5 text-gray-400 text-[10px] font-bold rounded-xl border border-white/5 hover:bg-white/10 transition-all"
                >
                    🔙 Main Menu
                </button>
            </div>
        </motion.div>
    );
};

export default InquiryCard;
