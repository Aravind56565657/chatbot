const { GoogleGenerativeAI } = require("@google/generative-ai");
const { format, addDays } = require('date-fns');

/**
 * Deterministic State Machine — AI is a fallback, NOT the primary driver.
 * lastStep + intent in sessionData are the source of truth.
 */

// ─────────────────────────────────────────────────────────────────────────────
// DETERMINISTIC STATE MACHINE (runs FIRST, before any AI call)
// ─────────────────────────────────────────────────────────────────────────────
function runStateMachine(userMessage, sessionData) {
    const msg  = userMessage.toLowerCase().trim();
    const data = { ...sessionData };
    const last = sessionData.lastStep || '';
    let   intent = sessionData.intent || '';

    // ── TOP-LEVEL INTENT TRIGGERS (always override mid-flow) ──────────────────
    const bookingId = extractBookingId(msg);
    if (bookingId) {
        if (msg.includes('cancel')) {
            data.intent = 'cancel_appointment';
            data.bookingId = bookingId;
            data.lookupMethod = 'bookingId';
            return reply(data, 'fetch_by_id', 'Looking up your appointment...');
        }
        if (msg.includes('reschedule')) {
            data.intent = 'reschedule_appointment';
            data.bookingId = bookingId;
            data.lookupMethod = 'bookingId';
            return reply(data, 'fetch_by_id', 'Looking up your appointment...');
        }
    }

    const isBooking = msg.includes('book') || msg.includes('schedule') || msg.includes('reserve');
    const isAppt    = msg.includes('appointment') || msg.includes('slot') || msg.includes('see a doctor');
    
    if (isBooking && isAppt) return startBooking(data);
    if (msg.includes('check availability') || msg.includes('is open') || msg.includes('any slot')) return startAvailability(data);
    if (msg.includes('cancel appointment') || msg.includes('cancel my')) return startCancel(data);
    if (msg.includes('reschedule'))         return startReschedule(data);
    if (msg.includes('general inquiry') || msg.includes('have a question'))    return startInquiry(data);
    if (msg.includes('my bookings') || msg.includes('my appointment'))        return startMyBookings(data);

    // ── CANCEL FLOW ────────────────────────────────────────────────────────────
    if (intent === 'cancel_appointment') {
        if (last === 'ask_lookup_method') {
            if (msg.includes('phone') || msg.includes('search by phone')) {
                data.lookupMethod = 'phone';
                return reply(data, 'ask_phone_cancel', 'Please enter your registered phone number');
            }
            if (msg.includes('booking id') || msg.includes('id') || msg.includes('i have my')) {
                data.lookupMethod = 'bookingId';
                return reply(data, 'ask_booking_id', 'Please enter your Booking ID (e.g. APT-9281)');
            }
        }
        if (last === 'ask_phone_cancel') {
            const phone = msg.replace(/\D/g, '');
            if (phone.length >= 10) {
                data.userPhone = phone;
                return reply(data, 'fetch_by_phone', 'Looking up your appointment...');
            }
            return reply(data, 'ask_phone_cancel', 'Please enter a valid 10-digit phone number');
        }
        if (last === 'ask_booking_id') {
            data.bookingId = userMessage.trim().toUpperCase();
            return reply(data, 'fetch_by_id', 'Looking up your appointment...');
        }
        if (last === 'fetch_by_id') {
            if (msg.includes('try again')) return reply(data, 'ask_booking_id', 'Please enter your Booking ID (e.g. APT-9281)');
            if (msg.includes('phone') || msg.includes('search by phone')) { data.lookupMethod = 'phone'; return reply(data, 'ask_phone_cancel', 'Please enter your registered phone number'); }
        }
        if (last === 'fetch_by_phone') {
            if (msg.includes('try again')) return reply(data, 'ask_phone_cancel', 'Please enter your registered phone number');
            if (msg.includes('book new appointment')) return reply(data, 'show_intent_buttons', 'Sure! Let\'s book a new appointment.');
        }
        if (last === 'show_found_card' || last === 'fetch_by_phone' || last === 'fetch_by_id') {
            if (msg.includes('yes') || msg.includes('confirm') || msg.includes('cancel')) {
                return reply(data, 'confirm_cancel_final', '', 'confirm_cancellation');
            }
        }
        if (last === 'confirm_cancel_final') {
            if (msg.includes('yes') || msg.includes('confirm') || msg.includes('cancel')) {
                return reply(data, 'cancelled', 'Your appointment has been cancelled.', 'cancellation_confirmed');
            }
            return reply(data, 'show_intent_buttons', 'Kept your appointment. How else can I help?');
        }
        return reply(data, 'ask_lookup_method', 'How would you like to find your appointment?');
    }

    // ── RESCHEDULE FLOW ────────────────────────────────────────────────────────
    if (intent === 'reschedule_appointment') {
        if (last === 'ask_lookup_method') {
            if (msg.includes('phone') || msg.includes('search by phone')) {
                data.lookupMethod = 'phone';
                return reply(data, 'ask_phone_reschedule', 'Please enter your registered phone number');
            }
            if (msg.includes('id') || msg.includes('booking') || msg.includes('i have my')) {
                data.lookupMethod = 'bookingId';
                return reply(data, 'ask_booking_id_reschedule', 'Please enter your Booking ID (e.g. APT-9281)');
            }
        }
        if (last === 'ask_phone_reschedule') {
            const phone = msg.replace(/\D/g, '');
            if (phone.length >= 10) { data.userPhone = phone; return reply(data, 'fetch_by_phone', 'Looking up your appointments...'); }
        }
        if (last === 'ask_booking_id_reschedule') {
            if (msg.includes('try again')) return reply(data, 'ask_booking_id_reschedule', 'Please enter your Booking ID (e.g. APT-9281)');
            data.bookingId = userMessage.trim().toUpperCase();
            return reply(data, 'fetch_by_id', 'Looking up your appointment...');
        }
        if (last === 'fetch_by_id' || last === 'fetch_by_phone') {
            if (msg.includes('reschedule')) return reply(data, 'ask_new_date', 'What new date would you like?');
        }
        if (last === 'ask_new_date') {
            const d = detectDate(msg);
            if (d) { data.newDate = d; data.date = d; return reply(data, 'show_slots_reschedule', `Slots for ${data.doctorName || 'your doctor'} on ${d}:`); }
        }
        if (last === 'show_slots_reschedule') {
            const t = extractTime(msg);
            if (t) { data.newTimeSlot = t; return reply(data, 'show_reschedule_confirm', '', 'confirm_reschedule'); }
        }
        return reply(data, 'ask_lookup_method', 'How would you like to find your appointment?');
    }

    // ── MY BOOKINGS FLOW ───────────────────────────────────────────────────────
    if (intent === 'my_bookings') {
        if (last === 'ask_phone') {
            const phone = msg.replace(/\D/g, '');
            if (phone.length >= 10) { data.userPhone = phone; return reply(data, 'show_booking_list', 'Fetching your appointments...'); }
            return reply(data, 'ask_phone', 'Please enter a valid 10-digit phone number:');
        }
        return reply(data, 'ask_phone', 'Please enter your registered phone number to view your bookings:');
    }

    // ── GENERAL INQUIRY FLOW ───────────────────────────────────────────────────
    if (intent === 'general_inquiry') {
        if (last === 'ask_freeform_inquiry') return null;
        if (msg.includes('prices')) return reply({ ...data, inquiryCardType: 'prices' }, 'show_info_card', 'Our Service Prices:');
        if (msg.includes('duration')) return reply({ ...data, inquiryCardType: 'duration' }, 'show_info_card', 'Our Service Duration:');
        if (msg.includes('doctor') && msg.includes('our')) return reply(data, 'show_doctor_groups', 'Our Doctors');
        if (msg.includes('hours') || msg.includes('timing')) return reply(data, 'show_info_card', 'Our Working Hours:');
        if (msg.includes('location') || msg.includes('contact')) return reply(data, 'show_info_card', 'Our Location & Contact:');
        if (msg.includes('something else')) return reply(data, 'ask_freeform_inquiry', "Sure! Type your question and I'll do my best to answer.");
        return reply(data, 'show_topics', 'Happy to help! What would you like to know?');
    }

    // ── CHECK AVAILABILITY FLOW ────────────────────────────────────────────────
    if (intent === 'check_availability') {
        if (!data.serviceCategory) {
            data.serviceCategory = extractCategory(msg);
            if (data.serviceCategory) return reply(data, 'show_doctor_cards', 'Which doctor would you like to check?');
            return reply(data, 'show_service_buttons', 'Which specialty would you like to check?');
        }
        if (!data.doctorName || msg.includes('select')) {
            const dn = userMessage.replace(/select specialist|select|specialist/gi, '').trim();
            if (dn.length > 3 && !extractTime(dn)) { data.doctorName = dn; return reply(data, 'ask_date', `Which date for ${dn}?`); }
        }
        if (data.doctorName && !data.date) {
            const d = detectDate(msg);
            if (d) { data.date = d; return reply(data, 'show_slots_readonly', ''); }
            return reply(data, 'ask_date', 'Which date? (e.g., Tomorrow)');
        }
        return reply(data, 'show_service_buttons', 'Which specialty?');
    }

    // ── BOOK APPOINTMENT FLOW ──────────────────────────────────────────────────
    if (intent === 'book_appointment') {
        // Step 1: Category
        if (!data.serviceCategory) {
            data.serviceCategory = extractCategory(msg);
            if (data.serviceCategory) return reply(data, 'show_doctor_cards', `Excellent. Please select your specialist for ${data.serviceCategory}.`);
            return reply(data, 'show_service_buttons', 'Which specialty would you like to book?');
        }

        // Step 2: Doctor
        const looksLikeTime = extractTime(msg);
        const isSelectingDoc = (msg.includes('select') || msg.includes('specialist') || msg.includes('dr.')) && !looksLikeTime;
        if (data.serviceCategory && (!data.doctorName || isSelectingDoc)) {
            const docName = userMessage.replace(/select specialist|select|specialist/gi, '').trim();
            if (docName.length > 3 && !extractTime(docName)) {
                data.doctorName = docName;
                return reply(data, 'ask_date', `Great. Which date would you like to see ${docName}?`);
            }
            if (!data.doctorName) return reply(data, 'show_doctor_cards', `Please select your specialist for ${data.serviceCategory}.`);
        }

        // Step 3: Date
        if (data.doctorName && !data.date) {
            const d = detectDate(msg);
            if (d) { data.date = d; return reply(data, 'show_slots', `Perfect. Please pick a time slot for ${data.doctorName} on ${d}:`); }
            return reply(data, 'ask_date', `Which date for ${data.doctorName}?`);
        }

        // Step 4: Time Slot
        if (data.date && !data.timeSlot) {
            const t = extractTime(msg);
            if (t) { data.timeSlot = t; return reply(data, 'ask_name', `Your slot at ${t} is reserved. May I have your full name?`); }
            return reply(data, 'show_slots', `Please pick a slot for ${data.date}:`);
        }

        // Step 5: Name
        if (data.timeSlot && !data.userName) {
             const name = userMessage.replace(/my name is|i am|this is|name is/gi, '').trim();
             if (name.length > 2 && !msg.includes('select')) { data.userName = name; return reply(data, 'ask_phone', `Thank you, ${name}. What is your phone number?`); }
             return reply(data, 'ask_name', "May I have your full name for the booking?");
        }

        // Step 6: Phone
        if (data.userName && !data.userPhone) {
            const phone = msg.replace(/\D/g, '');
            if (phone.length >= 10) { data.userPhone = phone; return reply(data, 'ask_email', "Great. And your email address?"); }
            return reply(data, 'ask_phone', "Please provide a valid 10-digit phone number:");
        }

        // Step 7: Email
        if (data.userPhone && !data.userEmail) {
            const email = userMessage.trim();
            if (email.includes('@') && email.includes('.')) { data.userEmail = email; return reply(data, 'confirm_booking', "Excellent! We're all set. Please confirm your summary:", 'confirm_booking'); }
            return reply(data, 'ask_email', "Please provide a valid email address:");
        }

        return reply(data, 'confirm_booking', "I've gathered your details! Please confirm below:", 'confirm_booking');
    }

    return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function reply(data, nextStep, message, action = null, overrideIntent = null) {
    return { intent: overrideIntent || data.intent, nextStep, action, extractedData: data, responseMessage: message, lastStep: nextStep };
}

function resetFlowData(data) {
    data.service = data.serviceCategory = data.date = data.timeSlot = data.userName = data.userAge = data.userGender = data.userPhone = data.userEmail = data.notes = data.bookingId = data.lookupMethod = data.newDate = data.newTimeSlot = data.doctorName = data.doctorId = data.inquiryCardType = null;
    data.shortcutCancelFromMyBookings = data.cancelFromMyBookings = data.shortcutRescheduleFromMyBookings = data.rescheduleFromMyBookings = false;
    return data;
}

function startBooking(data)      { resetFlowData(data); data.intent='book_appointment'; return reply(data,'show_service_buttons','Which specialty would you like to book?'); }
function startAvailability(data) { resetFlowData(data); data.intent='check_availability'; return reply(data,'show_service_buttons','Sure! Which specialty would you like to check availability for?'); }
function startCancel(data)       { resetFlowData(data); data.intent='cancel_appointment'; return reply(data,'ask_lookup_method','I can help you cancel your appointment. How would you like to find it?'); }
function startReschedule(data)   { resetFlowData(data); data.intent='reschedule_appointment'; return reply(data,'ask_lookup_method','Let\'s reschedule your appointment. How would you like to find it?'); }
function startInquiry(data)      { resetFlowData(data); data.intent='general_inquiry'; return reply(data,'show_topics','Happy to help! What would you like to know?'); }
function startMyBookings(data)   { resetFlowData(data); data.intent='my_bookings'; return reply(data,'ask_phone','To find your bookings, please enter your registered phone number:'); }

function extractCategory(msg) {
    if (msg.includes('cardiology')) return 'Cardiology'; if (msg.includes('dental')) return 'Dental'; if (msg.includes('eye care') || msg.includes('eye')) return 'Eye Care'; if (msg.includes('neurology')) return 'Neurology'; if (msg.includes('orthopedics')) return 'Orthopedics';
    return null;
}

function extractTime(msg) {
    const m = msg.match(/(\d+):00\s*(am|pm)/i) || msg.match(/(\d+)\s*(am|pm)/i);
    if (m) return m[0].toUpperCase().replace(/\s+/,'');
    return null;
}

function detectDate(msg) {
    const now = new Date(); const lower = msg.toLowerCase(); if (lower.includes('tomorrow')) return format(addDays(now, 1), 'yyyy-MM-dd'); if (lower.includes('today')) return format(now, 'yyyy-MM-dd');
    const iso = lower.match(/\b(\d{4})-(\d{2})-(\d{2})\b/); if (iso) return iso[0];
    const weekdays = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
    const weekday = weekdays.find(d => lower.includes(d));
    if (weekday) {
        const target = weekdays.indexOf(weekday); const current = now.getDay(); let diff = (target - current + 7) % 7;
        if (diff === 0 && !lower.includes('this')) diff = 7;
        return format(addDays(now, diff), 'yyyy-MM-dd');
    }
    return null;
}

function extractBookingId(text) {
    const m = text.match(/\b(apt-\d{3,6})\b/i); return m ? m[1].toUpperCase() : null;
}

async function callAI(userMessage, conversationHistory, sessionData, services = [], doctors = []) {
    const apiKeys = Object.keys(process.env).filter(k => k.startsWith('GEMINI_API_KEY')).map(k => process.env[k]?.trim()).filter(Boolean);
    if (apiKeys.length === 0) return null;
    const sanitizedHistory = []; let expectedRole = 'user';
    for (const msg of (conversationHistory || []).filter((m,i)=> i>0||!m.isBot)) {
        const role = (msg.isBot||msg.role==='assistant'||msg.role==='model') ? 'model' : 'user';
        if (role === expectedRole) { sanitizedHistory.push({ role, parts: [{ text: String(msg.text||'...') }] }); expectedRole = role === 'user' ? 'model' : 'user'; }
    }
    for (const key of apiKeys) {
        try {
            const genAI = new GoogleGenerativeAI(key); const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
            const chat = model.startChat({ history: sanitizedHistory });
            const result = await chat.sendMessage([{ text: `Clinic AI. Action Required if missing Name/Phone/Email. JSON: {intent,nextStep,action,extractedData,responseMessage}. Date:${format(new Date(),'yyyy-MM-dd')}` }, { text: `CONTEXT:${JSON.stringify(sessionData)} USER:${userMessage}` }]);
            const text = result.response.text(); const s = text.indexOf('{'), e = text.lastIndexOf('}'); if (s!==-1 && e!==-1) return JSON.parse(text.substring(s, e+1));
        } catch(err) { if (err.status === 429) continue; }
    }
    return null;
}

exports.processUserMessage = async (userMessage, conversationHistory, sessionData, services = [], doctors = []) => {
    const machineResult = runStateMachine(userMessage, sessionData);
    if (machineResult) { machineResult.lastStep = machineResult.nextStep; return machineResult; }
    const aiResult = await callAI(userMessage, conversationHistory, sessionData, services, doctors);
    if (aiResult && aiResult.responseMessage) { aiResult.lastStep = aiResult.nextStep; return aiResult; }
    return { intent: sessionData.intent || 'book_appointment', nextStep: 'show_intent_buttons', action: null, extractedData: sessionData, responseMessage: 'How may I assist you with your booking today?', lastStep: 'show_intent_buttons' };
};