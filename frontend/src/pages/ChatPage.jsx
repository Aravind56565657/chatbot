import React, { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Send, Bot, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { chatAPI, appointmentAPI } from '../api';
import MessageBubble from '../components/chat/MessageBubble';
import TypingIndicator from '../components/chat/TypingIndicator';
import BookingConfirmCard from '../components/chat/BookingConfirmCard';
import QuickReplies from '../components/chat/QuickReplies';
import DoctorCardRow from '../components/chat/DoctorCardRow';
import DoctorGroups from '../components/chat/DoctorGroups';
import SlotGrid from '../components/chat/SlotGrid';
import InquiryCard from '../components/chat/InquiryCard';
import AppointmentListCard from '../components/chat/AppointmentListCard';
import RescheduleConfirmCard from '../components/chat/RescheduleConfirmCard';
import AppointmentFoundCard from '../components/chat/AppointmentFoundCard';
import CancellationConfirmCard from '../components/chat/CancellationConfirmCard';
import CancellationSuccessCard from '../components/chat/CancellationSuccessCard';
import AppointmentNotFoundCard from '../components/chat/AppointmentNotFoundCard';
import CancelAppointmentsMiniList from '../components/chat/CancelAppointmentsMiniList';
import RescheduleAppointmentsMiniList from '../components/chat/RescheduleAppointmentsMiniList';

const ChatPage = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [sessionData, setSessionData] = useState({});
  
  const [sessionId] = useState(() => {
    const saved = localStorage.getItem('sessionId');
    if (saved) return saved;
    const newId = uuidv4();
    localStorage.setItem('sessionId', newId);
    return newId;
  });

  const chatEndRef = useRef(null);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isTyping]);

  // Auto-advance for "My Bookings" shortcut buttons:
  // - Cancel: show double-confirm directly
  // - Reschedule: go straight to "What new date would you like?"
  useEffect(() => {
    const apt = searchResults?.[0];
    if (!apt?._id) return;

    if (sessionData.intent === 'cancel_appointment' && sessionData.shortcutCancelFromMyBookings) {
      setSessionData(prev => ({ ...prev, shortcutCancelFromMyBookings: false }));
      handleSend('Cancel This Appointment');
    }

    if (sessionData.intent === 'reschedule_appointment' && sessionData.shortcutRescheduleFromMyBookings) {
      setSessionData(prev => ({ ...prev, shortcutRescheduleFromMyBookings: false }));
      handleSend('Reschedule This Appointment');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchResults, sessionData.intent, sessionData.shortcutCancelFromMyBookings, sessionData.shortcutRescheduleFromMyBookings]);

  useEffect(() => {
    setMessages([{
      id: 'welcome', isBot: true,
      text: "Welcome to Elite Wellness. I'm your private concierge. How may I assist you today?",
      nextStep: 'show_intent_buttons'
    }]);
  }, []);

  const handleSend = async (messageText) => {
    const textToSend = typeof messageText === 'string' ? messageText : input;
    // Local reset (always allowed, even while typing)
    if (textToSend === 'Main Menu') {
      setMessages([{
        id: 'welcome',
        isBot: true,
        text: "Welcome to Elite Wellness. I'm your private concierge. How may I assist you today?",
        nextStep: 'show_intent_buttons'
      }]);
      setSearchResults([]);
      setSessionData({});
      return;
    }

    if (!textToSend.trim() || isTyping) return;

    setMessages(prev => [...prev, { id: Date.now(), text: textToSend, isBot: false }]);
    setInput('');
    setIsTyping(true);

    try {
      const response = await chatAPI.sendMessage(sessionId, textToSend);
      const data = response.data;

      // Lookup triggers
      if (data.nextStep === 'show_booking_list' || data.nextStep === 'fetch_by_phone') {
        const phone = data.extractedData?.userPhone;
        if (phone) {
          try { const r = await appointmentAPI.findByPhone(phone); setSearchResults(r.data); }
          catch(e) { setSearchResults([]); }
        }
      }
      if (data.nextStep === 'fetch_by_id') {
        const bid = data.extractedData?.bookingId;
        if (bid) {
          try {
            const r = await appointmentAPI.findById(bid);
            setSearchResults([r.data]);
            // Make sure slot availability + reschedule confirmation have the right doctor context.
            if (r.data) {
              setSessionData(prev => ({
                ...prev,
                doctorId: r.data.doctorId,
                doctorName: r.data.doctorName,
                serviceCategory: r.data.serviceCategory,
                date: r.data.date,
                timeSlot: r.data.timeSlot,
                userName: r.data.userName,
              }));
            }
          }
          catch(e) { setSearchResults([]); }
        }
      }

      if (data.extractedData) setSessionData(prev => ({ ...prev, ...data.extractedData }));
      setMessages(prev => [...prev, { id: Date.now()+1, isBot: true, ...data }]);

    } catch(e) {
      setMessages(prev => [...prev, { id: Date.now()+1, isBot: true, text: 'I hit a snag. Please try again.' }]);
    } finally {
      setIsTyping(false);
    }
  };

  // Cancel appointment via API
  const doCancelAppointment = async (appointment) => {
    try {
      const id = appointment?._id;
      const bookingId = appointment?.bookingId;
      if (!id) return;
      await appointmentAPI.cancel(id);

      // If cancellation came from "My Bookings", refresh the list in-place (spec requirement).
      if (sessionData.cancelFromMyBookings && sessionData.userPhone) {
        const r = await appointmentAPI.findByPhone(sessionData.userPhone);
        setSearchResults(r.data || []);
        setSessionData(prev => ({
          ...prev,
          intent: 'my_bookings',
          cancelFromMyBookings: false,
        }));
        setMessages(prev => [
          ...prev,
          { id: Date.now(), isBot: true, nextStep: 'show_booking_list', responseMessage: 'Fetching your appointments...' }
        ]);
        return;
      }

      setMessages(prev => [
        ...prev,
        { id: Date.now(), isBot: true, action: 'cancellation_secured', extractedData: { bookingId } }
      ]);
      setSearchResults([]);
    } catch(e) { console.error(e); }
  };

  // UI option sets
  const intentOptions = [
    { text: "Book Appointment", icon: "📅" }, { text: "Check Availability", icon: "🔍" },
    { text: "Cancel Appointment", icon: "❌" }, { text: "Reschedule", icon: "🔄" },
    { text: "General Inquiry", icon: "💬" }, { text: "My Bookings", icon: "📋" }
  ];
  const serviceCategories = [
    { text: "Cardiology", icon: "🫀" }, { text: "Dental", icon: "🦷" }, { text: "Eye Care", icon: "👁️" },
    { text: "Neurology", icon: "🧠" }, { text: "Orthopedics", icon: "🦴" }, { text: "Salon", icon: "💇" }
  ];
  const lookupOptions = [
    { text: "I have my Booking ID", icon: "🔖" }, { text: "Search by Phone Number", icon: "📞" }
  ];
  const genderOptions = [{ text: "Male" }, { text: "Female" }, { text: "Other" }];
  const inquiryTopics = [
    { text: "Service Prices", icon: "💰" },
    { text: "Service Duration", icon: "⏱️" },
    { text: "Our Doctors", icon: "👨‍⚕️" },
    { text: "Working Hours", icon: "🕐" },
    { text: "Location & Contact", icon: "📍" },
    { text: "Something Else", icon: "❓" }
  ];
  const afterSlotsOptions = [
    { text: "Book a Slot", icon: "📅" }, { text: "Check Another Date", icon: "🔙" }
  ];

  const getInquiryCardType = (text = '') => {
    const t = text.toLowerCase();
    if (t.includes('price') || t.includes('service')) return 'prices';
    if (t.includes('hour') || t.includes('working')) return 'hours';
    if (t.includes('duration')) return 'duration';
    if (t.includes('doctor')) return 'doctors';
    return 'contact';
  };

  return (
    <div className="relative min-h-screen w-full flex overflow-hidden bg-slate-50 text-slate-800">
      <div className="mesh-bg" />
      <div className="flex-1 flex flex-col max-w-5xl mx-auto w-full relative z-10 lg:grid lg:grid-cols-[1fr_300px]">
        
        {/* Chat Column */}
        <div className="flex flex-col h-screen border-x border-slate-200/80 bg-white/60">
          <header className="px-8 py-6 flex items-center justify-between border-b border-slate-200/80 bg-white/80 backdrop-blur-md">
            <div className="relative">
              <div className="w-12 h-12 bg-blue-gradient rounded-2xl flex items-center justify-center blue-glow animate-float">
                <Bot className="text-white w-7 h-7" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-4 border-white rounded-full" />
            </div>
            <div className="flex-1 ml-4">
              <h1 className="font-bold text-xl text-slate-900">Elite Concierge</h1>
              <p className="text-xs text-blue-600 uppercase tracking-widest opacity-80">AI Receptionist</p>
            </div>

            <button
              type="button"
              onClick={() => handleSend('Main Menu')}
              className="hidden sm:inline-flex items-center justify-center px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold uppercase tracking-widest transition-colors"
              title="Return to Main Menu"
            >
              🔙 Main Menu
            </button>
          </header>

          <main className="flex-1 overflow-y-auto px-6 py-8 space-y-4 bg-transparent">
            <AnimatePresence>
              {messages.map((msg, idx) => {
                const isLatest = idx === messages.length - 1;
                const ns = msg.nextStep || '';
                const action = (msg.action || '').toLowerCase();

                return (
                  <motion.div key={msg.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                    {(msg.text || msg.responseMessage) && (
                      <MessageBubble message={msg.text || msg.responseMessage} isBot={msg.isBot} />
                    )}

                    {/* --- INTENT BUTTONS --- */}
                    {isLatest && msg.isBot && ns === 'show_intent_buttons' && (
                      <QuickReplies options={intentOptions} onSelect={handleSend} />
                    )}

                    {/* --- SERVICE CATEGORY BUTTONS --- */}
                    {isLatest && msg.isBot && (ns === 'show_service_buttons' || ns === 'ask_service_category') && (
                      <QuickReplies options={serviceCategories} onSelect={handleSend} />
                    )}

                    {/* --- LOOKUP METHOD (Cancel / Reschedule) --- */}
                    {isLatest && msg.isBot && ns === 'ask_lookup_method' && (
                      <QuickReplies options={lookupOptions} onSelect={handleSend} />
                    )}

                    {/* --- TOPICS (General Inquiry) --- */}
                    {isLatest && msg.isBot && ns === 'show_topics' && (
                      <QuickReplies options={inquiryTopics} onSelect={handleSend} />
                    )}

                    {/* --- AFTER FREEFORM INQUIRY --- */}
                    {isLatest && msg.isBot && ns === 'show_general_inquiry_end_buttons' && (
                      <QuickReplies
                        options={[
                          { text: 'Book Appointment', icon: '📅' },
                          { text: 'Main Menu', icon: '🔙' }
                        ]}
                        onSelect={handleSend}
                      />
                    )}

                    {/* --- GENDER OPTIONS --- */}
                    {isLatest && msg.isBot && ns === 'ask_gender' && (
                      <QuickReplies options={genderOptions} onSelect={handleSend} />
                    )}

                    {/* --- DOCTOR CARDS --- */}
                    {isLatest && msg.isBot && ns === 'show_doctor_cards' && (
                      <DoctorCardRow
                        category={sessionData.serviceCategory}
                        onSelect={(name, id) => {
                          setSessionData(prev => ({ ...prev, doctorName: name, doctorId: id }));
                          handleSend(`Select Specialist ${name}`);
                        }}
                      />
                    )}

                    {/* --- DOCTOR GROUPS (General inquiry) --- */}
                    {isLatest && msg.isBot && ns === 'show_doctor_groups' && (
                      <DoctorGroups onBookWithDoctor={() => handleSend('Book Appointment')} onMainMenu={() => handleSend('Main Menu')} />
                    )}

                    {/* --- SLOT GRID (BOOKING - clickable) --- */}
                    {isLatest && msg.isBot && ns === 'show_slots' && (
                      <SlotGrid
                        doctorId={sessionData.doctorId}
                        date={sessionData.date}
                        onSelect={(time) => handleSend(`Select ${time}`)}
                      />
                    )}

                    {/* --- SLOT GRID (AVAILABILITY - read only) --- */}
                    {isLatest && msg.isBot && ns === 'show_slots_readonly' && (
                      <div className="space-y-3">
                        <SlotGrid doctorId={sessionData.doctorId} date={sessionData.date} readOnly={true} />
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1 px-1">
                          Would you like to book one of these slots?
                        </p>
                        <div className="flex space-x-2">
                          <button onClick={() => handleSend("Book a Slot")} className="flex-1 py-3 bg-blue-gradient text-white text-[10px] font-bold rounded-xl">📅 Book a Slot</button>
                          <button onClick={() => handleSend("Check Another Date")} className="flex-1 py-3 bg-white text-slate-600 text-[10px] font-bold rounded-xl border border-slate-200 hover:bg-slate-50">🔙 Check Another Date</button>
                        </div>
                      </div>
                    )}

                    {/* --- RESCHEDULED SLOTS (RESCHEDULE flow) --- */}
                    {isLatest && msg.isBot && ns === 'show_slots_reschedule' && (
                      <SlotGrid
                        doctorId={sessionData.doctorId}
                        date={sessionData.date}
                        onSelect={(time) => handleSend(`Select ${time}`)}
                        readOnly={false}
                      />
                    )}

                    {/* --- CANCEL / RESCHEDULE LOOKUPS --- */}
                    {isLatest && msg.isBot && ns === 'fetch_by_id' && sessionData.intent === 'cancel_appointment' && (
                      searchResults?.[0] ? (
                        <AppointmentFoundCard
                          appointment={searchResults[0]}
                          mode="cancel"
                          onPrimaryAction={() => handleSend('Cancel This Appointment')}
                          onGoBack={() => handleSend('Cancel Appointment')}
                        />
                      ) : (
                        <AppointmentNotFoundCard
                          variant="bookingId"
                          bookingId={sessionData.bookingId}
                          onTryAgain={() => handleSend('Try Again')}
                          onSearchByPhone={() => handleSend('Search by Phone Number')}
                        />
                      )
                    )}

                    {isLatest && msg.isBot && ns === 'fetch_by_phone' && sessionData.intent === 'cancel_appointment' && (
                      (() => {
                        const list = (searchResults || []).filter(a => String(a.status).toLowerCase() !== 'cancelled');
                        if (!list.length) {
                          return (
                            <AppointmentNotFoundCard
                              variant="phone"
                              onTryAgain={() => handleSend('Try Again')}
                              onSearchByPhone={() => handleSend('Book Appointment')}
                            />
                          );
                        }
                        return (
                          <CancelAppointmentsMiniList
                            appointments={list}
                            onSelectCancel={(apt) => {
                              setSearchResults([apt]);
                              handleSend('Cancel This Appointment');
                            }}
                          />
                        );
                      })()
                    )}

                    {isLatest && msg.isBot && ns === 'fetch_by_phone' && sessionData.intent === 'reschedule_appointment' && (
                      (() => {
                        const list = (searchResults || []).filter(a => String(a.status).toLowerCase() !== 'cancelled');
                        if (!list.length) {
                          return (
                            <AppointmentNotFoundCard
                              variant="phone"
                              onTryAgain={() => handleSend('Try Again')}
                              onSearchByPhone={() => handleSend('Book Appointment')}
                            />
                          );
                        }
                        return (
                          <RescheduleAppointmentsMiniList
                            appointments={list}
                            onSelectReschedule={(apt) => {
                              setSearchResults([apt]);
                              setSessionData(prev => ({
                                ...prev,
                                doctorId: apt.doctorId,
                                doctorName: apt.doctorName,
                                serviceCategory: apt.serviceCategory,
                              }));
                              handleSend('Reschedule This Appointment');
                            }}
                          />
                        );
                      })()
                    )}

                    {isLatest && msg.isBot && ns === 'fetch_by_id' && sessionData.intent === 'reschedule_appointment' && (
                      searchResults?.[0] ? (
                        <AppointmentFoundCard
                          appointment={searchResults[0]}
                          mode="reschedule"
                          onPrimaryAction={() => handleSend('Reschedule This Appointment')}
                        />
                      ) : (
                        <AppointmentNotFoundCard
                          variant="bookingId"
                          bookingId={sessionData.bookingId}
                          onTryAgain={() => handleSend('Try Again')}
                          onSearchByPhone={() => handleSend('Search by Phone Number')}
                        />
                      )
                    )}

                    {/* --- MY BOOKINGS LIST --- */}
                    {isLatest && msg.isBot && ns === 'show_booking_list' && sessionData.intent === 'my_bookings' && (
                      <AppointmentListCard
                        appointments={searchResults}
                        onAction={handleSend}
                      />
                    )}

                    {/* --- INQUIRY INFO CARDS --- */}
                    {isLatest && msg.isBot && ns === 'show_info_card' && (
                      <InquiryCard type={getInquiryCardType(msg.text || msg.responseMessage)} onAction={handleSend} />
                    )}

                    {/* --- BOOKING CONFIRM CARD --- */}
                    {isLatest && action === 'confirm_booking' && (
                      <BookingConfirmCard
                        data={msg.extractedData}
                        onConfirm={() => handleSend('Confirm booking')}
                        // Keeps the user in the booking flow by restarting after edits.
                        onCancel={() => handleSend('Modify Details & Restart Flow')}
                      />
                    )}

                    {/* --- CANCELLATION CONFIRM CARD --- */}
                    {isLatest && action === 'confirm_cancellation' && (
                      <CancellationConfirmCard
                        appointment={searchResults[0] || msg.extractedData}
                        onConfirm={() => doCancelAppointment(searchResults[0] || msg.extractedData)}
                        variant={sessionData.cancelFromMyBookings ? 'myBookings' : 'default'}
                        onKeep={async () => {
                          if (sessionData.cancelFromMyBookings && sessionData.userPhone) {
                            const r = await appointmentAPI.findByPhone(sessionData.userPhone);
                            setSearchResults(r.data || []);
                            setSessionData(prev => ({
                              ...prev,
                              intent: 'my_bookings',
                              cancelFromMyBookings: false,
                            }));
                            setMessages(prev => [
                              ...prev,
                              { id: Date.now(), isBot: true, nextStep: 'show_booking_list', responseMessage: 'Fetching your appointments...' }
                            ]);
                            return;
                          }
                          handleSend('Main Menu');
                        }}
                      />
                    )}

                    {/* --- BOOKING DONE --- */}
                    {action === 'booking_confirmed' && (
                      <BookingConfirmCard data={msg.bookingData || msg.extractedData} isConfirmed={true} />
                    )}

                    {/* --- CANCELLATION SECURED --- */}
                    {isLatest && action === 'cancellation_secured' && (
                      <CancellationSuccessCard
                        bookingId={msg.extractedData?.bookingId}
                        onBookNew={() => handleSend('Book Appointment')}
                        onMainMenu={() => handleSend('Main Menu')}
                      />
                    )}

                    {/* --- RESCHEDULE CONFIRM --- */}
                    {isLatest && action === 'confirm_reschedule' && (
                      <RescheduleConfirmCard
                        oldData={searchResults?.[0] || msg.extractedData?.oldData}
                        newData={{
                          ...(msg.extractedData || {}),
                          date: sessionData.newDate,
                          timeSlot: sessionData.newTimeSlot,
                          userName: searchResults?.[0]?.userName
                        }}
                        onConfirm={async () => {
                          try {
                            const oldAppointment = searchResults?.[0] || msg.extractedData?.oldData;
                            if (!oldAppointment?._id) return;
                            const r = await appointmentAPI.reschedule(
                              oldAppointment._id,
                              sessionData.newDate,
                              sessionData.newTimeSlot
                            );
                            const newAppt = r.data?.newAppointment;
                            if (sessionData.rescheduleFromMyBookings && sessionData.userPhone) {
                              const pr = await appointmentAPI.findByPhone(sessionData.userPhone);
                              setSearchResults(pr.data || []);
                              setSessionData(prev => ({
                                ...prev,
                                intent: 'my_bookings',
                                rescheduleFromMyBookings: false,
                                newDate: null,
                                newTimeSlot: null,
                              }));
                              setMessages(prev => [
                                ...prev,
                                { id: Date.now(), isBot: true, nextStep: 'show_booking_list', responseMessage: 'Fetching your appointments...' }
                              ]);
                              return;
                            }

                            setMessages(prev => [
                              ...prev,
                              {
                                id: Date.now(),
                                isBot: true,
                                action: 'reschedule_secured',
                                extractedData: { oldData: oldAppointment, newData: newAppt }
                              }
                            ]);
                            setSearchResults([]);
                            // Clear reschedule-specific session data
                            setSessionData(prev => ({ ...prev, newDate: null, newTimeSlot: null }));
                          } catch (e) {
                            console.error(e);
                          }
                        }}
                        onCancel={() => handleSend('Choose Different Time')}
                      />
                    )}

                    {/* --- RESCHEDULE SECURED --- */}
                    {isLatest && action === 'reschedule_secured' && (
                      <RescheduleConfirmCard
                        isSuccess={true}
                        oldData={msg.extractedData?.oldData}
                        newData={msg.extractedData?.newData}
                      />
                    )}

                    {/* --- RESCHEDULE SECURED END BUTTON --- */}
                    {isLatest && action === 'reschedule_secured' && (
                      <QuickReplies options={[{ text: 'Main Menu', icon: '🔙' }]} onSelect={handleSend} />
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
            {isTyping && <TypingIndicator />}
            <div ref={chatEndRef} />
          </main>

          <footer className="p-6 bg-white/80 backdrop-blur-xl border-t border-slate-200/80">
            <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="glass-panel rounded-2xl flex items-center p-2 pr-4">
              <MessageSquare className="w-5 h-5 text-slate-400 ml-4" />
              <input
                type="text" value={input} onChange={(e) => setInput(e.target.value)}
                placeholder="Type your message..."
                className="flex-1 bg-transparent border-none focus:ring-0 px-4 py-3 text-slate-700 placeholder:text-slate-400 font-medium"
              />
              <button type="submit" disabled={!input.trim() || isTyping} className="w-11 h-11 bg-blue-gradient rounded-xl flex items-center justify-center">
                <Send className="text-white w-4 h-4" />
              </button>
            </form>
          </footer>
        </div>

        {/* Persistent corner Main Menu (mobile + always accessible) */}
        <button
          type="button"
          onClick={() => handleSend('Main Menu')}
          className="sm:hidden fixed right-4 bottom-20 z-50 px-4 py-3 rounded-2xl bg-white/95 backdrop-blur border border-slate-200 shadow-[0_18px_40px_rgba(15,23,42,0.10)] text-slate-700 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 active:scale-[0.99]"
          title="Return to Main Menu"
        >
          🔙 Main Menu
        </button>

        {/* Sidebar */}
        <aside className="hidden lg:flex flex-col h-screen bg-white/55 p-8 space-y-6 border-l border-slate-200/70">
          <div>
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Session</h3>
            <div className="glass-card p-4 rounded-2xl space-y-2 text-[11px]">
              {sessionData.intent && <p className="text-blue-600 font-bold uppercase">{sessionData.intent.replace(/_/g,' ')}</p>}
              {sessionData.serviceCategory && <p className="text-slate-800">{sessionData.serviceCategory}</p>}
              {sessionData.doctorName && <p className="text-slate-600">{sessionData.doctorName}</p>}
              {sessionData.date && <p className="text-slate-500">{sessionData.date}</p>}
              {sessionData.timeSlot && <p className="text-emerald-600 font-bold">{sessionData.timeSlot}</p>}
              {!sessionData.intent && <p className="text-slate-400 italic">Idle</p>}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default ChatPage;
