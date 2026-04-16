const { GoogleGenerativeAI } = require("@google/generative-ai");
const { format, addDays, getDay, parseISO } = require('date-fns');

/**
 * DETERMINISTIC STATE MACHINE - Premium Clinical Edition.
 * Prioritizes one-shot extraction, handles fuzzy intents, and manages robust session state.
 */

// ─────────────────────────────────────────────────────────────────────────────
// CORE STATE MACHINE
// ─────────────────────────────────────────────────────────────────────────────
function runStateMachine(userMessage, sessionData) {
    const msg = userMessage.toLowerCase().trim();
    const data = { ...sessionData };
    const last = sessionData.lastStep || '';
    let intent = sessionData.intent || '';

    // 1. TOP-LEVEL GLOBAL TRIGGERS (Interrupts any flow)
    const bookingId = extractBookingId(msg);
    if (bookingId && (msg.includes('cancel') || msg.includes('reschedule'))) {
        data.intent = msg.includes('cancel') ? 'cancel_appointment' : 'reschedule_appointment';
        data.bookingId = bookingId;
        data.lookupMethod = 'bookingId';
        return reply(data, 'fetch_by_id', `Locating appointment ${bookingId}...`);
    }

    // Global Reset Buttons & Keywords
    if (msg === 'main menu' || msg === 'restart' || msg === 'back to menu') {
        return { intent: null, nextStep: 'show_intent_buttons', responseMessage: "Main Menu. How else can I help?" };
    }

    // Direct Intent Triggers
    const isBooking = (msg.includes('book') || msg.includes('schedule') || msg.includes('reserve') || msg.includes('appointment')) && !msg.includes('cancel') && !msg.includes('reschedule');
    if (isBooking) return startBooking(data);
    if (msg.includes('check availability') || msg.includes('is open') || msg.includes('any slot')) return startAvailability(data);
    if (msg.includes('cancel') && (msg.includes('appointment') || msg.includes('booking'))) return startCancel(data);
    if (msg.includes('reschedule') || msg.includes('change time')) return startReschedule(data);
    if (msg.includes('my bookings') || msg.includes('my appointment')) return startMyBookings(data);
    if (msg.includes('general inquiry') || msg.includes('hours') || msg.includes('location') || msg.includes('pricing')) return startInquiry(data);

    // ── CANCEL FLOW ────────────────────────────────────────────────────────────
    if (intent === 'cancel_appointment') {
        if (last === 'ask_lookup_method') {
            if (msg.includes('phone')) { data.lookupMethod = 'phone'; return reply(data, 'ask_phone_cancel', 'Please enter your registered phone number:'); }
            if (msg.includes('id') || msg.includes('booking')) { data.lookupMethod = 'bookingId'; return reply(data, 'ask_booking_id', 'Please enter your Booking ID (e.g. APT-9281):'); }
        }
        if (last === 'ask_phone_cancel') {
            const phone = msg.replace(/\D/g, '');
            if (phone.length >= 10) { data.userPhone = phone; return reply(data, 'fetch_by_phone', 'Searching for appointments linked to this number...'); }
            return reply(data, 'ask_phone_cancel', 'Please provide a valid 10-digit phone number:');
        }
        if (last === 'ask_booking_id') { data.bookingId = userMessage.trim().toUpperCase(); return reply(data, 'fetch_by_id', 'Searching for your ID...'); }
        if (last === 'fetch_by_id' || last === 'fetch_by_phone') {
             if (msg.includes('yes') || msg.includes('cancel')) return reply(data, 'confirm_cancel_final', '', 'confirm_cancellation');
        }
        if (last === 'confirm_cancel_final') {
             if (msg.includes('yes') || msg.includes('confirm')) return reply(data, 'cancelled', 'Success. Your appointment has been cancelled.', 'cancellation_confirmed');
             return reply(data, 'show_intent_buttons', 'Kept your appointment! What else do you need?');
        }
        return reply(data, 'ask_lookup_method', 'How would you like to find your appointment?');
    }

    // ── RESCHEDULE FLOW ─────────────────────────────────────────────────────────
    if (intent === 'reschedule_appointment') {
        if (last === 'ask_lookup_method') {
             if (msg.includes('phone')) { data.lookupMethod = 'phone'; return reply(data, 'ask_phone_reschedule', 'Enter your registered phone number:'); }
             if (msg.includes('id')) { data.lookupMethod = 'bookingId'; return reply(data, 'ask_booking_id_reschedule', 'Enter your Booking ID:'); }
        }
        if (last === 'ask_phone_reschedule' || last === 'ask_booking_id_reschedule') {
             // Handle entry and move to fetch
        }
        if (last === 'fetch_by_id' || last === 'fetch_by_phone' || last === 'show_found_card') {
             if (msg.includes('reschedule')) return reply(data, 'ask_new_date', 'What new date would you like?');
        }
        if (last === 'ask_new_date') {
             const d = detectDate(msg);
             if (d) { data.newDate = d; data.date = d; return reply(data, 'show_slots_reschedule', `Slots for ${data.doctorName || 'Dr. Arjun Mehta'} on ${d}:`); }
        }
        if (last === 'show_slots_reschedule') {
             const t = extractTime(msg);
             if (t) { data.newTimeSlot = t; return reply(data, 'show_reschedule_confirm', '', 'confirm_reschedule'); }
        }
        return reply(data, 'ask_lookup_method', 'How would you like to locate your appointment?');
    }

    // ── GENERAL INQUIRY FLOW ──────────────────────────────────────────────────────
    if (intent === 'general_inquiry') {
        if (msg.includes('prices') || msg.includes('cost')) return reply({ ...data, inquiryCardType: 'prices' }, 'show_info_card', 'Pricing details:');
        if (msg.includes('duration') || msg.includes('time')) return reply({ ...data, inquiryCardType: 'duration' }, 'show_info_card', 'Service durations:');
        if (msg.includes('doctor')) return reply(data, 'show_doctor_groups', 'Our Specialists:');
        if (msg.includes('hours') || msg.includes('open')) return reply(data, 'show_info_card', 'Opening hours:');
        if (msg.includes('location') || msg.includes('where')) return reply(data, 'show_info_card', 'Our Location:');
        return reply(data, 'show_topics', 'How can I assist you with information today?');
    }

    // ── BOOK APPOINTMENT FLOW ─────────────────────────────────────────────────────
    if (intent === 'book_appointment') {
        // Step 1: Specialty
        if (!data.serviceCategory) {
            data.serviceCategory = extractCategory(msg);
            if (data.serviceCategory) return reply(data, 'show_doctor_cards', `Please select your specialist for ${data.serviceCategory}.`);
            return reply(data, 'show_service_buttons', 'Which medical specialty would you like to book?');
        }

        // Step 2: Doctor
        const t = extractTime(msg);
        const isDocMsg = (msg.includes('select') || msg.includes('dr.') || msg.includes('doc')) && !t;
        if (data.serviceCategory && (!data.doctorName || isDocMsg)) {
            const dn = userMessage.replace(/select specialist|select|specialist|dr\.|doc/gi, '').trim();
            if (dn.length > 3 && !extractTime(dn)) {
                data.doctorName = dn;
                return reply(data, 'ask_date', `Great. Which date would you like to visit ${dn}?`);
            }
            if (!data.doctorName) return reply(data, 'show_doctor_cards', `Please choose a specialist for ${data.serviceCategory}:`);
        }

        // Step 3: Date
        if (data.doctorName && !data.date) {
            const d = detectDate(msg);
            if (d) {
                data.date = d;
                return reply(data, 'show_slots', `Perfect. Pick a time slot for ${data.doctorName} on ${d}:`);
            }
            return reply(data, 'ask_date', `Which date for ${data.doctorName}? (e.g. Tomorrow)`);
        }

        // Step 4: Time Slot
        if (data.date && !data.timeSlot) {
            const tm = extractTime(msg);
            if (tm) {
                data.timeSlot = tm;
                return reply(data, 'ask_name', `Reserved ${tm}. May I have the patient's full name?`);
            }
            return reply(data, 'show_slots', `Please pick a time for ${data.date}:`);
        }

        // Step 5: Name
        if (data.timeSlot && !data.userName) {
            const name = userMessage.replace(/my name is|i am|this is|patient is/gi, '').trim();
            if (name.length > 2 && !msg.includes('select')) {
                data.userName = name;
                return reply(data, 'ask_phone', `Thank you, ${name}. What is your contact phone number?`);
            }
            return reply(data, 'ask_name', "What is the patient's full name correctly?");
        }

        // Step 6: Phone
        if (data.userName && !data.userPhone) {
            const phone = msg.replace(/\D/g, '');
            if (phone.length >= 10) {
                data.userPhone = phone;
                return reply(data, 'ask_email', "And your email address for confirmation?");
            }
            return reply(data, 'ask_phone', "Please provide a valid 10-digit phone number:");
        }

        // Step 7: Email
        if (data.userPhone && !data.userEmail) {
            const email = userMessage.trim();
            if (email.includes('@') && email.includes('.')) {
                data.userEmail = email;
                return reply(data, 'confirm_booking', "Ready to confirm! Review your details below:", 'confirm_booking');
            }
            return reply(data, 'ask_email', "Please provide a valid email address:");
        }

        return reply(data, 'confirm_booking', "Please review and confirm your booking details:", 'confirm_booking');
    }

    return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function reply(data, nextStep, message, action = null, overrideIntent = null) {
    return {
        intent: overrideIntent || data.intent,
        nextStep,
        action,
        extractedData: data,
        responseMessage: message,
        lastStep: nextStep
    };
}

function resetFlowData(data) {
    Object.keys(data).forEach(k => { if (typeof data[k] !== 'boolean') data[k] = null; else data[k] = false; });
    return data;
}

function startBooking(data)      { resetFlowData(data); data.intent='book_appointment'; return reply(data,'show_service_buttons','Which specialty would you like to book?'); }
function startAvailability(data) { resetFlowData(data); data.intent='check_availability'; return reply(data,'show_service_buttons','Which specialty check availability?'); }
function startCancel(data)       { resetFlowData(data); data.intent='cancel_appointment'; return reply(data,'ask_lookup_method','How would you like to find your appointment?'); }
function startReschedule(data)   { resetFlowData(data); data.intent='reschedule_appointment'; return reply(data,'ask_lookup_method','How find appointment to reschedule?'); }
function startInquiry(data)      { resetFlowData(data); data.intent='general_inquiry'; return reply(data,'show_topics','What would you like to know?'); }
function startMyBookings(data)   { resetFlowData(data); data.intent='my_bookings'; return reply(data,'ask_phone','Enter your phone number:'); }

function extractCategory(msg) {
    const cats = { cardiology:'Cardiology', dental:'Dental', eye:'Eye Care', neuro:'Neurology', ortho:'Orthopedics' };
    for (const [k, v] of Object.entries(cats)) { if (msg.includes(k)) return v; }
    return null;
}

function extractTime(msg) {
    const m = msg.match(/(\d+):00\s*(am|pm)/i) || msg.match(/(\d+)\s*(am|pm)/i);
    return m ? m[0].toUpperCase().replace(/\s+/, '') : null;
}

function detectDate(msg) {
    const now = new Date();
    const currentYear = now.getFullYear();
    const lower = msg.toLowerCase();

    if (lower.includes('tomorrow')) return format(addDays(now, 1), 'yyyy-MM-dd');
    if (lower.includes('today')) return format(now, 'yyyy-MM-dd');

    const iso = lower.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
    if (iso) return iso[0];

    // Month + Day (e.g., April 20)
    const months = ['january','february','march','april','may','june','july','august','september','october','november','december'];
    for (let i = 0; i < months.length; i++) {
        if (lower.includes(months[i])) {
            const dayMatch = lower.match(new RegExp(`${months[i]}\\s+(\\d{1,2})`));
            if (dayMatch) return `${currentYear}-${String(i + 1).padStart(2, '0')}-${String(dayMatch[1]).padStart(2, '0')}`;
        }
    }

    const weekdays = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
    const wd = weekdays.find(d => lower.includes(d));
    if (wd) {
        const target = weekdays.indexOf(wd);
        const curr = now.getDay();
        let diff = (target - curr + 7) % 7;
        if (diff === 0 && !lower.includes('this')) diff = 7;
        return format(addDays(now, diff), 'yyyy-MM-dd');
    }
    return null;
}

function extractBookingId(text) {
    const m = text.match(/\b(apt-\d{3,6})\b/i);
    return m ? m[1].toUpperCase() : null;
}

async function callAI(userMessage, conversationHistory, sessionData, services, doctors) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_1;
    if (!apiKey) return null;
    try {
        const genAI = new GoogleGenerativeAI(apiKey.trim());
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
        const chat = model.startChat({ history: [] });
        const prompt = `Clinic AI. Answer JSON {intent,nextStep,action,extractedData,responseMessage}. User:${userMessage} Data:${JSON.stringify(sessionData)}`;
        const result = await chat.sendMessage(prompt);
        const text = result.response.text();
        const s = text.indexOf('{'), e = text.lastIndexOf('}');
        return s !== -1 ? JSON.parse(text.substring(s, e + 1)) : null;
    } catch { return null; }
}

exports.processUserMessage = async (userMessage, conversationHistory, sessionData, services = [], doctors = []) => {
    const machine = runStateMachine(userMessage, sessionData);
    if (machine) { machine.lastStep = machine.nextStep; return machine; }

    const ai = await callAI(userMessage, conversationHistory, sessionData, services, doctors);
    if (ai && ai.responseMessage) { ai.lastStep = ai.nextStep; return ai; }

    return { intent: sessionData.intent || 'book_appointment', nextStep: 'show_intent_buttons', responseMessage: 'How can I assist you with your clinic needs today?', extractedData: sessionData, lastStep: 'show_intent_buttons' };
};