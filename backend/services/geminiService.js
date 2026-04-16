const { GoogleGenerativeAI } = require("@google/generative-ai");
const { format, addDays } = require('date-fns');

/**
 * CONCIERGE ENGINE - High Reliability Edition.
 * Flattened state machine to prevent fallthrough resets and improve context retention.
 */

function runStateMachine(userMessage, sessionData) {
    const msg = userMessage.toLowerCase().trim();
    const data = { ...sessionData };
    const last = sessionData.lastStep || '';
    const intent = sessionData.intent || '';

    // --- GLOBAL COMMANDS ---
    const bId = extractBookingId(msg);
    if (bId && (msg.includes('cancel') || msg.includes('reschedule'))) {
        data.intent = msg.includes('cancel') ? 'cancel_appointment' : 'reschedule_appointment';
        data.bookingId = bId; data.lookupMethod = 'bookingId';
        return reply(data, 'fetch_by_id', `Locating appointment ${bId} in our system...`);
    }
    if (msg === 'main menu' || msg === 'restart') return { intent: null, nextStep: 'show_intent_buttons', responseMessage: "Welcome back. How may I assist you now?" };

    // --- INTENT TRIGGERS ---
    // We only trigger a NEW intent if we aren't currently middle-deep in one (unless it's a clear hard-switch)
    const isHardSwitch = (msg.includes('book') && msg.includes('appointment')) || msg.includes('cancel') || msg.includes('reschedule') || msg.includes('my bookings');
    
    if (!intent || isHardSwitch) {
        if ((msg.includes('book') || msg.includes('appointment')) && !msg.includes('cancel') && !msg.includes('reschedule') && !msg.includes('my')) return startBooking(data);
        if (msg.includes('cancel') && !msg.includes('cancel this')) return startCancel(data);
        if (msg.includes('reschedule') && !msg.includes('reschedule this')) return startReschedule(data);
        if (msg.includes('my bookings') || (msg.includes('my') && msg.includes('appointment'))) return startMyBookings(data);
        if (msg.includes('availability') || msg.includes('is open')) return startAvailability(data);
        if (msg.includes('price') || msg.includes('location') || msg.includes('hours')) return startInquiry(data);
    }

    // --- FLOW: BOOK APPOINTMENT ---
    if (intent === 'book_appointment') {
        if (last === 'confirm_booking' && (msg.includes('confirm') || msg.includes('yes'))) return reply(data, 'booking_success', 'Splendid. Your appointment is now confirmed.', 'confirm_booking');
        
        if (!data.serviceCategory) { data.serviceCategory = extractCategory(msg); if (data.serviceCategory) return reply(data, 'show_doctor_cards', `Excellent. Please select your ${data.serviceCategory} specialist:`); return reply(data, 'show_service_buttons', 'For which medical specialty would you like an appointment?'); }
        
        const t = extractTime(msg);
        const isDoc = (msg.includes('select') || msg.includes('dr.')) && !t;
        if (!data.doctorName || isDoc) { const dn = userMessage.replace(/select specialist|select|specialist|dr\./gi, '').trim(); if (dn.length > 3 && !extractTime(dn)) { data.doctorName = dn; return reply(data, 'ask_date', `Dr. ${dn} is available. For which date?`); } return reply(data, 'show_doctor_cards', `Please choose your ${data.serviceCategory} specialist:`); }
        
        if (!data.date) { const d = detectDate(msg); if (d) { data.date = d; return reply(data, 'show_slots', `Found several available slots for Dr. ${data.doctorName} on ${d}:`); } return reply(data, 'ask_date', `Which date for Dr. ${data.doctorName}? (e.g., Tomorrow)`); }
        
        if (!data.timeSlot) { const tm = extractTime(msg); if (tm) { data.timeSlot = tm; return reply(data, 'ask_name', `The ${tm} slot is yours. May I have the patient's full name?`); } return reply(data, 'show_slots', `Please pick a time on ${data.date}:`); }
        
        if (!data.userName) { const n = userMessage.replace(/my name is|i am|this is/gi, '').trim(); if (n.length > 2 && !msg.includes('select')) { data.userName = n; return reply(data, 'ask_age', `Thank you, ${n}. And the patient's age?`); } return reply(data, 'ask_name', "May I have the full legal name for registration?"); }
        
        if (!data.userAge) { const a = msg.match(/\d+/)?.[0]; if (a) { data.userAge = a; return reply(data, 'ask_gender', "And the patient's gender? (Male/Female)"); } return reply(data, 'ask_age', "Please provide the age:"); }
        
        if (!data.userGender) { if (msg.includes('male') || msg.includes('female')) { data.userGender = msg.includes('female') ? 'Female' : 'Male'; return reply(data, 'ask_phone', "We're nearly done. May I have a contact phone number?"); } return reply(data, 'ask_gender', "Gender? (Male or Female)"); }
        
        if (!data.userPhone) { const p = msg.replace(/\D/g, ''); if (p.length >= 10) { data.userPhone = p; return reply(data, 'ask_email', "And an email address for confirmation?"); } return reply(data, 'ask_phone', "I'll need a full 10-digit number:"); }
        
        if (!data.userEmail) { if (msg.includes('@')) { data.userEmail = userMessage.trim(); return reply(data, 'confirm_booking', "Excellent. Please review your summary below one final time:", 'confirm_booking'); } return reply(data, 'ask_email', "Please provide a valid email address:"); }
        
        return reply(data, 'confirm_booking', "Please review your appointment summary below:", 'confirm_booking');
    }

    // --- FLOW: CANCEL ---
    if (intent === 'cancel_appointment') {
        if (last === 'ask_lookup_method') { if (msg.includes('phone')) return reply(data, 'ask_phone_cancel', 'Please provide your registered phone number:'); if (msg.includes('id')) return reply(data, 'ask_booking_id', 'Please provide your Booking ID:'); }
        if (last === 'ask_phone_cancel') { const p = msg.replace(/\D/g, ''); if (p.length >= 10) { data.userPhone = p; return reply(data, 'fetch_by_phone', 'Searching for your records...'); } return reply(data, 'ask_phone_cancel', 'Valid phone please:'); }
        if (last === 'ask_booking_id') { data.bookingId = userMessage.toUpperCase(); return reply(data, 'fetch_by_id', 'Searching...'); }
        if (last === 'fetch_by_id' || last === 'fetch_by_phone' || last === 'show_found_card' || last === 'show_booking_list') { if (msg.includes('cancel')) return reply(data, 'confirm_cancel_final', 'Confirm cancellation?', 'confirm_cancellation'); }
        if (last === 'confirm_cancel_final' && (msg.includes('yes') || msg.includes('confirm') || msg.includes('cancel'))) return reply(data, 'cancelled', 'Success. Appointment cancelled.', 'cancellation_confirmed');
        return reply(data, 'ask_lookup_method', 'How shall we find your record?');
    }

    // --- FLOW: RESCHEDULE ---
    if (intent === 'reschedule_appointment') {
        if (last === 'ask_lookup_method') { if (msg.includes('phone')) return reply(data, 'ask_phone_reschedule', 'Registered phone number?'); if (msg.includes('id')) return reply(data, 'ask_booking_id_reschedule', 'Booking ID?'); }
        if (last === 'ask_phone_reschedule') { const p = msg.replace(/\D/g, ''); if (p.length >= 10) { data.userPhone = p; return reply(data, 'fetch_by_phone', 'Locating visits...'); } return reply(data, 'ask_phone_reschedule', 'Enter valid phone:'); }
        if (last === 'ask_booking_id_reschedule') { data.bookingId = userMessage.toUpperCase(); return reply(data, 'fetch_by_id', 'Searching...'); }
        if (last === 'fetch_by_id' || last === 'fetch_by_phone' || last === 'show_found_card' || last === 'show_booking_list') { if (msg.includes('reschedule')) return reply(data, 'ask_new_date', 'Which new date?'); }
        if (last === 'ask_new_date') { const d = detectDate(msg); if (d) { data.newDate = d; data.date = d; return reply(data, 'show_slots_reschedule', `Slots for your specialist on ${d}:`); } return reply(data, 'ask_new_date', 'Which date?'); }
        if (last === 'show_slots_reschedule') { const t = extractTime(msg); if (t) { data.newTimeSlot = t; return reply(data, 'show_reschedule_confirm', '', 'confirm_reschedule'); } }
        return reply(data, 'ask_lookup_method', 'How find your appointment?');
    }

    // --- FLOW: MY BOOKINGS ---
    if (intent === 'my_bookings') {
        const phone = msg.replace(/\D/g, '');
        if (last === 'ask_phone' && phone.length >= 10) { data.userPhone = phone; return reply(data, 'show_booking_list', 'Searching for your history...'); }
        return reply(data, 'ask_phone', 'To see your bookings, please provide your phone number:');
    }

    // --- FLOW: AVAILABILITY ---
    if (intent === 'check_availability') {
        if (!data.serviceCategory) { data.serviceCategory = extractCategory(msg); if (data.serviceCategory) return reply(data, 'show_doctor_cards', `Which ${data.serviceCategory} specialist?`); return reply(data, 'show_service_buttons', 'Which specialty check?'); }
        if (!data.doctorName || msg.includes('select')) { const dn = userMessage.replace(/select specialist|select/gi, '').trim(); if (dn.length > 3) { data.doctorName = dn; return reply(data, 'ask_date', `Which date for Dr. ${dn}?`); } }
        if (!data.date) { const d = detectDate(msg); if (d) { data.date = d; return reply(data, 'show_slots_readonly', ''); } return reply(data, 'ask_date', 'Which date?'); }
        return reply(data, 'show_service_buttons', 'Which specialty check?');
    }

    return null;
}

function reply(data, nextStep, message, action = null) { return { intent: data.intent, nextStep, action, extractedData: data, responseMessage: message, lastStep: nextStep }; }
function resetFlowData(data) { Object.keys(data).forEach(k => { if (typeof data[k] === 'boolean') data[k]=false; else data[k]=null; }); return data; }
function startBooking(data) { resetFlowData(data); data.intent='book_appointment'; return reply(data,'show_service_buttons','Which medical specialty do you require?'); }
function startCancel(data) { resetFlowData(data); data.intent='cancel_appointment'; return reply(data,'ask_lookup_method','How should we locate the visit you wish to cancel?'); }
function startReschedule(data) { resetFlowData(data); data.intent='reschedule_appointment'; return reply(data,'ask_lookup_method','How find appointment to reschedule?'); }
function startMyBookings(data) { resetFlowData(data); data.intent='my_bookings'; return reply(data,'ask_phone','Enter your phone number to see bookings:'); }
function startAvailability(data) { resetFlowData(data); data.intent='check_availability'; return reply(data,'show_service_buttons','Availability for which specialty?'); }
function startInquiry(data) { resetFlowData(data); data.intent='general_inquiry'; return reply(data,'show_topics','How can I assist with info?'); }

function extractCategory(msg) { const c={cardio:'Cardiology',dent:'Dental',eye:'Eye Care',neuro:'Neurology',ortho:'Orthopedics'}; for(const[k,v]of Object.entries(c)) if(msg.includes(k)) return v; return null; }
function extractTime(msg) { const m=msg.match(/(\d+):00\s*(am|pm)/i)||msg.match(/(\d+)\s*(am|pm)/i); return m?m[0].toUpperCase().replace(/\s+/,''):null; }
function detectDate(msg) { const n=new Date(); const l=msg.toLowerCase(); if(l.includes('tomorrow'))return format(addDays(n,1),'yyyy-MM-dd'); const iso=l.match(/\d{4}-\d{2}-\d{2}/); if(iso)return iso[0]; const wk=['sunday','monday','tuesday','wednesday','thursday','friday','saturday']; const d=wk.find(w=>l.includes(w)); if(d){let f=(wk.indexOf(d)-n.getDay()+7)%7;if(f===0)f=7;return format(addDays(n,f),'yyyy-MM-dd');} return null; }
function extractBookingId(t){const m=t.match(/\b(apt-\d{3,6})\b/i);return m?m[1].toUpperCase():null;}

async function callAI(userMessage, conversationHistory, sessionData, services, doctors) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_1; if (!apiKey) return null;
    try {
        const genAI = new (require("@google/generative-ai").GoogleGenerativeAI)(apiKey.trim());
        const res = await genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" }).startChat({ history: [] }).sendMessage(`JSON ONLY {intent,nextStep,action,extractedData,responseMessage}. User:${userMessage} Data:${JSON.stringify(sessionData)}`);
        const text = res.response.text(); const s = text.indexOf('{'), e = text.lastIndexOf('}'); return s !== -1 ? JSON.parse(text.substring(s, e+1)) : null;
    } catch { return null; }
}

exports.processUserMessage = async (userMessage, conversationHistory, sessionData, services = [], doctors = []) => {
    const machine = runStateMachine(userMessage, sessionData);
    if (machine) { machine.lastStep = machine.nextStep; return machine; }
    const ai = await callAI(userMessage, conversationHistory, sessionData, services, doctors);
    if (ai && ai.responseMessage) { ai.lastStep = ai.nextStep; return ai; }
    return { intent: sessionData.intent, nextStep: 'show_intent_buttons', responseMessage: 'How else may I assist you today?', extractedData: sessionData, lastStep: 'show_intent_buttons' };
};