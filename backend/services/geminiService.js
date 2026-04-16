const { GoogleGenerativeAI } = require("@google/generative-ai");
const { format, addDays } = require('date-fns');

/**
 * DETERMINISTIC STATE MACHINE - Production Ready Clinical Edition.
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
        return { intent: null, nextStep: 'show_intent_buttons', responseMessage: "Main Menu reset. How can I assist you today?" };
    }

    const isBooking = (msg.includes('book') || msg.includes('appointment')) && !msg.includes('cancel') && !msg.includes('reschedule') && !msg.includes('confirm') && !msg.includes('my') && !msg.includes('your');
    if (isBooking) return startBooking(data);
    if (msg.includes('cancel') && (msg.includes('appointment') || msg.includes('booking'))) return startCancel(data);
    if (msg.includes('reschedule')) return startReschedule(data);
    if (msg.includes('my bookings') || msg.includes('my appointment')) return startMyBookings(data);
    if (msg.includes('general inquiry') || msg.includes('hours') || msg.includes('location')) return startInquiry(data);

    // ── CANCEL FLOW ────────────────────────────────────────────────────────────
    if (intent === 'cancel_appointment') {
        if (last === 'ask_lookup_method') {
            if (msg.includes('phone')) { data.lookupMethod = 'phone'; return reply(data, 'ask_phone_cancel', 'Please enter your registered phone number:'); }
            if (msg.includes('id')) { data.lookupMethod = 'bookingId'; return reply(data, 'ask_booking_id', 'Please enter your Booking ID:'); }
        }
        if (last === 'ask_phone_cancel') { const phone = msg.replace(/\D/g, ''); if (phone.length >= 10) { data.userPhone = phone; return reply(data, 'fetch_by_phone', 'Searching your appointments...'); } return reply(data, 'ask_phone_cancel', 'Valid 10-digit phone please:'); }
        if (last === 'ask_booking_id') { data.bookingId = userMessage.toUpperCase(); return reply(data, 'fetch_by_id', 'Searching...'); }
        if (last === 'fetch_by_id' || last === 'fetch_by_phone' || last === 'show_found_card' || last === 'show_booking_list') {
             if (msg.includes('cancel')) return reply(data, 'confirm_cancel_final', 'Are you sure you want to cancel this appointment?', 'confirm_cancellation');
        }
        if (last === 'confirm_cancel_final') {
             if (msg.includes('yes') || msg.includes('confirm') || msg.includes('cancel')) return reply(data, 'cancelled', 'Success. Your appointment has been cancelled.', 'cancellation_confirmed');
             return reply(data, 'show_intent_buttons', 'Cancellation aborted.');
        }
        return reply(data, 'ask_lookup_method', 'How find appointment to cancel?');
    }

    // ── RESCHEDULE FLOW ─────────────────────────────────────────────────────────
    if (intent === 'reschedule_appointment') {
        if (last === 'ask_lookup_method') {
            if (msg.includes('phone')) { data.lookupMethod = 'phone'; return reply(data, 'ask_phone_reschedule', 'Enter your registered phone number:'); }
            if (msg.includes('id')) { data.lookupMethod = 'bookingId'; return reply(data, 'ask_booking_id_reschedule', 'Enter your Booking ID:'); }
        }
        if (last === 'ask_phone_reschedule') { const phone = msg.replace(/\D/g, ''); if (phone.length >= 10) { data.userPhone = phone; return reply(data, 'fetch_by_phone', 'Searching appointments...'); } return reply(data, 'ask_phone_reschedule', 'Valid phone:'); }
        if (last === 'ask_booking_id_reschedule') { data.bookingId = userMessage.toUpperCase(); return reply(data, 'fetch_by_id', 'Searching...'); }
        if (last === 'fetch_by_id' || last === 'fetch_by_phone' || last === 'show_found_card' || last === 'show_booking_list') {
             if (msg.includes('reschedule')) return reply(data, 'ask_new_date', 'What new date would you like?');
        }
        if (last === 'ask_new_date') { const d = detectDate(msg); if (d) { data.newDate = d; data.date = d; return reply(data, 'show_slots_reschedule', `Slots for ${data.doctorName || 'your doctor'} on ${d}:`); } return reply(data, 'ask_new_date', 'Which date? (e.g. Tomorrow)'); }
        if (last === 'show_slots_reschedule') { const t = extractTime(msg); if (t) { data.newTimeSlot = t; return reply(data, 'show_reschedule_confirm', '', 'confirm_reschedule'); } }
        return reply(data, 'ask_lookup_method', 'How find appointment to reschedule?');
    }

    // ── MY BOOKINGS FLOW ───────────────────────────────────────────────────────
    if (intent === 'my_bookings') {
        if (last === 'ask_phone') { const phone = msg.replace(/\D/g, ''); if (phone.length >= 10) { data.userPhone = phone; return reply(data, 'show_booking_list', 'Fetching your bookings...'); } return reply(data, 'ask_phone', 'Enter 10-digit phone:'); }
        return reply(data, 'ask_phone', 'Enter registered phone number:');
    }

    // ── GENERAL INQUIRY FLOW ───────────────────────────────────────────────────
    if (intent === 'general_inquiry') {
        if (msg.includes('prices')) return reply({ ...data, inquiryCardType: 'prices' }, 'show_info_card', 'Surgical & Consult Pricing:');
        if (msg.includes('hours') || msg.includes('open')) return reply(data, 'show_info_card', 'Clinic Hours:');
        if (msg.includes('location') || msg.includes('where')) return reply(data, 'show_info_card', 'Our Location:');
        return reply(data, 'show_topics', 'What details do you need?');
    }

    // ── BOOK APPOINTMENT FLOW ──────────────────────────────────────────────────
    if (intent === 'book_appointment') {
        if (last === 'confirm_booking' && (msg.includes('confirm') || msg.includes('yes'))) return reply(data, 'booking_success', 'Confirmed!', 'confirm_booking');
        if (!data.serviceCategory) { data.serviceCategory = extractCategory(msg); if (data.serviceCategory) return reply(data, 'show_doctor_cards', `Choose ${data.serviceCategory} specialist:`); return reply(data, 'show_service_buttons', 'Which specialty?'); }
        const t = extractTime(msg);
        const isDocMsg = (msg.includes('select') || msg.includes('dr.')) && !t;
        if (data.serviceCategory && (!data.doctorName || isDocMsg)) {
            const dn = userMessage.replace(/select specialist|select|specialist|dr\./gi, '').trim();
            if (dn.length > 3 && !extractTime(dn)) { data.doctorName = dn; return reply(data, 'ask_date', `Date for ${dn}?`); }
            if (!data.doctorName) return reply(data, 'show_doctor_cards', `Select a specialist:`);
        }
        if (data.doctorName && !data.date) { const d = detectDate(msg); if (d) { data.date = d; return reply(data, 'show_slots', `Time for ${data.doctorName} on ${d}:`); } return reply(data, 'ask_date', `Which date for ${data.doctorName}?`); }
        if (data.date && !data.timeSlot) { const tm = extractTime(msg); if (tm) { data.timeSlot = tm; return reply(data, 'ask_name', `Reserved. Full name?`); } return reply(data, 'show_slots', `Pick a slot:`); }
        if (data.timeSlot && !data.userName) { const n = userMessage.replace(/my name is|i am|this is/gi, '').trim(); if (n.length > 2 && !msg.includes('select')) { data.userName = n; return reply(data, 'ask_age', `Age for ${n}?`); } return reply(data, 'ask_name', "Patient's name?"); }
        if (data.userName && !data.userAge) { const a = msg.match(/\d+/)?.[0]; if (a) { data.userAge = a; return reply(data, 'ask_gender', "Gender? (Male/Female)"); } return reply(data, 'ask_age', "Age?"); }
        if (data.userAge && !data.userGender) { if (msg.includes('male') || msg.includes('female')) { data.userGender = msg.includes('female') ? 'Female' : 'Male'; return reply(data, 'ask_phone', "Phone number?"); } return reply(data, 'ask_gender', "Gender?"); }
        if (data.userGender && !data.userPhone) { const p = msg.replace(/\D/g, ''); if (p.length >= 10) { data.userPhone = p; return reply(data, 'ask_email', "Email?"); } return reply(data, 'ask_phone', "Phone?"); }
        if (data.userPhone && !data.userEmail) { if (msg.includes('@')) { data.userEmail = userMessage.trim(); return reply(data, 'confirm_booking', "Confirm summary:", 'confirm_booking'); } return reply(data, 'ask_email', "Email?"); }
        return reply(data, 'confirm_booking', "Review summary:", 'confirm_booking');
    }
    return null;
}

function reply(data, nextStep, message, action = null) { return { intent: data.intent, nextStep, action, extractedData: data, responseMessage: message, lastStep: nextStep }; }
function resetFlowData(data) { Object.keys(data).forEach(k => { if (typeof data[k] === 'boolean') data[k]=false; else data[k]=null; }); return data; }
function startBooking(data) { resetFlowData(data); data.intent='book_appointment'; return reply(data,'show_service_buttons','Which specialty?'); }
function startCancel(data) { resetFlowData(data); data.intent='cancel_appointment'; return reply(data,'ask_lookup_method','How find appointment to cancel?'); }
function startReschedule(data) { resetFlowData(data); data.intent='reschedule_appointment'; return reply(data,'ask_lookup_method','How find appointment to reschedule?'); }
function startInquiry(data) { resetFlowData(data); data.intent='general_inquiry'; return reply(data,'show_topics','How can I help with information?'); }
function startMyBookings(data) { resetFlowData(data); data.intent='my_bookings'; return reply(data,'ask_phone','Registered phone?'); }

function extractCategory(msg) { const cats={cardiology:'Cardiology',dental:'Dental',eye:'Eye Care',neuro:'Neurology',ortho:'Orthopedics'}; for(const[k,v]of Object.entries(cats)) if(msg.includes(k))return v; return null; }
function extractTime(msg){const m=msg.match(/(\d+):00\s*(am|pm)/i)||msg.match(/(\d+)\s*(am|pm)/i);return m?m[0].toUpperCase().replace(/\s+/,''):null;}
function detectDate(msg){const n=new Date();const l=msg.toLowerCase();if(l.includes('tomorrow'))return format(addDays(n,1),'yyyy-MM-dd');const iso=l.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);if(iso)return iso[0];const wk=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];const d=wk.find(w=>l.includes(w));if(d){let f=(wk.indexOf(d)-n.getDay()+7)%7;if(f===0)f=7;return format(addDays(n,f),'yyyy-MM-dd');}return null;}
function extractBookingId(t){const m=t.match(/\b(apt-\d{3,6})\b/i);return m?m[1].toUpperCase():null;}

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
    return { intent: sessionData.intent || 'book_appointment', nextStep: 'show_intent_buttons', responseMessage: 'How can I assist?', extractedData: sessionData, lastStep: 'show_intent_buttons' };
};