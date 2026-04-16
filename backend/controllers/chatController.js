const aiService = require('../services/geminiService');
const sessionStore = require('../services/sessionStore');
const Service = require('../models/Service');
const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const { format, addDays } = require('date-fns');

// ─────────────────────────────────────────────────────────────────────────────
// SMART ONE-SHOT EXTRACTION (Stricter & Smarter)
// ─────────────────────────────────────────────────────────────────────────────
function smartExtractBooking(message) {
  const msg = message.toLowerCase().trim();

  // If message is obviously a search or lookup, skip extraction
  if (msg.startsWith('my') || msg.includes('cancel') || msg.includes('reschedule') || msg.length < 5) return null;

  const hasBookingIntent = msg.includes('book') || msg.includes('appointment') || msg.includes('schedule') || msg.includes('reserve');
  
  const categoryMap = { 'cardio': 'Cardiology', 'heart': 'Cardiology', 'dent': 'Dental', 'tooth': 'Dental', 'eye': 'Eye Care', 'neuro': 'Neurology', 'ortho': 'Orthopedics' };
  let detectedCategory = null;
  for (const [k, v] of Object.entries(categoryMap)) { if (msg.includes(k)) { detectedCategory = v; break; } }

  if (!detectedCategory && !hasBookingIntent) return null;

  const result = { serviceCategory: detectedCategory };
  const now = new Date();
  if (msg.includes('tomorrow')) result.date = format(addDays(now, 1), 'yyyy-MM-dd');
  else if (msg.includes('today')) result.date = format(now, 'yyyy-MM-dd');

  const tMatch = msg.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i) || msg.match(/(\d{1,2})\s*(am|pm)/i);
  if (tMatch) result.requestedTime = `${tMatch[1]}:00 ${tMatch[3] || tMatch[2]}`.toUpperCase();

  const nMatch = message.match(/(?:patient\s+named?|named?\s+|patient\s+is\s+|name\s+is\s+|for\s+)([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)/);
  if (nMatch) result.userName = nMatch[1].trim();

  const aMatch = msg.match(/(?:age|aged?)\s*(\d{1,3})/);
  if (aMatch) result.userAge = aMatch[1];

  if (msg.includes('female')) result.userGender = 'Female';
  else if (msg.includes(' male')) result.userGender = 'Male';

  const pMatch = msg.match(/\b(\d[\d\s\-]{8,14}\d)\b/);
  if (pMatch) result.userPhone = pMatch[1].replace(/\D/g, '').slice(-10);

  const eMatch = message.match(/[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}/);
  if (eMatch) result.userEmail = eMatch[0];

  return result;
}

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

    // 1. Check for Override/Restart
    if (lower.includes('main menu') || lower.includes('restart') || lower.includes('start over')) {
      sessionStore.updateSession(sessionId, { extractedData: {}, lastStep: null, intent: null });
      return res.json({ intent: null, nextStep: 'show_intent_buttons', responseMessage: "Welcome back! I've cleared your session. How may I assist you today?" });
    }

    // 2. One-Shot Extraction (Only if not already in a specific flow)
    if (!session.intent && !session.lastStep) {
        const os = smartExtractBooking(message);
        if (os && os.serviceCategory) {
            os.intent = 'book_appointment';
            const sDocs = doctors.filter(d => d.serviceCategory === os.serviceCategory);
            if (sDocs.length > 0) {
                const doc = sDocs[0]; // Take first, don't randomize to avoid confusion
                os.doctorName = doc.name; os.doctorId = doc._id.toString();
                if (os.date && os.requestedTime) {
                    os.timeSlot = os.requestedTime;
                    sessionStore.updateSession(sessionId, { extractedData: os, intent: 'book_appointment', lastStep: 'confirm_booking' });
                    return res.json({ intent:'book_appointment', nextStep:'confirm_booking', action:'confirm_booking', extractedData:os, responseMessage:`Certainly. I've prepared a summary for Dr. ${os.doctorName} on ${os.date} at ${os.timeSlot}. Please review:` });
                }
                sessionStore.updateSession(sessionId, { extractedData: os, intent: 'book_appointment', lastStep: 'ask_date' });
                return res.json({ intent:'book_appointment', nextStep:'ask_date', extractedData:os, responseMessage:`Gladly. Which date would you like to request for Dr. ${os.doctorName}?` });
            }
        }
    }

    // 3. AIService Core logic
    const ai = await aiService.processUserMessage(message, session.conversationHistory, { ...session.extractedData, lastStep: session.lastStep, intent: session.intent }, services, doctors);

    // 4. DATA RETRIEVAL LOGIC (Post-Machine)
    // --- MY BOOKINGS ---
    if (ai.nextStep === 'show_booking_list') {
        const phone = ai.extractedData?.userPhone;
        if (phone) {
            if (global.isMongoConnected) ai.appointments = await Appointment.find({ userPhone: phone, status: 'confirmed' }).sort({ date: 1 });
            else ai.appointments = global.mockAppointments.filter(a => a.userPhone === phone && a.status === 'confirmed');
            if (!ai.appointments?.length) ai.responseMessage = "I apologize, but I couldn't find any confirmed appointments linked to that phone number.";
        }
    }

    // --- CANCEL/RESCHEDULE FETCH ---
    if (ai.nextStep === 'fetch_by_phone') {
        const phone = ai.extractedData?.userPhone;
        if (phone) {
            let appts = [];
            if (global.isMongoConnected) appts = await Appointment.find({ userPhone: phone, status: 'confirmed' }).sort({ date: 1 });
            else appts = global.mockAppointments.filter(a => a.userPhone === phone && a.status === 'confirmed');
            
            if (appts.length === 0) { ai.nextStep = 'ask_phone_cancel'; ai.responseMessage = "I'm sorry, no active appointments found for that number. Could you please double-check the number?"; }
            else if (appts.length === 1) { ai.nextStep = 'show_found_card'; ai.appointment = appts[0]; ai.extractedData.bookingId = appts[0].bookingId; }
            else { ai.nextStep = 'show_booking_list'; ai.appointments = appts; }
        }
    }

    if (ai.nextStep === 'fetch_by_id') {
        const bId = ai.extractedData?.bookingId?.toUpperCase();
        if (bId) {
            let appt = null;
            if (global.isMongoConnected) appt = await Appointment.findOne({ bookingId: bId, status: 'confirmed' });
            else appt = global.mockAppointments.find(a => a.bookingId === bId && a.status === 'confirmed');

            if (!appt) { ai.nextStep = 'ask_booking_id'; ai.responseMessage = "That ID does not appear in our records. Please verify your Booking ID and try again."; }
            else { ai.nextStep = 'show_found_card'; ai.appointment = appt; ai.extractedData.doctorName = appt.doctorName; }
        }
    }

    // 5. TERMINAL ACTIONS (Confirmations)
    if (ai.action === 'confirm_booking' && (lower.includes('confirm') || lower.includes('yes'))) {
        const d = ai.extractedData;
        const bId = `APT-${Math.floor(1000 + Math.random() * 9000)}`;
        if (global.isMongoConnected) {
            const a = new Appointment({ ...d, bookingId: bId, date: new Date(d.date), status: 'confirmed' });
            await a.save(); ai.bookingData = a;
        }
        ai.action = "booking_confirmed";
        ai.responseMessage = `Excellent. Your visit with Dr. ${d.doctorName} is secured. Ref: ${bId}.`;
        sessionStore.updateSession(sessionId, { extractedData: {}, lastStep: null, intent: null });
    }

    if (ai.action === 'confirm_cancellation' && (lower.includes('confirm') || lower.includes('yes'))) {
        const bId = ai.extractedData?.bookingId;
        if (bId && global.isMongoConnected) await Appointment.findOneAndUpdate({ bookingId: bId }, { status: 'cancelled' });
        ai.action = "cancellation_confirmed";
        ai.responseMessage = "Confirmed. I have successfully removed that visit from our clinical schedule.";
        sessionStore.updateSession(sessionId, { extractedData: {}, lastStep: null, intent: null });
    }

    if (ai.action === 'confirm_reschedule' && (lower.includes('confirm') || lower.includes('yes'))) {
        const bId = ai.extractedData?.bookingId;
        if (bId && ai.extractedData.newDate && ai.extractedData.newTimeSlot) {
            if (global.isMongoConnected) await Appointment.findOneAndUpdate({ bookingId: bId }, { date: new Date(ai.extractedData.newDate), timeSlot: ai.extractedData.newTimeSlot });
            ai.action = "reschedule_confirmed";
            ai.responseMessage = `Splendid. Your visit has been moved to ${ai.extractedData.newDate} at ${ai.extractedData.newTimeSlot}.`;
            sessionStore.updateSession(sessionId, { extractedData: {}, lastStep: null, intent: null });
        }
    }

    // Update session and respond
    session.conversationHistory.push({ role: 'user', text: message }, { role: 'assistant', text: ai.responseMessage, isBot: true });
    sessionStore.updateSession(sessionId, { extractedData: ai.extractedData, intent: ai.intent, lastStep: ai.nextStep });
    res.json(ai);
  } catch (err) { res.status(500).json({ responseMessage: "An error occurred. How may I retry?" }); }
};
