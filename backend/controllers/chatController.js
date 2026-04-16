const aiService = require('../services/geminiService');
const sessionStore = require('../services/sessionStore');
const Service = require('../models/Service');
const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const { format, addDays } = require('date-fns');

// ─────────────────────────────────────────────────────────────────────────────
// SMART ONE-SHOT EXTRACTION
// Parses a verbose user message for all booking fields at once.
// Returns null if this doesn't look like a one-shot booking request.
// ─────────────────────────────────────────────────────────────────────────────
function smartExtractBooking(message) {
  const msg = message.toLowerCase();

  // Robust Intent Detection
  const hasBookingIntent = msg.includes('book') || msg.includes('appointment') ||
                           msg.includes('schedule') || msg.includes('reserve') ||
                           msg.includes('see a') || msg.includes('need a');
  
  // Categorical Keywords
  const categoryMap = {
    'cardio': 'Cardiology',
    'heart': 'Cardiology',
    'dent': 'Dental',
    'tooth': 'Dental',
    'teeth': 'Dental',
    'eye': 'Eye Care',
    'opht': 'Eye Care',
    'vision': 'Eye Care',
    'neuro': 'Neurology',
    'brain': 'Neurology',
    'ortho': 'Orthopedics',
    'bone': 'Orthopedics',
    'joint': 'Orthopedics'
  };

  let detectedCategory = null;
  for (const [key, val] of Object.entries(categoryMap)) {
    if (msg.includes(key)) {
      detectedCategory = val;
      break;
    }
  }

  // If we have a category, we assume booking intent if none was clear
  if (!detectedCategory && !hasBookingIntent) return null;

  const result = { serviceCategory: detectedCategory };

  // ── Date (handles typos like tommorow) ──────────────────────────────────
  const now = new Date();
  if (msg.includes('tomorrow') || msg.includes('tommorow') || msg.includes('tomoro')) {
     result.date = format(addDays(now, 1), 'yyyy-MM-dd');
  } else if (msg.includes('today')) {
    result.date = format(now, 'yyyy-MM-dd');
  } else {
    // ... search for month names etc
    const months = ['january','february','march','april','may','june','july','august','september','october','november','december'];
    for (let i = 0; i < months.length; i++) {
      if (msg.includes(months[i])) {
        const dayMatch = msg.match(new RegExp(`${months[i]}\\s+(\\d{1,2})`))?.[1] || msg.match(/\d+/)?.[0];
        if (dayMatch) result.date = `${now.getFullYear()}-${String(i+1).padStart(2,'0')}-${String(dayMatch).padStart(2,'0')}`;
        break;
      }
    }
  }

  // ── Time ──────────────────────────────────────────────────────────────────
  const timeMatch = msg.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i) || msg.match(/(\d{1,2})\s*(am|pm)/i);
  if (timeMatch) {
    const hour = parseInt(timeMatch[1]);
    const period = (timeMatch[3] || timeMatch[2]).toUpperCase();
    result.requestedTime = `${hour}:00 ${period}`;
  }


  // ── Patient name ──────────────────────────────────────────────────────────
  // "named X", "patient X", "name is X", "patient named X"
  const nameMatch = message.match(
    /(?:patient\s+named?|named?\s+|patient\s+is\s+|name\s+is\s+|for\s+patient\s+|for\s+)([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)/
  );
  if (nameMatch) result.userName = nameMatch[1].trim();

  // ── Age ───────────────────────────────────────────────────────────────────
  const ageMatch = msg.match(/(?:age|aged?)\s*(\d{1,3})/);
  if (ageMatch) result.userAge = ageMatch[1];

  // ── Gender ────────────────────────────────────────────────────────────────
  if (msg.includes('female'))      result.userGender = 'Female';
  else if (msg.includes(' male'))  result.userGender = 'Male';
  else if (msg.includes('other'))  result.userGender = 'Other';

  // ── Phone ─────────────────────────────────────────────────────────────────
  const phoneMatch = msg.match(/\b(\d[\d\s\-]{8,14}\d)\b/);
  if (phoneMatch) {
    const digits = phoneMatch[1].replace(/\D/g, '');
    if (digits.length >= 10) result.userPhone = digits.slice(-10);
  }

  // ── Email ─────────────────────────────────────────────────────────────────
  const emailMatch = message.match(/[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) result.userEmail = emailMatch[0];

  // Need at least a category + date to proceed intelligently
  if (!result.serviceCategory && !result.date) return null;

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN CHAT HANDLER
// ─────────────────────────────────────────────────────────────────────────────
exports.handleChat = async (req, res, next) => {
  const { sessionId, message } = req.body;

  try {
    const session = sessionStore.getSession(sessionId);

    let services = [];
    let doctors = [];
    if (global.isMongoConnected) {
      services = await Service.find({ isActive: true });
      doctors = await Doctor.find({ isActive: true });
    }

    // Fallback to mock data if DB is empty or disconnected
    if (services.length === 0) services = global.mockServices;
    if (doctors.length === 0)  doctors  = global.mockDoctors;

    const lowerMessage = message.toLowerCase();

    // ── BACKEND SESSION RESET (Main Menu) ──────────────────────────────────
    if (lowerMessage === 'main menu' || lowerMessage === 'restart' || lowerMessage === 'restart session') {
      sessionStore.updateSession(sessionId, { extractedData: {}, lastStep: null, intent: null });
      return res.json({
        intent: null,
        nextStep: 'show_intent_buttons',
        responseMessage: "Welcome back! What would you like to do now?"
      });
    }

    // ── SMART ONE-SHOT BOOKING ──────────────────────────────────────────────
    // Check for "One-Shot" even if session has an intent, to allow "overriding" with new data.
    const oneShotData = smartExtractBooking(message);

    if (oneShotData && (Object.keys(oneShotData).length > 2 || oneShotData.serviceCategory)) {
        oneShotData.intent = 'book_appointment';

        // 1. Pick a doctor for the requested specialty
        let chosenDoctor = null;
        if (oneShotData.serviceCategory) {
          const specialtyDoctors = doctors.filter(d =>
            d.serviceCategory === oneShotData.serviceCategory ||
            d.specialization === oneShotData.serviceCategory ||
            (d.specialization && d.specialization.includes(oneShotData.serviceCategory))
          );
          if (specialtyDoctors.length > 0) {
            chosenDoctor = specialtyDoctors[Math.floor(Math.random() * specialtyDoctors.length)];
            oneShotData.doctorName = chosenDoctor.name;
            oneShotData.doctorId   = chosenDoctor._id.toString();
          }
        }

        // 2. If we have category + date + time + doctor → Check availability
        if (oneShotData.date && chosenDoctor && oneShotData.requestedTime) {
          let takenSlots = [];
          if (global.isMongoConnected) {
             const existing = await Appointment.find({
               doctorId: oneShotData.doctorId,
               date: {
                 $gte: new Date(`${oneShotData.date}T00:00:00.000Z`),
                 $lte: new Date(`${oneShotData.date}T23:59:59.999Z`),
               },
               status: { $ne: 'cancelled' }
             });
             takenSlots = existing.map(a => a.timeSlot);
          }

          const isSlotAvailable = !takenSlots.includes(oneShotData.requestedTime);
          if (isSlotAvailable) {
            oneShotData.timeSlot = oneShotData.requestedTime;
            sessionStore.updateSession(sessionId, { extractedData: oneShotData, intent: 'book_appointment', lastStep: 'confirm_booking' });
            session.conversationHistory.push({ role: 'user', text: message }, { role: 'assistant', text: "Summary shown.", isBot: true });
            return res.json({
              intent: 'book_appointment', nextStep: 'confirm_booking', action: 'confirm_booking',
              extractedData: oneShotData, responseMessage: `Understood! I've prepared a booking summary for ${oneShotData.doctorName} on ${oneShotData.date} at ${oneShotData.timeSlot}. Please confirm:`
            });
          } else {
             sessionStore.updateSession(sessionId, { extractedData: oneShotData, intent: 'book_appointment', lastStep: 'show_slots' });
             session.conversationHistory.push({ role: 'user', text: message }, { role: 'assistant', text: "Slot busy.", isBot: true });
             return res.json({
               intent: 'book_appointment', nextStep: 'show_slots', action: null,
               extractedData: oneShotData, responseMessage: `The ${oneShotData.requestedTime} slot is busy. Here are other available slots for ${oneShotData.doctorName} on ${oneShotData.date}:`
             });
          }
        }

        // 3. Category + Date but NO Time/Doctor? → Show slots
        if (oneShotData.date && chosenDoctor) {
            sessionStore.updateSession(sessionId, { extractedData: oneShotData, intent: 'book_appointment', lastStep: 'show_slots' });
            session.conversationHistory.push({ role: 'user', text: message }, { role: 'assistant', text: "Slots shown.", isBot: true });
            return res.json({
              intent: 'book_appointment', nextStep: 'show_slots', action: null,
              extractedData: oneShotData, responseMessage: `Got it. Please pick a time for ${oneShotData.doctorName} on ${oneShotData.date}:`
            });
        }

        // 4. Have Category but NO Doctor? → Show doctors
        if (oneShotData.serviceCategory) {
            sessionStore.updateSession(sessionId, { extractedData: oneShotData, intent: 'book_appointment', lastStep: 'show_doctor_cards' });
            session.conversationHistory.push({ role: 'user', text: message }, { role: 'assistant', isBot: true });
            return res.json({
              intent: 'book_appointment', nextStep: 'show_doctor_cards', action: null,
              extractedData: oneShotData, responseMessage: `Excellent! Which Cardiology specialist would you like to consult with?`
            });
        }

        // 5. General Booking Intent? (but no details)
        sessionStore.updateSession(sessionId, { extractedData: oneShotData, intent: 'book_appointment', lastStep: 'show_service_buttons' });
        session.conversationHistory.push({ role: 'user', text: message }, { role: 'assistant', isBot: true });
        return res.json({
            intent: 'book_appointment', nextStep: 'show_service_buttons', action: null,
            extractedData: oneShotData, responseMessage: "Happy to help! Which medical specialty do you need an appointment for?"
        });
    }

    // ── STANDARD FLOW → State Machine + AI ─────────────────────────────────
    const aiResponse = await aiService.processUserMessage(
      message,
      session.conversationHistory,
      { ...session.extractedData, lastStep: session.lastStep, intent: session.intent },
      services,
      doctors
    );

    // DEBUG LOG
    console.log("------------------- AI DEBUG -------------------");
    console.log("INTENT:", aiResponse.intent);
    console.log("ACTION:", aiResponse.action);
    console.log("NEXT STEP:", aiResponse.nextStep);
    console.log("------------------------------------------------");

    // Save history
    session.conversationHistory.push({ role: 'user', text: message });
    session.conversationHistory.push({ role: 'assistant', text: aiResponse.responseMessage, isBot: true });

    // Update session
    sessionStore.updateSession(sessionId, {
      extractedData: { ...session.extractedData, ...aiResponse.extractedData },
      intent: aiResponse.intent,
      lastStep: aiResponse.nextStep
    });

    const updatedSession = sessionStore.getSession(sessionId);

    // Modification reset
    if (lowerMessage.includes("modify") || lowerMessage.includes("restart") || lowerMessage.includes("change")) {
      sessionStore.updateSession(sessionId, { extractedData: {}, lastStep: null });
      aiResponse.responseMessage = "I've cleared your details. Let's start over. Which specialty would you like to book?";
      aiResponse.nextStep = "show_service_buttons";
      return res.json(aiResponse);
    }

    const confirmationKeywords = ['yes', 'confirm', 'sure', 'book', 'fine', 'okay', 'correct', 'right', 'cancel it', 'proceed'];
    const isConfirming = confirmationKeywords.some(kw => lowerMessage.includes(kw));

    const shouldBook = (aiResponse.action === "booking_confirmed") ||
                      (aiResponse.action === "confirm_booking" && isConfirming);

    const shouldCancel = (aiResponse.action === "cancellation_confirmed") ||
                        (aiResponse.action === "confirm_cancellation" && isConfirming);

    if (shouldBook) {
      const data = updatedSession.extractedData;
      const bookingId = `APT-${Math.floor(1000 + Math.random() * 9000)}`;

      if (global.isMongoConnected) {
        const appointment = new Appointment({
          bookingId,
          service: data.serviceCategory || "General Consult",
          serviceCategory: data.serviceCategory || "General",
          date: new Date(data.date || new Date()),
          timeSlot: data.timeSlot || "09:00 AM",
          userName: data.userName || "Guest",
          userPhone: data.userPhone || "0000000000",
          userAge: data.userAge,
          userGender: data.userGender,
          doctorName: data.doctorName,
          doctorId: data.doctorId,
          userEmail: data.userEmail,
          sessionId: sessionId,
          status: 'confirmed'
        });

        await appointment.save();
        aiResponse.bookingData = appointment;
      }
      aiResponse.action = "booking_confirmed";
      aiResponse.responseMessage = `Excellent! Your appointment with ${data.doctorName} is successfully secured. Ref: ${bookingId}.`;
      sessionStore.updateSession(sessionId, { extractedData: {}, lastStep: null });
    }

    if (shouldCancel) {
      if (global.isMongoConnected) {
        const phone = updatedSession.extractedData?.userPhone;
        if (phone) {
          await Appointment.deleteMany({ userPhone: phone, status: 'confirmed' });
        }
      }
      aiResponse.action = "cancellation_confirmed";
      aiResponse.responseMessage = "Your appointment has been successfully removed from our records.";
      sessionStore.updateSession(sessionId, { extractedData: {}, lastStep: null });
    }

    res.json(aiResponse);
  } catch (err) {
    console.error("Chat Error:", err);
    res.status(500).json({ responseMessage: "I encountered an error. Could we try that again?" });
  }
};
