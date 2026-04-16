const aiService = require('../services/geminiService');
const sessionStore = require('../services/sessionStore');
const Service = require('../models/Service');
const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const { format, addDays } = require('date-fns');

// ─────────────────────────────────────────────────────────────────────────────
// MAIN CHAT HANDLER
// ─────────────────────────────────────────────────────────────────────────────
exports.handleChat = async (req, res, next) => {
  const { sessionId, message } = req.body;
  try {
    const session = sessionStore.getSession(sessionId);
    let services = [], doctors = [];
    if (global.isMongoConnected) { services = await Service.find({ isActive: true }); doctors = await Doctor.find({ isActive: true }); }
    if (services.length === 0) services = global.mockServices;
    if (doctors.length === 0) doctors = global.mockDoctors;

    const lower = message.toLowerCase();

    // 1. One-Shot Extraction Override (Bypass AIService for clean multi-field input)
    // Removed specific one-shot block here to let AIService handle it via 'extractFieldsFromMessage' for better spec alignment

    const ai = await aiService.processUserMessage(message, session.conversationHistory, { ...session.extractedData, lastStep: session.lastStep, intent: session.intent }, services, doctors);

    // FETCHING LOGIC (Matching Spec Names)
    if (ai.nextStep === 'show_booking_list' || ai.nextStep === 'fetch_by_phone') {
        const ph = ai.extractedData?.userPhone;
        if (ph) {
            let list = [];
            if (global.isMongoConnected) list = await Appointment.find({ userPhone: ph, status: 'confirmed' }).sort({ date: 1 });
            else list = global.mockAppointments.filter(x => x.userPhone === ph && x.status === 'confirmed');
            
            if (list.length === 0) { 
                const retryStep = (ai.intent === 'my_bookings' ? 'ask_phone' : (ai.intent === 'reschedule_appointment' ? 'ask_phone_reschedule' : 'ask_phone_cancel'));
                ai.nextStep = retryStep; ai.responseMessage = "I apologize, but I couldn't find any active appointments for that number. Could you please check it again?";
            }
            else if (list.length === 1 && ai.nextStep !== 'show_booking_list') { ai.nextStep = 'show_found_card'; ai.appointment = list[0]; ai.extractedData.bookingId = list[0].bookingId; ai.extractedData.doctorName = list[0].doctorName; }
            else { ai.nextStep = 'show_booking_list'; ai.appointments = list; }
        }
    }

    if (ai.nextStep === 'fetch_by_id') {
        const id = ai.extractedData?.bookingId?.toUpperCase();
        if (id) {
            let a = null;
            if (global.isMongoConnected) a = await Appointment.findOne({ bookingId: id, status: 'confirmed' });
            else a = global.mockAppointments.find(x => x.bookingId === id && x.status === 'confirmed');
            if (!a) { ai.nextStep = 'ask_booking_id'; ai.responseMessage = "That Booking ID was not found in our records. Please verify and retry."; }
            else { ai.nextStep = 'show_found_card'; ai.appointment = a; ai.extractedData.doctorName = a.doctorName; }
        }
    }

    // TERMINAL ACTIONS (Matching Spec Names: show_confirm_card -> booking_confirmed)
    const isConfirm = lower.includes('confirm') || lower.includes('yes');
    
    // NEW SPEC STEP: show_confirm_card is for summary, booking_confirmed is for result
    // When ai service returns 'booking_confirmed', we execute the save
    if (ai.nextStep === 'booking_confirmed' && ai.action === 'confirm_booking') {
        const d = ai.extractedData;
        const bId = `APT-${Math.floor(1000 + Math.random() * 9000)}`;
        if (global.isMongoConnected) {
            const dateStr = d.date || format(new Date(), 'yyyy-MM-dd');
            const appointment = new Appointment({
              bookingId: bId,
              service: d.serviceCategory || "Clinical Consult",
              serviceCategory: d.serviceCategory || "General",
              date: new Date(dateStr),
              timeSlot: d.timeSlot || "09:00 AM",
              userName: d.userName || "Guest",
              userPhone: d.userPhone || "0000000000",
              userAge: d.userAge,
              userGender: d.userGender,
              doctorName: d.doctorName,
              doctorId: d.doctorId,
              userEmail: d.userEmail,
              sessionId: sessionId,
              status: 'confirmed'
            });
            await appointment.save(); ai.bookingData = appointment;
        }
        sessionStore.updateSession(sessionId, { extractedData: {}, lastStep: null, intent: null });
    }

    // Cancellation (Strict ID use)
    if (ai.nextStep === 'booking_confirmed' && ai.action === 'cancellation_confirmed') {
        const bId = ai.extractedData?.bookingId;
        if (bId && global.isMongoConnected) await Appointment.findOneAndUpdate({ bookingId: bId }, { status: 'cancelled' });
        sessionStore.updateSession(sessionId, { extractedData: {}, lastStep: null, intent: null });
    }

    session.conversationHistory.push({ role: 'user', text: message }, { role: 'assistant', text: ai.responseMessage, isBot: true });
    sessionStore.updateSession(sessionId, { extractedData: ai.extractedData, intent: ai.intent, lastStep: ai.nextStep });
    res.json(ai);
  } catch (err) { console.error(err); res.status(500).json({ responseMessage: "I encountered a snag while processing that request. Could we try one more time?" }); }
};
