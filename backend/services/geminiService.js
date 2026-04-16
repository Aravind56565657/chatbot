const { GoogleGenerativeAI } = require("@google/generative-ai");
const { format, addDays } = require('date-fns');

/**
 * DETERMINISTIC STATE MACHINE - Full Clinical Power.
 * Handles Name, Age, Gender, Phone, Email manually + fixes Cancel Flow loops.
 */

function runStateMachine(userMessage, sessionData) {
    const msg = userMessage.toLowerCase().trim();
    const data = { ...sessionData };
    const last = sessionData.lastStep || '';
    let intent = sessionData.intent || '';

    // 1. GLOBAL OVERRIDES
    const bId = extractBookingId(msg);
    if (bId && (msg.includes('cancel') || msg.includes('reschedule'))) {
        data.intent = msg.includes('cancel') ? 'cancel_appointment' : 'reschedule_appointment';
        data.bookingId = bId;
        data.lookupMethod = 'bookingId';
        return reply(data, 'fetch_by_id', `Locating ${bId}...`);
    }

    if (msg === 'main menu' || msg === 'restart') {
        return { intent: null, nextStep: 'show_intent_buttons', responseMessage: "Main Menu reset. How can I help?" };
    }

    // Keyword Triggers (Restricted to prevent collision with "Confirm")
    const isBooking = (msg.includes('book') || msg.includes('appointment')) && !msg.includes('cancel') && !msg.includes('reschedule') && !msg.includes('confirm');
    if (isBooking) return startBooking(data);
    if (msg.includes('cancel') && (msg.includes('appointment') || msg.includes('booking'))) return startCancel(data);
    if (msg.includes('reschedule')) return startReschedule(data);

    // ── CANCEL FLOW ────────────────────────────────────────────────────────────
    if (intent === 'cancel_appointment') {
        if (last === 'ask_lookup_method') {
            if (msg.includes('phone')) { data.lookupMethod = 'phone'; return reply(data, 'ask_phone_cancel', 'Please enter your registered phone number:'); }
            if (msg.includes('id')) { data.lookupMethod = 'bookingId'; return reply(data, 'ask_booking_id', 'Please enter your Booking ID:'); }
        }
        if (last === 'ask_phone_cancel') {
            const phone = msg.replace(/\D/g, '');
            if (phone.length >= 10) { data.userPhone = phone; return reply(data, 'fetch_by_phone', 'Searching...'); }
        }
        if (last === 'ask_booking_id') { data.bookingId = userMessage.toUpperCase(); return reply(data, 'fetch_by_id', 'Searching...'); }
        
        // Handle "Cancel This Appointment" button from results
        if (last === 'fetch_by_id' || last === 'fetch_by_phone' || last === 'show_found_card' || last === 'show_booking_list') {
             if (msg.includes('cancel')) return reply(data, 'confirm_cancel_final', 'Are you sure you want to cancel this appointment?', 'confirm_cancellation');
        }
        
        if (last === 'confirm_cancel_final') {
             if (msg.includes('yes') || msg.includes('confirm') || msg.includes('cancel')) return reply(data, 'cancelled', 'Your appointment has been cancelled.', 'cancellation_confirmed');
             return reply(data, 'show_intent_buttons', 'Cancellation aborted. What else?');
        }
        return reply(data, 'ask_lookup_method', 'How would you like to find your appointment?');
    }

    // ── BOOK APPOINTMENT FLOW ──────────────────────────────────────────────────
    if (intent === 'book_appointment') {
        // Handle "Confirm" button
        if (last === 'confirm_booking' && (msg.includes('confirm') || msg.includes('yes'))) {
             return reply(data, 'booking_success', 'Booking confirmed!', 'confirm_booking');
        }

        // Step 1: Specialty
        if (!data.serviceCategory) {
            data.serviceCategory = extractCategory(msg);
            if (data.serviceCategory) return reply(data, 'show_doctor_cards', `Pick your ${data.serviceCategory} specialist:`);
            return reply(data, 'show_service_buttons', 'Which specialty?');
        }

        // Step 2: Doctor
        const t = extractTime(msg);
        const isDocMsg = (msg.includes('select') || msg.includes('dr.')) && !t;
        if (data.serviceCategory && (!data.doctorName || isDocMsg)) {
            const dn = userMessage.replace(/select specialist|select|specialist|dr\./gi, '').trim();
            if (dn.length > 3 && !extractTime(dn)) { data.doctorName = dn; return reply(data, 'ask_date', `Date for ${dn}?`); }
            if (!data.doctorName) return reply(data, 'show_doctor_cards', `Choose a ${data.serviceCategory} specialist:`);
        }

        // Step 3: Date
        if (data.doctorName && !data.date) {
            const d = detectDate(msg);
            if (d) { data.date = d; return reply(data, 'show_slots', `Time for ${data.doctorName} on ${d}:`); }
            return reply(data, 'ask_date', `Which date for ${data.doctorName}?`);
        }

        // Step 4: Time Slot
        if (data.date && !data.timeSlot) {
            const tm = extractTime(msg);
            if (tm) { data.timeSlot = tm; return reply(data, 'ask_name', `Reserved. May I have the patient's full name?`); }
            return reply(data, 'show_slots', `Pick a slot:`);
        }

        // Step 5: Name
        if (data.timeSlot && !data.userName) {
            const name = userMessage.replace(/my name is|i am|this is/gi, '').trim();
            if (name.length > 2 && !msg.includes('select')) { data.userName = name; return reply(data, 'ask_age', `Thank you, ${name}. How old is the patient?`); }
            return reply(data, 'ask_name', "Patient's full name?");
        }

        // Step 6: Age
        if (data.userName && !data.userAge) {
            const age = msg.match(/\d+/)?.[0];
            if (age) { data.userAge = age; return reply(data, 'ask_gender', "What is the patient's gender?"); }
            return reply(data, 'ask_age', "Please enter the patient's age:");
        }

        // Step 7: Gender
        if (data.userAge && !data.userGender) {
            if (msg.includes('male') || msg.includes('female')) { data.userGender = msg.includes('female') ? 'Female' : 'Male'; return reply(data, 'ask_phone', "Contact phone number?"); }
            return reply(data, 'ask_gender', "Gender? (Male/Female)");
        }

        // Step 8: Phone
        if (data.userGender && !data.userPhone) {
            const phone = msg.replace(/\D/g, '');
            if (phone.length >= 10) { data.userPhone = phone; return reply(data, 'ask_email', "And email address?"); }
            return reply(data, 'ask_phone', "Valid 10-digit phone:");
        }

        // Step 9: Email
        if (data.userPhone && !data.userEmail) {
            if (msg.includes('@') && msg.includes('.')) { data.userEmail = userMessage.trim(); return reply(data, 'confirm_booking', "Review and confirm:", 'confirm_booking'); }
            return reply(data, 'ask_email', "Valid email address:");
        }

        return reply(data, 'confirm_booking', "Confirm details below:", 'confirm_booking');
    }

    return null;
}

function reply(data, nextStep, message, action = null) { return { intent: data.intent, nextStep, action, extractedData: data, responseMessage: message, lastStep: nextStep }; }
function resetFlowData(data) { Object.keys(data).forEach(k => { if (typeof data[k] === 'boolean') data[k]=false; else data[k]=null; }); return data; }
function startBooking(data) { resetFlowData(data); data.intent='book_appointment'; return reply(data,'show_service_buttons','Which specialty?'); }
function startCancel(data) { resetFlowData(data); data.intent='cancel_appointment'; return reply(data,'ask_lookup_method','How find appointment to cancel?'); }
function startReschedule(data) { resetFlowData(data); data.intent='reschedule_appointment'; return reply(data,'ask_lookup_method','How find appointment to reschedule?'); }

function extractCategory(msg) {
    const cats={cardiology:'Cardiology',dental:'Dental',eye:'Eye Care',neuro:'Neurology',ortho:'Orthopedics'};
    for(const[k,v]of Object.entries(cats)) if(msg.includes(k))return v;
    return null;
}
function extractTime(msg){const m=msg.match(/(\d+):00\s*(am|pm)/i)||msg.match(/(\d+)\s*(am|pm)/i);return m?m[0].toUpperCase().replace(/\s+/,''):null;}
function detectDate(msg){
    const now=new Date();const lower=msg.toLowerCase();if(lower.includes('tomorrow'))return format(addDays(now,1),'yyyy-MM-dd');
    const iso=lower.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);if(iso)return iso[0];
    const weekdays=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];const wd=weekdays.find(d=>lower.includes(d));
    if(wd){let diff=(weekdays.indexOf(wd)-now.getDay()+7)%7;if(diff===0)diff=7;return format(addDays(now,diff),'yyyy-MM-dd');}
    return null;
}
function extractBookingId(text){const m=text.match(/\b(apt-\d{3,6})\b/i);return m?m[1].toUpperCase():null;}

async function callAI(userMessage, conversationHistory, sessionData, services, doctors) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_1; if (!apiKey) return null;
    try {
        const genAI = new (require("@google/generative-ai").GoogleGenerativeAI)(apiKey.trim());
        const result = await genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" }).startChat({ history: [] }).sendMessage(`JSON ONLY {intent,nextStep,action,extractedData,responseMessage}. User:${userMessage} Data:${JSON.stringify(sessionData)}`);
        const text = result.response.text(); const s = text.indexOf('{'), e = text.lastIndexOf('}'); return s !== -1 ? JSON.parse(text.substring(s, e+1)) : null;
    } catch { return null; }
}

exports.processUserMessage = async (userMessage, conversationHistory, sessionData, services = [], doctors = []) => {
    const machine = runStateMachine(userMessage, sessionData);
    if (machine) { machine.lastStep = machine.nextStep; return machine; }
    const ai = await callAI(userMessage, conversationHistory, sessionData, services, doctors);
    if (ai && ai.responseMessage) { ai.lastStep = ai.nextStep; return ai; }
    return { intent: sessionData.intent || 'book_appointment', nextStep: 'show_intent_buttons', responseMessage: 'How can I assist you?', extractedData: sessionData, lastStep: 'show_intent_buttons' };
};