const { GoogleGenerativeAI } = require("@google/generative-ai");
const { format, addDays } = require('date-fns');

/**
 * CONCIERGE ENGINE - High Reliability V3.
 * Dynamic intent switching with safety locks and refined personality.
 */

function runStateMachine(userMessage, sessionData) {
    const msg = userMessage.toLowerCase().trim();
    const data = { ...sessionData };
    const lastStep = sessionData.lastStep || '';
    const currentIntent = sessionData.intent || '';

    // ── 1. GLOBAL OVERRIDES (Always Interrupt) ───────────────────────────
    if (msg === 'main menu' || msg === 'restart' || msg === 'back to menu') {
        return { intent: null, nextStep: 'show_intent_buttons', responseMessage: "Welcome back to the main menu. How may I assist you now?" };
    }

    const bId = extractBookingId(msg);
    if (bId && (msg.includes('cancel') || msg.includes('reschedule'))) {
        data.intent = msg.includes('cancel') ? 'cancel_appointment' : 'reschedule_appointment';
        data.bookingId = bId;
        data.lookupMethod = 'bookingId';
        return reply(data, 'fetch_by_id', `Locating appointment ${bId} in our records...`);
    }

    // ── 2. INTENT SWITCHING ───────────────────────────────────────────────
    // Only switch if we're not confirming something or if it's a hard intent change
    const isConfirming = msg.includes('confirm') || msg.includes('yes') || msg.includes('this');
    const newIntent = detectIntent(msg);

    if (newIntent && !isConfirming) {
        // If we are already in an intent and the user asks for the SAME intent keywords, don't restart the flow
        // (e.g. if already in inquiry and they say "service prices")
        if (newIntent !== currentIntent) {
            if (newIntent === 'book_appointment') return startBooking(data);
            if (newIntent === 'cancel_appointment') return startCancel(data);
            if (newIntent === 'reschedule_appointment') return startReschedule(data);
            if (newIntent === 'my_bookings') return startMyBookings(data);
            if (newIntent === 'check_availability') return startAvailability(data);
            if (newIntent === 'general_inquiry') return startInquiry(data);
        }
    }

    const intent = data.intent || '';

    // ── 3. FLOW: BOOK APPOINTMENT ──────────────────────────────────────────
    if (intent === 'book_appointment') {
        if (lastStep === 'confirm_booking' && (msg.includes('confirm') || msg.includes('yes'))) return reply(data, 'booking_success', 'Perfect. Your visit is now confirmed.', 'confirm_booking');
        
        if (!data.serviceCategory) { data.serviceCategory = extractCategory(msg); if (data.serviceCategory) return reply(data, 'show_doctor_cards', `Splendid. Please select your ${data.serviceCategory} specialist:`); return reply(data, 'show_service_buttons', 'For which medical specialty would you like an appointment?'); }
        
        const t = extractTime(msg);
        const isSelectingDoc = (msg.includes('select') || msg.includes('dr.')) && !t;
        if (!data.doctorName || isSelectingDoc) { const dn = userMessage.replace(/select specialist|select|specialist|dr\./gi, '').trim(); if (dn.length > 3 && !extractTime(dn)) { data.doctorName = dn; return reply(data, 'ask_date', `Dr. ${dn} is an excellent choice. On which date would you like to visit?`); } return reply(data, 'show_doctor_cards', `Please choose your ${data.serviceCategory} specialist:`); }
        
        if (!data.date) { const d = detectDate(msg); if (d) { data.date = d; return reply(data, 'show_slots', `I found several available times for Dr. ${data.doctorName} on ${d}:`); } return reply(data, 'ask_date', `For which date should we book Dr. ${data.doctorName}?`); }
        
        if (!data.timeSlot) { const tm = extractTime(msg); if (tm) { data.timeSlot = tm; return reply(data, 'ask_name', `The ${tm} slot is reserved. May I have the patient's full legal name?`); } return reply(data, 'show_slots', `Please pick a preferred time for ${data.date}:`); }
        
        if (!data.userName) { const n = userMessage.replace(/my name is|i am|this is|name is/gi, '').trim(); if (n.length > 2 && !msg.includes('select')) { data.userName = n; return reply(data, 'ask_age', `Thank you, ${n}. And what is the patient's age?`); } return reply(data, 'ask_name', "Please provide the patient's full legal name:"); }
        
        if (!data.userAge) { const a = msg.match(/\d+/)?.[0]; if (a) { data.userAge = a; return reply(data, 'ask_gender', "And the patient's gender? (Male/Female)"); } return reply(data, 'ask_age', `Could you please provide the age for ${data.userName}?`); }
        
        if (!data.userGender) { if (msg.includes('male') || msg.includes('female')) { data.userGender = msg.includes('female') ? 'Female' : 'Male'; return reply(data, 'ask_phone', "Splendid. May I have a contact phone number for the visit?"); } return reply(data, 'ask_gender', "And the gender? (Male or Female)"); }
        
        if (!data.userPhone) { const p = msg.replace(/\D/g, ''); if (p.length >= 10) { data.userPhone = p; return reply(data, 'ask_email', "Lastly, an email address where we may send your confirmation?"); } return reply(data, 'ask_phone', "I will need a full 10-digit number to secure your booking:"); }
        
        if (!data.userEmail) { if (msg.includes('@')) { data.userEmail = userMessage.trim(); return reply(data, 'confirm_booking', "Excellent. Please review your summary below one final time:", 'confirm_booking'); } return reply(data, 'ask_email', "Please provide a valid email address:"); }
        
        return reply(data, 'confirm_booking', "Please review your appointment summary below:", 'confirm_booking');
    }

    // ── 4. FLOW: INQUIRY ───────────────────────────────────────────────────
    if (intent === 'general_inquiry') {
        if (msg.includes('price')) return reply({ ...data, inquiryCardType: 'prices' }, 'show_info_card', 'Our latest service and consult fees are listed below:');
        if (msg.includes('duration') || msg.includes('time')) return reply({ ...data, inquiryCardType: 'duration' }, 'show_info_card', 'Here are the typical durations for our treatments:');
        if (msg.includes('doctor')) return reply(data, 'show_doctor_groups', 'Meet our team of board-certified specialists:');
        if (msg.includes('hours') || msg.includes('open')) return reply(data, 'show_info_card', 'Elite Wellness is pleased to serve you during these hours:');
        if (msg.includes('location')) return reply(data, 'show_info_card', 'We are conveniently located here:');
        return reply(data, 'show_topics', 'Our concierge is standing by. What information can I provide today?');
    }

    // ── 5. FLOW: CANCEL ────────────────────────────────────────────────────
    if (intent === 'cancel_appointment') {
        if (lastStep === 'ask_phone_cancel') { const p = msg.replace(/\D/g, ''); if (p.length >= 10) { data.userPhone = p; return reply(data, 'fetch_by_phone', 'Searching our database for your records...'); } return reply(data, 'ask_phone_cancel', 'Please provide a valid 10-digit phone number:'); }
        if (lastStep === 'ask_booking_id') { data.bookingId = userMessage.toUpperCase(); return reply(data, 'fetch_by_id', 'Locating your ID. Please wait a moment...'); }
        if (lastStep === 'confirm_cancel_final' && (msg.includes('yes') || msg.includes('confirm') || msg.includes('cancel'))) return reply(data, 'cancelled', 'Success. Your appointment is now cancelled.', 'cancellation_confirmed');
        if (lastStep === 'fetch_by_id' || lastStep === 'fetch_by_phone' || lastStep === 'show_found_card' || lastStep === 'show_booking_list') { if (msg.includes('cancel')) return reply(data, 'confirm_cancel_final', 'I have identified the visit. Are you certain you wish to cancel?', 'confirm_cancellation'); }
        return reply(data, 'ask_lookup_method', 'How should we locate the visit you wish to cancel?');
    }

    // ── 6. FLOW: RESCHEDULE ────────────────────────────────────────────────
    if (intent === 'reschedule_appointment') {
        if (lastStep === 'ask_phone_reschedule') { const p = msg.replace(/\D/g, ''); if (p.length >= 10) { data.userPhone = p; return reply(data, 'fetch_by_phone', 'Locating your visits...'); } return reply(data, 'ask_phone_reschedule', 'Please provide a full 10-digit number:'); }
        if (lastStep === 'ask_booking_id_reschedule') { data.bookingId = userMessage.toUpperCase(); return reply(data, 'fetch_by_id', 'Searching...'); }
        if (lastStep === 'ask_new_date') { const d = detectDate(msg); if (d) { data.newDate = d; data.date = d; return reply(data, 'show_slots_reschedule', `I found available slots on ${d}:`); } return reply(data, 'ask_new_date', 'Which date would you like to move your visit to?'); }
        if (lastStep === 'show_slots_reschedule') { const t = extractTime(msg); if (t) { data.newTimeSlot = t; return reply(data, 'show_reschedule_confirm', '', 'confirm_reschedule'); } }
        if (lastStep === 'fetch_by_id' || lastStep === 'fetch_by_phone' || lastStep === 'show_found_card' || lastStep === 'show_booking_list') { if (msg.includes('reschedule')) return reply(data, 'ask_new_date', 'What new date should we look for?'); }
        return reply(data, 'ask_lookup_method', 'How find appointment to reschedule?');
    }

    // ── 7. FLOW: MY BOOKINGS ───────────────────────────────────────────────
    if (intent === 'my_bookings') {
        const phone = msg.replace(/\D/g, '');
        if (lastStep === 'ask_phone' && phone.length >= 10) { data.userPhone = phone; return reply(data, 'show_booking_list', 'Fetching your upcoming visits...'); }
        return reply(data, 'ask_phone', 'Please provide your registered phone number to see your bookings:');
    }

    return null;
}

function detectIntent(msg) {
    if (msg.includes('book') || msg.includes('appointment')) return 'book_appointment';
    if (msg.includes('cancel')) return 'cancel_appointment';
    if (msg.includes('reschedule')) return 'reschedule_appointment';
    if (msg.includes('my booking')) return 'my_bookings';
    if (msg.includes('availability') || msg.includes('open')) return 'check_availability';
    if (msg.includes('inquiry') || msg.includes('price') || msg.includes('hour') || msg.includes('location')) return 'general_inquiry';
    return null;
}

function reply(data, nextStep, message, action = null) { return { intent: data.intent, nextStep, action, extractedData: data, responseMessage: message, lastStep: nextStep }; }
function startBooking(data) { const d=reset(data); d.intent='book_appointment'; return reply(d,'show_service_buttons','For which medical specialty would you like an appointment?'); }
function startCancel(data) { const d=reset(data); d.intent='cancel_appointment'; return reply(d,'ask_lookup_method','How should we find the appointment you wish to cancel?'); }
function startReschedule(data) { const d=reset(data); d.intent='reschedule_appointment'; return reply(d,'ask_lookup_method','How find appointment to reschedule?'); }
function startMyBookings(data) { const d=reset(data); d.intent='my_bookings'; return reply(d,'ask_phone','To see your bookings, please provide your phone number:'); }
function startAvailability(data) { const d=reset(data); d.intent='check_availability'; return reply(d,'show_service_buttons','Check availability for which specialty?'); }
function startInquiry(data) { const d=reset(data); d.intent='general_inquiry'; return reply(d,'show_topics','What information would you like to request today?'); }
function reset(data) { const d={}; Object.keys(data).forEach(k => { if (typeof data[k] === 'boolean') d[k]=false; else d[k]=null; }); return d; }

function extractCategory(msg) { const c={cardio:'Cardiology',dent:'Dental',eye:'Eye Care',neuro:'Neurology',ortho:'Orthopedics'}; for(const[k,v]of Object.entries(c)) if(msg.includes(k)) return v; return null; }
function extractTime(msg) { const m=msg.match(/(\d+):00\s*(am|pm)/i)||msg.match(/(\d+)\s*(am|pm)/i); return m?m[0].toUpperCase().replace(/\s+/,''):null; }
function detectDate(msg) { const n=new Date(); const l=msg.toLowerCase(); if(l.includes('tomorrow'))return format(addDays(n,1),'yyyy-MM-dd'); const iso=l.match(/\d{4}-\d{2}-\d{2}/); if(iso)return iso[0]; const wk=['sunday','monday','tuesday','wednesday','thursday','friday','saturday']; const d=wk.find(w=>l.includes(w)); if(d){let f=(wk.indexOf(d)-n.getDay()+7)%7;if(f===0)f=7;return format(addDays(n,f),'yyyy-MM-dd');} return null; }
function extractBookingId(t){const m=t.match(/\b(apt-\d{3,6})\b/i);return m?m[1].toUpperCase():null;}

exports.processUserMessage = async (userMessage, conversationHistory, sessionData, services = [], doctors = []) => {
    const machine = runStateMachine(userMessage, sessionData);
    if (machine) { machine.lastStep = machine.nextStep; return machine; }
    return { intent: sessionData.intent, nextStep: 'show_intent_buttons', responseMessage: 'How else may I assist you today?', extractedData: sessionData, lastStep: 'show_intent_buttons' };
};