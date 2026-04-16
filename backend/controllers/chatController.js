const aiService = require('../services/geminiService');
const sessionStore = require('../services/sessionStore');
const Service = require('../models/Service');
const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const { format, addDays } = require('date-fns');

// ─────────────────────────────────────────────────────────────────────────────
// SMART ONE-SHOT EXTRACTION
// ─────────────────────────────────────────────────────────────────────────────
function smartExtractBooking(message) {
  const msg = message.toLowerCase().trim();
  if (msg.startsWith('my') || msg.includes('cancel') || msg.includes('reschedule') || msg.includes('availability') || msg.length < 5) return null;
  const hasBookingIntent = msg.includes('book') || msg.includes('appointment');
  const catMap = { 'cardio': 'Cardiology', 'dent': 'Dental', 'eye': 'Eye Care', 'neuro': 'Neurology', 'ortho': 'Orthopedics' };
  let cat = null;
  for (const [k, v] of Object.entries(catMap)) { if (msg.includes(k)) { cat = v; break; } }
  if (!cat && !hasBookingIntent) return null;
  const res = { serviceCategory: cat }; const now = new Date();
  if (msg.includes('tomorrow')) res.date = format(addDays(now, 1), 'yyyy-MM-dd');
  else if (msg.includes('today')) res.date = format(now, 'yyyy-MM-dd');
  const tm = msg.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i) || msg.match(/(\d{1,2})\s*(am|pm)/i);
  if (tm) res.requestedTime = `${tm[1]}:00 ${tm[3] || tm[2]}`.toUpperCase();
  const nm = message.match(/(?:patient\s+named?|named?\s+|patient\s+is\s+|name\s+is\s+|for\s+)([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)/);
  if (nm) res.userName = nm[1].trim();
  const ag = msg.match(/(?:age|aged?)\s*(\d{1,3})/); if (ag) res.userAge = ag[1];
  if (msg.includes('female')) res.userGender = 'Female'; else if (msg.includes(' male')) res.userGender = 'Male';
  const ph = msg.match(/\b(\d[\d\s\-]{8,14}\d)\b/); if (ph) res.userPhone = ph[1].replace(/\D/g, '').slice(-10);
  const em = message.match(/[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}/); if (em) res.userEmail = em[0];
  return res;
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

    // 1. One-Shot Extraction (Only if not already in a specific flow)
    if (!session.intent && !session.lastStep) {
        const os = smartExtractBooking(message);
        if (os && os.serviceCategory) {
            os.intent = 'book_appointment';
            const sDocs = doctors.filter(d => d.serviceCategory === os.serviceCategory);
            if (sDocs.length > 0) {
                const doc = sDocs[0]; os.doctorName = doc.name; os.doctorId = doc._id.toString();
                if (os.date && os.requestedTime) {
                    os.timeSlot = os.requestedTime;
                    sessionStore.updateSession(sessionId, { extractedData: os, intent: 'book_appointment', lastStep: 'confirm_booking' });
                    return res.json({ intent:'book_appointment', nextStep:'confirm_booking', action:'confirm_booking', extractedData:os, responseMessage:`I've prepared a summary for Dr. ${os.doctorName} on ${os.date} at ${os.timeSlot}. Shall I book it?` });
                }
                sessionStore.updateSession(sessionId, { extractedData: os, intent: 'book_appointment', lastStep: 'ask_date' });
                return res.json({ intent:'book_appointment', nextStep:'ask_date', extractedData:os, responseMessage:`Splendid. Which date for Dr. ${os.doctorName}?` });
            }
        }
    }

    const ai = await aiService.processUserMessage(message, session.conversationHistory, { ...session.extractedData, lastStep: session.lastStep, intent: session.intent }, services, doctors);

    // FETCHING LOGIC
    if (ai.nextStep === 'show_booking_list' || ai.nextStep === 'fetch_by_phone') {
        const ph = ai.extractedData?.userPhone;
        if (ph) {
            let list = [];
            if (global.isMongoConnected) list = await Appointment.find({ userPhone: ph, status: 'confirmed' }).sort({ date: 1 });
            else list = global.mockAppointments.filter(x => x.userPhone === ph && x.status === 'confirmed');
            if (list.length === 0) { ai.nextStep = (ai.intent === 'my_bookings' ? 'ask_phone' : 'ask_phone_cancel'); ai.responseMessage = "No active appointments found. Please check the number."; }
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
            if (!a) { ai.nextStep = 'ask_booking_id'; ai.responseMessage = "That ID was not found."; }
            else { ai.nextStep = 'show_found_card'; ai.appointment = a; ai.extractedData.doctorName = a.doctorName; }
        }
    }

    // TERMINAL ACTIONS
    const isConfirm = lower.includes('confirm') || lower.includes('yes');
    if (ai.action === 'confirm_booking' && isConfirm) {
        const d = ai.extractedData;
        const bId = `APT-${Math.floor(1000 + Math.random() * 9000)}`;
        if (global.isMongoConnected) {
            const dateStr = d.date || format(new Date(), 'yyyy-MM-dd');
            // FIX: Pass ALL required fields to Appointment constructor
            const a = new Appointment({
              bookingId: bId,
              service: d.serviceCategory || "Clinical Consult", // Required
              serviceCategory: d.serviceCategory || "General", // Required
              date: new Date(dateStr), // Required
              timeSlot: d.timeSlot || "09:00 AM", // Required
              userName: d.userName || "Guest", // Required
              userPhone: d.userPhone || "0000000000", // Required
              userAge: d.userAge,
              userGender: d.userGender,
              doctorName: d.doctorName,
              doctorId: d.doctorId,
              userEmail: d.userEmail,
              sessionId: sessionId, // Required
              status: 'confirmed'
            });
            await a.save(); ai.bookingData = a;
        }
        ai.action = "booking_confirmed"; ai.responseMessage = `Your visit with Dr. ${d.doctorName} is successfully secured. Ref: ${bId}.`;
        sessionStore.updateSession(sessionId, { extractedData: {}, lastStep: null, intent: null });
    }

    if (ai.action === 'confirm_cancellation' && isConfirm) {
        const bId = ai.extractedData?.bookingId;
        if (bId && global.isMongoConnected) await Appointment.findOneAndUpdate({ bookingId: bId }, { status: 'cancelled' });
        ai.action = "cancellation_confirmed"; ai.responseMessage = "Appointment successfully cancelled.";
        sessionStore.updateSession(sessionId, { extractedData: {}, lastStep: null, intent: null });
    }

    if (ai.action === 'confirm_reschedule' && isConfirm) {
        const bId = ai.extractedData?.bookingId;
        if (bId && ai.extractedData.newDate && ai.extractedData.newTimeSlot) {
            if (global.isMongoConnected) await Appointment.findOneAndUpdate({ bookingId: bId }, { date: new Date(ai.extractedData.newDate), timeSlot: ai.extractedData.newTimeSlot });
            ai.action = "reschedule_confirmed"; ai.responseMessage = `Appointment moved to ${ai.extractedData.newDate}.`;
            sessionStore.updateSession(sessionId, { extractedData: {}, lastStep: null, intent: null });
        }
    }

    session.conversationHistory.push({ role: 'user', text: message }, { role: 'assistant', text: ai.responseMessage, isBot: true });
    sessionStore.updateSession(sessionId, { extractedData: ai.extractedData, intent: ai.intent, lastStep: ai.nextStep });
    res.json(ai);
  } catch (err) { console.error("CRITICAL ERROR:", err); res.status(500).json({ responseMessage: "Snag hit. Please try one more time." }); }
};
