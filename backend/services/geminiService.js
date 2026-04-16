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
    // Freeform bookingId shortcuts (skip lookup-method buttons)
    const bookingId = extractBookingId(msg);
    if (bookingId) {
        if (msg.includes('cancel')) {
            data.intent = 'cancel_appointment';
            data.bookingId = bookingId;
            data.lookupMethod = 'bookingId';
            data.shortcutCancelFromMyBookings = msg.includes('cancel booking');
            data.cancelFromMyBookings = msg.includes('cancel booking');
            return reply(data, 'fetch_by_id', 'Looking up your appointment...');
        }
        if (msg.includes('reschedule')) {
            data.intent = 'reschedule_appointment';
            data.bookingId = bookingId;
            data.lookupMethod = 'bookingId';
            data.shortcutRescheduleFromMyBookings = msg.includes('reschedule booking');
            data.rescheduleFromMyBookings = msg.includes('reschedule booking');
            return reply(data, 'fetch_by_id', 'Looking up your appointment...');
        }
    }

    if (msg === 'book appointment')   return startBooking(data);
    if (msg === 'check availability') return startAvailability(data);
    if (msg === 'cancel appointment') return startCancel(data);
    if (msg === 'reschedule')         return startReschedule(data);
    if (msg === 'general inquiry')    return startInquiry(data);
    if (msg === 'my bookings')        return startMyBookings(data);

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
            if (msg.includes('try again')) {
                return reply(data, 'ask_booking_id', 'Please enter your Booking ID (e.g. APT-9281)');
            }
            if (msg.includes('search by phone')) {
                data.lookupMethod = 'phone';
                return reply(data, 'ask_phone_cancel', 'Please enter your registered phone number');
            }
        }
        if (last === 'fetch_by_phone') {
            if (msg.includes('try again')) {
                return reply(data, 'ask_phone_cancel', 'Please enter your registered phone number');
            }
            if (msg.includes('book new appointment')) {
                return reply(data, 'show_intent_buttons', 'Sure! Let\'s book a new appointment.');
            }
        }
        if (last === 'show_found_card' || last === 'fetch_by_phone' || last === 'fetch_by_id') {
            if (msg.includes('yes') || msg.includes('confirm') || msg.includes('cancel')) {
                return reply(
                    data,
                    'confirm_cancel_final',
                    '',
                    'confirm_cancellation'
                );
            }
        }
        if (last === 'confirm_cancel_final') {
            if (msg.includes('yes') || msg.includes('confirm') || msg.includes('cancel')) {
                return reply(data, 'cancelled', 'Your appointment has been cancelled.', 'cancellation_confirmed');
            }
            return reply(data, 'show_intent_buttons', 'Kept your appointment. How else can I help?');
        }
        // Default: re-ask lookup method if we lost track
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
            // Booking ID entry for reschedule path (based on Booking ID lookup).
            if (msg.includes('try again')) {
                return reply(data, 'ask_booking_id_reschedule', 'Please enter your Booking ID (e.g. APT-9281)');
            }
            if (msg.includes('phone') || msg.includes('search by phone')) {
                data.lookupMethod = 'phone';
                return reply(data, 'ask_phone_reschedule', 'Please enter your registered phone number');
            }
            data.bookingId = userMessage.trim().toUpperCase();
            return reply(data, 'fetch_by_id', 'Looking up your appointment...');
        }
        if (last === 'fetch_by_id') {
            if (msg.includes('try again')) {
                return reply(data, 'ask_booking_id_reschedule', 'Please enter your Booking ID (e.g. APT-9281)');
            }
            if (msg.includes('search by phone')) {
                data.lookupMethod = 'phone';
                return reply(data, 'ask_phone_reschedule', 'Please enter your registered phone number');
            }
        }
        if (last === 'fetch_by_phone') {
            if (msg.includes('try again')) {
                return reply(data, 'ask_phone_reschedule', 'Please enter your registered phone number');
            }
        }
        if (last === 'show_found_card' || last === 'fetch_by_phone' || last === 'fetch_by_id') {
            if (msg.includes('reschedule')) {
                return reply(data, 'ask_new_date', 'What new date would you like?');
            }
        }
        if (last === 'ask_new_date') {
            const detected = detectDate(msg);
            if (detected) {
                data.newDate = detected;
                data.date = detected;
                return reply(data, 'show_slots_reschedule', `Showing available slots for ${data.doctorName || 'your doctor'} on ${detected}:`);
            }
        }
        if (last === 'show_slots_reschedule') {
            const t = extractTime(msg);
            if (t) {
                data.newTimeSlot = t;
                return reply(data, 'show_reschedule_confirm', '', 'confirm_reschedule');
            }
        }
        if (last === 'show_reschedule_confirm') {
            if (msg.includes('choose different time')) {
                data.date = data.newDate;
                return reply(data, 'show_slots_reschedule', `Showing available slots for ${data.doctorName || 'your doctor'} on ${data.newDate}:`);
            }
        }
        return reply(data, 'ask_lookup_method', 'How would you like to find your appointment?');
    }

    // ── MY BOOKINGS FLOW ───────────────────────────────────────────────────────
    if (intent === 'my_bookings') {
        if (last === 'ask_phone') {
            const phone = msg.replace(/\D/g, '');
            if (phone.length >= 10) {
                data.userPhone = phone;
                return reply(data, 'show_booking_list', 'Fetching your appointments...');
            }
            return reply(data, 'ask_phone', 'Please enter a valid 10-digit phone number:');
        }
        return reply(data, 'ask_phone', 'Please enter your registered phone number to view your bookings:');
    }

    // ── GENERAL INQUIRY FLOW ───────────────────────────────────────────────────
    if (intent === 'general_inquiry') {
        if (last === 'ask_freeform_inquiry') return null;

        if (msg.includes('service prices') || msg.includes('service price') || msg.includes('prices') || msg.includes('cost')) {
            return reply({ ...data, inquiryCardType: 'prices' }, 'show_info_card', 'Our Service Prices:');
        }
        if (msg.includes('service duration') || msg.includes('duration')) {
            return reply({ ...data, inquiryCardType: 'duration' }, 'show_info_card', 'Our Service Duration:');
        }
        if (msg.includes('our doctors') || (msg.includes('doctor') && msg.includes('our'))) {
            return reply(data, 'show_doctor_groups', 'Our Doctors');
        }
        if (msg.includes('working hours') || msg.includes('hours') || msg.includes('hour') || msg.includes('timing')) {
            return reply(data, 'show_info_card', 'Our Working Hours:');
        }
        if (msg.includes('location') || msg.includes('contact')) {
            return reply(data, 'show_info_card', 'Our Location & Contact:');
        }
        if (msg.includes('something else')) {
            return reply(data, 'ask_freeform_inquiry', "Sure! Type your question and I'll do my best to answer.");
        }
        return reply(data, 'show_topics', 'Happy to help! What would you like to know?');
    }

    // ── CHECK AVAILABILITY FLOW ────────────────────────────────────────────────
    if (intent === 'check_availability') {
        if (!data.serviceCategory) {
            data.serviceCategory = extractCategory(msg);
            if (data.serviceCategory) return reply(data, 'show_doctor_cards', 'Which doctor would you like to check?');
        }
        if (data.serviceCategory && !data.doctorName && (msg.includes('select'))) {
            data.doctorName = userMessage.replace(/select specialist|select/gi, '').trim();
            return reply(data, 'ask_date', 'Which date would you like to check?');
        }
        if (data.doctorName && !data.date) {
            const d = detectDate(msg);
            if (d) { data.date = d; return reply(data, 'show_slots_readonly', ''); }
            return reply(data, 'ask_date', 'Which date? (e.g., April 25, tomorrow)');
        }
        if (data.date) {
            if (msg.includes('book a slot') || msg.includes('book slot')) return reply(data, 'show_slots', 'Please select your preferred time slot:', null, 'book_appointment');
            if (msg.includes('another date') || msg.includes('check another')) { data.date = null; return reply(data, 'ask_date', 'Which date would you like to check?'); }
        }
        return reply(data, 'show_service_buttons', 'Which specialty would you like to check?');
    }

    // ── BOOK APPOINTMENT FLOW ──────────────────────────────────────────────────
    if (intent === 'book_appointment') {
        if (!data.serviceCategory) { data.serviceCategory = extractCategory(msg); if (data.serviceCategory) return reply(data, 'show_doctor_cards', `Please select your specialist for ${data.serviceCategory}.`); }
        if (data.serviceCategory && !data.doctorName && msg.includes('select')) {
            data.doctorName = userMessage.replace(/select specialist|select/gi, '').trim();
            return reply(data, 'ask_date', `Which date for ${data.doctorName}?`);
        }
        if (data.doctorName && !data.date) {
            const d = detectDate(msg);
            if (d) { data.date = d; return reply(data, 'show_slots', `Showing slots for ${data.doctorName} on ${d}:`); }
            return reply(data, 'ask_date', 'Which date? (e.g., April 25, tomorrow)');
        }
        if (data.date && !data.timeSlot) {
            const t = extractTime(msg);
            if (t) { data.timeSlot = t; return reply(data, 'ask_name', `Your slot at ${t} is reserved. May I have your full name?`); }
        }
        if (data.timeSlot && !data.userName && last === 'ask_name') {
            data.userName = userMessage.replace(/my name is|i am|this is/gi, '').trim();
            return reply(data, 'ask_age', `Thank you, ${data.userName}. How old are you?`);
        }
        if (data.userName && !data.userAge && last === 'ask_age') {
            const age = msg.match(/\d+/)?.[0];
            if (age) { data.userAge = age; return reply(data, 'ask_gender', `Got it. What is your gender?`); }
        }
        if (data.userAge && !data.userGender && last === 'ask_gender') {
            if (msg.includes('male') || msg.includes('female') || msg.includes('other')) {
                data.userGender = msg.includes('female') ? 'Female' : msg.includes('other') ? 'Other' : 'Male';
                return reply(data, 'ask_phone', `Please provide your phone number:`);
            }
        }
        if (data.userGender && !data.userPhone && last === 'ask_phone') {
            const phone = msg.replace(/\D/g, '');
            if (phone.length >= 10) {
                data.userPhone = phone;
                return reply(data, 'ask_email', 'Please provide your email address:');
            }
        }

        if (data.userPhone && !data.userEmail && last === 'ask_email') {
            // Very light email check; booking confirmation will proceed if it looks like an email.
            const email = userMessage.trim();
            const looksLikeEmail = email.includes('@') && email.includes('.');
            if (looksLikeEmail) {
                data.userEmail = email;
                return reply(
                    data,
                    'confirm_booking',
                    `Here's your booking summary. Does this look correct?`,
                    'confirm_booking'
                );
            }
            return reply(data, 'ask_email', 'Please enter a valid email address:');
        }

        // Deterministic booking confirmation
        if (last === 'confirm_booking') {
            if (msg.includes('yes') || msg.includes('confirm') || msg.includes('book') || msg.includes('correct') || msg.includes('right') || msg.includes('okay') || msg.includes('proceed')) {
                return reply(data, 'confirm_booking', '', 'confirm_booking');
            }
            if (msg.includes('modify') || msg.includes('change') || msg.includes('restart')) {
                // chatController also intercepts modify/change/restart and restarts the flow.
                return reply(data, 'confirm_booking', '', null);
            }
        }

        if (!data.serviceCategory) return reply(data, 'show_service_buttons', 'Which specialty would you like to book?');
    }

    // Fallback
    return null; // Let AI handle unknown
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
    data.service = null;
    data.serviceCategory = null;
    data.date = null;
    data.timeSlot = null;
    data.userName = null;
    data.userAge = null;
    data.userGender = null;
    data.userPhone = null;
    data.userEmail = null;
    data.notes = null;
    data.bookingId = null;
    data.lookupMethod = null;
    data.newDate = null;
    data.newTimeSlot = null;
    data.doctorName = null;
    data.doctorId = null;
    data.inquiryCardType = null;
    data.shortcutCancelFromMyBookings = false;
    data.cancelFromMyBookings = false;
    data.shortcutRescheduleFromMyBookings = false;
    data.rescheduleFromMyBookings = false;
    return data;
}

function startBooking(data)      { resetFlowData(data); data.intent='book_appointment'; return reply(data,'show_service_buttons','Which specialty would you like to book?'); }
function startAvailability(data) { resetFlowData(data); data.intent='check_availability'; return reply(data,'show_service_buttons','Sure! Which specialty would you like to check availability for?'); }
function startCancel(data)       { resetFlowData(data); data.intent='cancel_appointment'; return reply(data,'ask_lookup_method','I can help you cancel your appointment. How would you like to find it?'); }
function startReschedule(data)   { resetFlowData(data); data.intent='reschedule_appointment'; return reply(data,'ask_lookup_method','Let\'s reschedule your appointment. How would you like to find it?'); }
function startInquiry(data)      { resetFlowData(data); data.intent='general_inquiry'; return reply(data,'show_topics','Happy to help! What would you like to know?'); }
function startMyBookings(data)   { resetFlowData(data); data.intent='my_bookings'; return reply(data,'ask_phone','To find your bookings, please enter your registered phone number:'); }

function extractCategory(msg) {
    if (msg.includes('cardiology')) return 'Cardiology';
    if (msg.includes('dental'))     return 'Dental';
    if (msg.includes('eye care') || msg.includes('eye')) return 'Eye Care';
    if (msg.includes('neurology'))  return 'Neurology';
    if (msg.includes('orthopedics')) return 'Orthopedics';
    if (msg.includes('salon'))      return 'Salon';
    return null;
}

function extractTime(msg) {
    const m = msg.match(/(\d+):00\s*(am|pm)/i) || msg.match(/(\d+)\s*(am|pm)/i);
    if (m) return m[0].toUpperCase().replace(/\s+/,'');
    return null;
}

function detectDate(msg) {
    const now = new Date();
    const currentYear = now.getFullYear();
    const lower = msg.toLowerCase();

    if (lower.includes('tomorrow')) return format(addDays(now, 1), 'yyyy-MM-dd');
    if (lower.includes('today')) return format(now, 'yyyy-MM-dd');

    // yyyy-mm-dd explicit
    const iso = lower.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

    const weekdays = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
    const weekday = weekdays.find(d => lower.includes(d));
    if (weekday) {
        const target = weekdays.indexOf(weekday);
        const current = now.getDay();
        const hasNext = lower.includes('next');
        const hasThis = lower.includes('this');

        let diff = (target - current + 7) % 7;
        if (diff === 0) {
            if (hasNext) diff = 7;
            if (!hasThis) diff = 7; // "Friday" -> next Friday (not today)
        } else {
            if (hasNext) diff += 7;
        }

        return format(addDays(now, diff), 'yyyy-MM-dd');
    }

    const months = ['january','february','march','april','may','june','july','august','september','october','november','december'];
    for (let i = 0; i < months.length; i++) {
        if (lower.includes(months[i])) {
            const dayStr = lower.match(new RegExp(`${months[i]}\\s+(\\d{1,2})`))?.[1];
            const dayFallback = lower.match(/\d+/)?.[0];
            const day = dayStr || dayFallback;
            if (day) {
                const mm = String(i + 1).padStart(2, '0');
                const dd = String(day).padStart(2, '0');
                return `${currentYear}-${mm}-${dd}`;
            }
        }
    }

    // April 20 (month without explicit month token handled above), so if we find a month token + digits, it's already handled.
    return null;
}

function extractBookingId(text) {
    const m = text.match(/\b(apt-\d{3,6})\b/i);
    if (!m) return null;
    return m[1].toUpperCase();
}

// ─────────────────────────────────────────────────────────────────────────────
// AI WITH ROTATION (secondary fallback only)
// ─────────────────────────────────────────────────────────────────────────────
async function callAI(userMessage, conversationHistory, sessionData, services = [], doctors = []) {
    const apiKeys = Object.keys(process.env)
        .filter(k => k.startsWith('GEMINI_API_KEY'))
        .sort().map(k => process.env[k]?.trim()).filter(Boolean);

    if (apiKeys.length === 0) return null;

    const sanitizedHistory = [];
    let expectedRole = 'user';
    for (const msg of (conversationHistory || []).filter((m,i)=> i>0||!m.isBot)) {
        const role = (msg.isBot||msg.role==='assistant'||msg.role==='model') ? 'model' : 'user';
        if (role === expectedRole) {
            sanitizedHistory.push({ role, parts: [{ text: String(msg.text||'...') }] });
            expectedRole = role === 'user' ? 'model' : 'user';
        }
    }

    for (const key of apiKeys) {
        for (const modelName of ["gemini-2.0-flash-exp","gemini-1.5-flash-latest"]) {
            console.log(`>>> Syncing: ${modelName} (...${key.slice(-4)})`);
            try {
                const genAI  = new GoogleGenerativeAI(key);
                const model  = genAI.getGenerativeModel({ model: modelName });
                const chat   = model.startChat({ history: sanitizedHistory });
                const result = await chat.sendMessage([
                    { text: `Clinic AI. JSON ONLY: {intent,nextStep,action,extractedData,responseMessage}. Date:${format(new Date(),'yyyy-MM-dd')}` },
                    { text: `CONTEXT:${JSON.stringify(sessionData)}` },
                    { text: `SERVICES:${JSON.stringify(services)}` },
                    { text: `DOCTORS:${JSON.stringify(doctors)}` },
                    { text: `USER:${userMessage}` }
                ]);
                const text = result.response.text();
                const s = text.indexOf('{'), e = text.lastIndexOf('}');
                if (s !== -1 && e !== -1) {
                    try { return JSON.parse(text.substring(s, e+1)); } catch(_) {}
                }
            } catch(err) {
                if (err.status === 429) break;
            }
        }
    }
    return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────
exports.processUserMessage = async (userMessage, conversationHistory, sessionData, services = [], doctors = []) => {
    // 1. State machine runs FIRST
    const machineResult = runStateMachine(userMessage, sessionData);
    if (machineResult) {
        machineResult.lastStep = machineResult.nextStep;
        return machineResult;
    }

    // 2. AI fallback for unhandled messages
    const aiResult = await callAI(userMessage, conversationHistory, sessionData, services, doctors);
    if (aiResult && aiResult.responseMessage) {
        // After freeform "Something Else", show end buttons (Book Appointment + Main Menu)
        if (sessionData.intent === 'general_inquiry' && sessionData.lastStep === 'ask_freeform_inquiry') {
            aiResult.nextStep = 'show_general_inquiry_end_buttons';
            aiResult.lastStep = aiResult.nextStep;
        }
        aiResult.lastStep = aiResult.nextStep;
        return aiResult;
    }

    // If freeform general inquiry AI could not answer, stay in the inquiry flow instead of
    // falling back to booking/main menu.
    if (sessionData.intent === 'general_inquiry' && sessionData.lastStep === 'ask_freeform_inquiry') {
        return {
            intent: 'general_inquiry',
            nextStep: 'show_general_inquiry_end_buttons',
            action: null,
            extractedData: sessionData,
            responseMessage: "I couldn't confidently answer that from our clinic information. You can ask about prices, duration, doctors, hours, or location.",
            lastStep: 'show_general_inquiry_end_buttons'
        };
    }

    // 3. Ultimate fallback
    return {
        intent: sessionData.intent || 'book_appointment',
        nextStep: sessionData.intent === 'general_inquiry' ? 'show_topics' : 'show_intent_buttons',
        action: null,
        extractedData: sessionData,
        responseMessage: sessionData.intent === 'general_inquiry'
            ? 'Happy to help! What would you like to know?'
            : 'How may I assist you with your booking today?',
        lastStep: sessionData.intent === 'general_inquiry' ? 'show_topics' : 'show_intent_buttons'
    };
};