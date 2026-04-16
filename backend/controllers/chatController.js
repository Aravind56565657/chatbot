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
                    return res.json({ intent:'book_appointment', nextStep:'confirm_booking', action:'confirm_booking', extractedData:os, responseMessage:`Summary for Dr. ${os.doctorName} on ${os.date} at ${os.timeSlot}:` });
                }
                sessionStore.updateSession(sessionId, { extractedData: os, intent: 'book_appointment', lastStep: 'ask_date' });
                return res.json({ intent:'book_appointment', nextStep:'ask_date', extractedData:os, responseMessage:`Which date for Dr. ${os.doctorName}?` });
            }
        }
    }

    const ai = await aiService.processUserMessage(message, session.conversationHistory, { ...session.extractedData, lastStep: session.lastStep, intent: session.intent }, services, doctors);

    // DATA RETRIEVAL LOGIC
    if (ai.nextStep === 'show_booking_list' || ai.nextStep === 'fetch_by_phone') {
        const ph = ai.extractedData?.userPhone;
        if (ph) {
            let appts = [];
            if (global.isMongoConnected) appts = await Appointment.find({ userPhone: ph, status: 'confirmed' }).sort({ date: 1 });
            else appts = global.mockAppointments.filter(a => a.userPhone === ph && a.status === 'confirmed');
            
            if (appts.length === 0) { 
                if (ai.nextStep === 'show_booking_list' || ai.intent === 'my_bookings') { ai.nextStep = 'ask_phone'; ai.responseMessage = "No appointments found. Double-check your number?"; }
                else if (ai.intent === 'reschedule_appointment') { ai.nextStep = 'ask_phone_reschedule'; ai.responseMessage = "No appointments found."; }
                else { ai.nextStep = 'ask_phone_cancel'; ai.responseMessage = "No appointments found."; }
            }
            else if (appts.length === 1 && ai.nextStep !== 'show_booking_list') { ai.nextStep = 'show_found_card'; ai.appointment = appts[0]; ai.extractedData.bookingId = appts[0].bookingId; ai.extractedData.doctorName = appts[0].doctorName; }
            else { ai.nextStep = 'show_booking_list'; ai.appointments = appts; }
        }
    }

    if (ai.nextStep === 'fetch_by_id') {
        const id = ai.extractedData?.bookingId?.toUpperCase();
        if (id) {
            let a = null;
            if (global.isMongoConnected) a = await Appointment.findOne({ bookingId: id, status: 'confirmed' });
            else a = global.mockAppointments.find(x => x.bookingId === id && x.status === 'confirmed');
            if (!a) { ai.nextStep = (ai.intent === 'reschedule_appointment') ? 'ask_booking_id_reschedule' : 'ask_booking_id'; ai.responseMessage = "ID not found. Verify and retry."; }
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
            const appointment = new Appointment({ ...d, bookingId: bId, date: new Date(dateStr) });
            await appointment.save(); ai.bookingData = appointment;
        }
        ai.action = "booking_confirmed"; ai.responseMessage = `Visit with Dr. ${d.doctorName} secured. Ref: ${bId}.`;
        sessionStore.updateSession(sessionId, { extractedData: {}, lastStep: null, intent: null });
    }

    if (ai.action === 'confirm_cancellation' && isConfirm) {
        const bId = ai.extractedData?.bookingId;
        if (bId && global.isMongoConnected) await Appointment.findOneAndUpdate({ bookingId: bId }, { status: 'cancelled' });
        ai.action = "cancellation_confirmed"; ai.responseMessage = "Appointment cancelled.";
        sessionStore.updateSession(sessionId, { extractedData: {}, lastStep: null, intent: null });
    }

    if (ai.action === 'confirm_reschedule' && isConfirm) {
        const bId = ai.extractedData?.bookingId;
        if (bId && ai.extractedData.newDate && ai.extractedData.newTimeSlot) {
            if (global.isMongoConnected) await Appointment.findOneAndUpdate({ bookingId: bId }, { date: new Date(ai.extractedData.newDate), timeSlot: ai.extractedData.newTimeSlot });
            ai.action = "reschedule_confirmed"; ai.responseMessage = `Visit moved to ${ai.extractedData.newDate} at ${ai.extractedData.newTimeSlot}.`;
            sessionStore.updateSession(sessionId, { extractedData: {}, lastStep: null, intent: null });
        }
    }

    session.conversationHistory.push({ role: 'user', text: message }, { role: 'assistant', text: ai.responseMessage, isBot: true });
    sessionStore.updateSession(sessionId, { extractedData: ai.extractedData, intent: ai.intent, lastStep: ai.nextStep });
    res.json(ai);
  } catch (err) { console.error(err); res.status(500).json({ responseMessage: "Snag hit. Retry?" }); }
};
