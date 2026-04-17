const aiService = require('../services/geminiService');
const sessionStore = require('../services/sessionStore');
const Service = require('../models/Service');
const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const { format, addDays } = require('date-fns');

/**
 * PRODUCTION CHAT CONTROLLER
 * Synchronizes Backend Logic with Frontend Success Cards.
 */
exports.handleChat = async (req, res, next) => {
  const { sessionId, message } = req.body;
  try {
    const session = sessionStore.getSession(sessionId);
    let services = [], doctors = [];
    if (global.isMongoConnected) { services = await Service.find({ isActive: true }); doctors = await Doctor.find({ isActive: true }); }
    if (services.length === 0) services = global.mockServices;
    if (doctors.length === 0) doctors = global.mockDoctors;

    const lower = message.toLowerCase();

    // AIService determines the next step and extracted data based on state machine
    const ai = await aiService.processUserMessage(message, session.conversationHistory, { ...session.extractedData, lastStep: session.lastStep, intent: session.intent }, services, doctors);

    // ── DATA FETCHING LOGIC ──
    if (ai.nextStep === 'show_booking_list' || ai.nextStep === 'fetch_by_phone') {
        const ph = ai.extractedData?.userPhone;
        if (ph) {
            let list = [];
            if (global.isMongoConnected) list = await Appointment.find({ userPhone: ph, status: 'confirmed' }).sort({ date: 1 });
            else list = global.mockAppointments.filter(x => x.userPhone === ph && x.status === 'confirmed');
            
            if (list.length === 0) { 
                const retryStep = (ai.intent === 'my_bookings' ? 'ask_phone' : (ai.intent === 'reschedule_appointment' ? 'ask_phone_reschedule' : 'ask_phone_cancel'));
                ai.nextStep = retryStep; ai.responseMessage = "I apologize, but no active records were found for that number. Could you please verify and retry?";
            } else if (list.length === 1 && ai.nextStep !== 'show_booking_list') { 
                ai.nextStep = 'show_found_card'; ai.appointment = list[0]; ai.extractedData.bookingId = list[0].bookingId; ai.extractedData.doctorName = list[0].doctorName;
            } else { ai.nextStep = 'show_booking_list'; ai.appointments = list; }
        }
    }

    if (ai.nextStep === 'fetch_by_id') {
        const id = ai.extractedData?.bookingId?.toUpperCase();
        if (id) {
            let a = null;
            if (global.isMongoConnected) a = await Appointment.findOne({ bookingId: id, status: 'confirmed' });
            else a = global.mockAppointments.find(x => x.bookingId === id && x.status === 'confirmed');
            if (!a) { ai.nextStep = 'ask_booking_id'; ai.responseMessage = "That Booking ID was not found. Please verify and retry."; }
            else { ai.nextStep = 'show_found_card'; ai.appointment = a; ai.extractedData.doctorName = a.doctorName; }
        }
    }

    // ── TERMINAL ACTIONS (Persistence & Frontend Token Mapping) ──
    const isConfirm = lower.includes('confirm') || lower.includes('yes');
    let isFinished = false;

    // A: Booking Completion
    if (ai.nextStep === 'booking_confirmed' && ai.action === 'confirm_booking') {
        const d = ai.extractedData;
        const bId = `APT-${Math.floor(1000 + Math.random() * 9000)}`;
        if (global.isMongoConnected) {
            const dateStr = d.date || format(new Date(), 'yyyy-MM-dd');
            const appointment = new Appointment({
              bookingId: bId, sessionId, service: d.serviceCategory || "Clinical Visit", serviceCategory: d.serviceCategory || "General",
              date: new Date(dateStr), timeSlot: d.timeSlot || "09:00 AM", userName: d.userName || "Guest", userPhone: d.userPhone || "0000000000",
              userAge: d.userAge, userGender: d.userGender, doctorName: d.doctorName, doctorId: d.doctorId, userEmail: d.userEmail, status: 'confirmed'
            });
            await appointment.save(); ai.bookingData = appointment;
        }
        ai.action = 'booking_confirmed'; // Map to frontend Success Card
        isFinished = true;
    }

    // B: Cancellation Completion
    if (ai.nextStep === 'booking_confirmed' && ai.action === 'cancellation_confirmed') {
        const bId = ai.extractedData?.bookingId;
        if (bId && global.isMongoConnected) await Appointment.findOneAndUpdate({ bookingId: bId }, { status: 'cancelled' });
        ai.action = 'cancellation_secured'; // Map to frontend Success Card
        isFinished = true;
    }

    // C: Reschedule Completion
    if (ai.nextStep === 'booking_confirmed' && ai.action === 'reschedule_confirmed') {
        const bId = ai.extractedData?.bookingId;
        const nDate = ai.extractedData.newDate;
        const nTime = ai.extractedData.newTimeSlot;
        if (bId && nDate && nTime) {
            let updated = null;
            if (global.isMongoConnected) updated = await Appointment.findOneAndUpdate({ bookingId: bId }, { date: new Date(nDate), timeSlot: nTime }, { new: true });
            ai.action = 'reschedule_secured'; // Map to frontend Success Card
            ai.extractedData.newData = updated;
        }
        isFinished = true;
    }

    // ── SESSION MANAGEMENT ──
    session.conversationHistory.push({ role: 'user', text: message }, { role: 'assistant', text: ai.responseMessage, isBot: true });
    
    if (isFinished) {
        sessionStore.updateSession(sessionId, { extractedData: {}, lastStep: null, intent: null });
    } else {
        sessionStore.updateSession(sessionId, { extractedData: ai.extractedData, intent: ai.intent, lastStep: ai.nextStep });
    }

    res.json(ai);
  } catch (err) { 
    console.error("FATAL ERROR:", err); 
    res.status(500).json({ responseMessage: "I encountered a snag while processing that. Could you please try again?" }); 
  }
};
