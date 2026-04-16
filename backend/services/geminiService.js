const { GoogleGenerativeAI } = require("@google/generative-ai");
const { format, addDays } = require('date-fns');

/**
 * CONCIERGE ENGINE - High Reliability V2.
 * Strictly manages context switching and prevents "Intent Stickiness".
 */

function runStateMachine(userMessage, sessionData) {
    const msg = userMessage.toLowerCase().trim();
    const data = { ...sessionData };
    const last = sessionData.lastStep || '';
    const currentIntent = sessionData.intent || '';

    // ── 1. HARD RESET & GLOBAL OVERRIDES ───────────────────────────────────
    if (msg === 'main menu' || msg === 'restart' || msg === 'back to menu') {
        return { intent: null, nextStep: 'show_intent_buttons', responseMessage: "Main Menu reset. How may I assist you today?" };
    }

    const bId = extractBookingId(msg);
    if (bId && (msg.includes('cancel') || msg.includes('reschedule'))) {
        data.intent = msg.includes('cancel') ? 'cancel_appointment' : 'reschedule_appointment';
        data.bookingId = bId; data.lookupMethod = 'bookingId';
        return reply(data, 'fetch_by_id', `Locating appointment ${bId} in our system...`);
    }

    // ── 2. INTENT SWITCHING (Must detect new intent even if one is active) ─
    const intentTriggers = [
        { key: 'book',     val: 'book_appointment' },
        { key: 'appointment', val: 'book_appointment' },
        { key: 'cancel',   val: 'cancel_appointment' },
        { key: 'reschedule', val: 'reschedule_appointment' },
        { key: 'my booking', val: 'my_bookings' },
        { key: 'availability', val: 'check_availability' },
        { key: 'open',     val: 'check_availability' },
        { key: 'inquiry',  val: 'general_inquiry' },
        { key: 'hours',    val: 'general_inquiry' },
        { key: 'location', val: 'general_inquiry' },
        { key: 'price',    val: 'general_inquiry' }
    ];

    // Priority: If message matches a new intent trigger, SWITCH IMMEDIATELY
    // Except when "confirming" or "cancelling this" specific item
    const isConfirmingCmd = msg.includes('confirm') || msg.includes('yes') || msg.includes('this');
    if (!isConfirmingCmd) {
        for (const t of intentTriggers) {
            if (msg.includes(t.key)) {
                // Special case: "My Bookings" vs "Book Appointment"
                if (msg.includes('my') && t.key === 'book') continue; // Let it hit 'my booking' trigger
                if (t.key === 'my booking') return startMyBookings(data);
                if (t.key === 'cancel') return startCancel(data);
                if (t.key === 'reschedule') return startReschedule(data);
                if (t.key === 'book' || t.key === 'appointment') return startBooking(data);
                if (t.key === 'availability' || t.key === 'open') return startAvailability(data);
                if (t.key === 'inquiry' || t.key === 'hours' || t.key === 'location' || t.key === 'price') return startInquiry(data);
            }
        }
    }

    const intent = data.intent || '';

    // ── 3. FLOW: BOOK APPOINTMENT ──────────────────────────────────────────
    if (intent === 'book_appointment') {
        if (last === 'confirm_booking' && (msg.includes('confirm') || msg.includes('yes'))) return reply(data, 'booking_success', 'Splendid. Your visit is now confirmed.', 'confirm_booking');
        
        if (!data.serviceCategory) { data.serviceCategory = extractCategory(msg); if (data.serviceCategory) return reply(data, 'show_doctor_cards', `Certainly. Please select your ${data.serviceCategory} specialist:`); return reply(data, 'show_service_buttons', 'Which medical specialty do you require?'); }
        
        const t = extractTime(msg);
        const isDoc = (msg.includes('select') || msg.includes('dr.')) && !t;
        if (!data.doctorName || isDoc) { const dn = userMessage.replace(/select specialist|select|specialist|dr\./gi, '').trim(); if (dn.length > 3 && !extractTime(dn)) { data.doctorName = dn; return reply(data, 'ask_date', `Dr. ${dn} is available. For which date?`); } return reply(data, 'show_doctor_cards', `Please choose your ${data.serviceCategory} specialist:`); }
        
        if (!data.date) { const d = detectDate(msg); if (d) { data.date = d; return reply(data, 'show_slots', `Found available slots for Dr. ${data.doctorName} on ${d}:`); } return reply(data, 'ask_date', `Which date for Dr. ${data.doctorName}?`); }
        
        if (!data.timeSlot) { const tm = extractTime(msg); if (tm) { data.timeSlot = tm; return reply(data, 'ask_name', `Reserved ${tm}. May I have the patient's full name?`); } return reply(data, 'show_slots', `Please pick a time on ${data.date}:`); }
        
        if (!data.userName) { const n = userMessage.replace(/my name is|i am|this is/gi, '').trim(); if (n.length > 2 && !msg.includes('select')) { data.userName = n; return reply(data, 'ask_age', `Thank you, ${n}. Patient's age?`); } return reply(data, 'ask_name', "Patient's full legal name?"); }
        
        if (!data.userAge) { const a = msg.match(/\d+/)?.[0]; if (a) { data.userAge = a; return reply(data, 'ask_gender', "Gender? (Male/Female)"); } return reply(data, 'ask_age', "Please provide the age:"); }
        
        if (!data.userGender) { if (msg.includes('male') || msg.includes('female')) { data.userGender = msg.includes('female') ? 'Female' : 'Male'; return reply(data, 'ask_phone', "Contact phone number?"); } return reply(data, 'ask_gender', "Gender? (Male/Female)"); }
        
        if (!data.userPhone) { const p = msg.replace(/\D/g, ''); if (p.length >= 10) { data.userPhone = p; return reply(data, 'ask_email', "And email address for confirmation?"); } return reply(data, 'ask_phone', "Full 10-digit phone number:"); }
        
        if (!data.userEmail) { if (msg.includes('@')) { data.userEmail = userMessage.trim(); return reply(data, 'confirm_booking', "Excellent. Review your summary below:", 'confirm_booking'); } return reply(data, 'ask_email', "Valid email address:"); }
        
        return reply(data, 'confirm_booking', "Please review your appointment summary below:", 'confirm_booking');
    }

    // ── 4. FLOW: CANCEL ────────────────────────────────────────────────────
    if (intent === 'cancel_appointment') {
        if (last === 'ask_phone_cancel') { const p = msg.replace(/\D/g, ''); if (p.length >= 10) { data.userPhone = p; return reply(data, 'fetch_by_phone', 'Searching for your records...'); } return reply(data, 'ask_phone_cancel', 'Valid 10-digit phone please:'); }
        if (last === 'ask_booking_id') { data.bookingId = userMessage.toUpperCase(); return reply(data, 'fetch_by_id', 'Searching...'); }
        if (last === 'confirm_cancel_final' && (msg.includes('yes') || msg.includes('confirm') || msg.includes('cancel'))) return reply(data, 'cancelled', 'Success. Appointment cancelled.', 'cancellation_confirmed');
        if (last === 'fetch_by_id' || last === 'fetch_by_phone' || last === 'show_found_card' || last === 'show_booking_list') { if (msg.includes('cancel')) return reply(data, 'confirm_cancel_final', 'Confirm cancellation?', 'confirm_cancellation'); }
        return reply(data, 'ask_lookup_method', 'How should we locate the visit you wish to cancel?');
    }

    // ── 5. FLOW: RESCHEDULE ────────────────────────────────────────────────
    if (intent === 'reschedule_appointment') {
        if (last === 'ask_phone_reschedule') { const p = msg.replace(/\D/g, ''); if (p.length >= 10) { data.userPhone = p; return reply(data, 'fetch_by_phone', 'Locating visits...'); } return reply(data, 'ask_phone_reschedule', 'Valid phone:'); }
        if (last === 'ask_booking_id_reschedule') { data.bookingId = userMessage.toUpperCase(); return reply(data, 'fetch_by_id', 'Searching...'); }
        if (last === 'ask_new_date') { const d = detectDate(msg); if (d) { data.newDate = d; data.date = d; return reply(data, 'show_slots_reschedule', `Slots on ${d}:`); } return reply(data, 'ask_new_date', 'Which date?'); }
        if (last === 'show_slots_reschedule') { const t = extractTime(msg); if (t) { data.newTimeSlot = t; return reply(data, 'show_reschedule_confirm', '', 'confirm_reschedule'); } }
        if (last === 'fetch_by_id' || last === 'fetch_by_phone' || last === 'show_found_card' || last === 'show_booking_list') { if (msg.includes('reschedule')) return reply(data, 'ask_new_date', 'What new date?'); }
        return reply(data, 'ask_lookup_method', 'How find appointment to reschedule?');
    }

    // ── 6. FLOW: MY BOOKINGS ───────────────────────────────────────────────
    if (intent === 'my_bookings') {
        const phone = msg.replace(/\D/g, '');
        if (last === 'ask_phone' && phone.length >= 10) { data.userPhone = phone; return reply(data, 'show_booking_list', 'Searching your history...'); }
        return reply(data, 'ask_phone', 'Provide your phone number to see bookings:');
    }

    // ── 7. FLOW: AVAILABILITY ──────────────────────────────────────────────
    if (intent === 'check_availability') {
        if (!data.serviceCategory) { data.serviceCategory = extractCategory(msg); if (data.serviceCategory) return reply(data, 'show_doctor_cards', `Which ${data.serviceCategory} specialist?`); return reply(data, 'show_service_buttons', 'Availability for which specialty?'); }
        if (!data.date) { const d = detectDate(msg); if (d) { data.date = d; return reply(data, 'show_slots_readonly', ''); } return reply(data, 'ask_date', 'Which date?'); }
        return reply(data, 'show_service_buttons', 'Availability for which specialty?');
    }

    // ── 8. FLOW: INQUIRY ───────────────────────────────────────────────────
    if (intent === 'general_inquiry') {
        if (msg.includes('price')) return reply({ ...data, inquiryCardType: 'prices' }, 'show_info_card', 'Pricing summary:');
        if (msg.includes('hours')) return reply(data, 'show_info_card', 'Clinic hours:');
        if (msg.includes('location')) return reply(data, 'show_info_card', 'Our location:');
        return reply(data, 'show_topics', 'How can I assist with info?');
    }

    return null;
}

function reply(data, nextStep, message, action = null) { return { intent: data.intent, nextStep, action, extractedData: data, responseMessage: message, lastStep: nextStep }; }
function startBooking(data) { const d=resetFlowData(data); d.intent='book_appointment'; return reply(d,'show_service_buttons','Which medical specialty do you require?'); }
function startCancel(data) { const d=resetFlowData(data); d.intent='cancel_appointment'; return reply(d,'ask_lookup_method','How should we locate the visit you wish to cancel?'); }
function startReschedule(data) { const d=resetFlowData(data); d.intent='reschedule_appointment'; return reply(d,'ask_lookup_method','How find appointment to reschedule?'); }
function startMyBookings(data) { const d=resetFlowData(data); d.intent='my_bookings'; return reply(d,'ask_phone','Enter your phone number to see bookings:'); }
function startAvailability(data) { const d=resetFlowData(data); d.intent='check_availability'; return reply(d,'show_service_buttons','Availability for which specialty?'); }
function startInquiry(data) { const d=resetFlowData(data); d.intent='general_inquiry'; return reply(d,'show_topics','How can I assist with info?'); }
function resetFlowData(data) { const d={}; Object.keys(data).forEach(k => { if (typeof data[k] === 'boolean') d[k]=false; else d[k]=null; }); return d; }

function extractCategory(msg) { const c={cardio:'Cardiology',dent:'Dental',eye:'Eye Care',neuro:'Neurology',ortho:'Orthopedics'}; for(const[k,v]of Object.entries(c)) if(msg.includes(k)) return v; return null; }
function extractTime(msg) { const m=msg.match(/(\d+):00\s*(am|pm)/i)||msg.match(/(\d+)\s*(am|pm)/i); return m?m[0].toUpperCase().replace(/\s+/,''):null; }
function detectDate(msg) { const n=new Date(); const l=msg.toLowerCase(); if(l.includes('tomorrow'))return format(addDays(n,1),'yyyy-MM-dd'); const iso=l.match(/\d{4}-\d{2}-\d{2}/); if(iso)return iso[0]; const wk=['sunday','monday','tuesday','wednesday','thursday','friday','saturday']; const d=wk.find(w=>l.includes(w)); if(d){let f=(wk.indexOf(d)-n.getDay()+7)%7;if(f===0)f=7;return format(addDays(n,f),'yyyy-MM-dd');} return null; }
function extractBookingId(t){const m=t.match(/\b(apt-\d{3,6})\b/i);return m?m[1].toUpperCase():null;}

async function callAI(userMessage, conversationHistory, sessionData, services, doctors) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_1; if (!apiKey) return null;
    try {
        const genAI = new (require("@google/generative-ai").GoogleGenerativeAI)(apiKey.trim());
        const res = await genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" }).startChat({ history: [] }).sendMessage(`JSON ONLY {intent,nextStep,action,extractedData,responseMessage}. User:${userMessage}`);
        const text = res.response.text(); const s = text.indexOf('{'), e = text.lastIndexOf('}'); return s !== -1 ? JSON.parse(text.substring(s, e+1)) : null;
    } catch { return null; }
}

exports.processUserMessage = async (userMessage, conversationHistory, sessionData, services = [], doctors = []) => {
    const machine = runStateMachine(userMessage, sessionData);
    if (machine) { machine.lastStep = machine.nextStep; return machine; }
    const ai = await callAI(userMessage, conversationHistory, sessionData, services, doctors);
    if (ai && ai.responseMessage) { ai.lastStep = ai.nextStep; return ai; }
    return { intent: sessionData.intent, nextStep: 'show_intent_buttons', responseMessage: 'How else may I assist you?', extractedData: sessionData, lastStep: 'show_intent_buttons' };
};