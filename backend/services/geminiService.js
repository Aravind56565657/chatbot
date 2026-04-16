const { format, addDays } = require('date-fns');

/**
 * ELITE CONCIERGE ENGINE - Deterministic Logic V4.
 * High-precision state management with forced intent retention.
 */

function runStateMachine(userMessage, sessionData) {
    const msg = userMessage.toLowerCase().trim();
    const data = { ...sessionData };
    const lastStep = sessionData.lastStep || '';
    
    // 1. GLOBAL OVERRIDES
    if (msg === 'main menu' || msg === 'restart' || msg === 'restart flow') {
        return { intent: null, nextStep: 'show_intent_buttons', responseMessage: "Welcome back to the main menu. How may I assist you now?" };
    }

    // 2. INTENT DETECTION & SWITCHING
    // If we have a clear intent trigger, switch UNLESS we are in a confirmation step
    const detected = detectIntent(msg);
    const isConfirming = msg.includes('confirm') || msg.includes('yes') || msg.includes('this');
    
    if (detected && !isConfirming) {
        // If switching to a NEW intent, reset flow data for that intent
        if (detected !== sessionData.intent) {
            const d = resetData(data);
            if (detected === 'book_appointment') return startBooking(d);
            if (detected === 'cancel_appointment') return startCancel(d);
            if (detected === 'reschedule_appointment') return startReschedule(d);
            if (detected === 'my_bookings') return startMyBookings(d);
            if (detected === 'check_availability') return startAvailability(d);
            if (detected === 'general_inquiry') return startInquiry(d);
        }
    }

    const intent = sessionData.intent || '';

    // ── FLOW: BOOK APPOINTMENT ──────────────────────────────────────────
    if (intent === 'book_appointment') {
        if (lastStep === 'confirm_booking' && (msg.includes('confirm') || msg.includes('yes'))) return reply(data, 'booking_success', 'Perfect. Your visit is now confirmed.', 'confirm_booking');
        if (!data.serviceCategory) { data.serviceCategory = extractCategory(msg); if (data.serviceCategory) return reply(data, 'show_doctor_cards', `Certainly. Please select your ${data.serviceCategory} specialist:`); return reply(data, 'show_service_buttons', 'For which medical specialty would you like an appointment?'); }
        const t = extractTime(msg);
        const isSel = (msg.includes('select') || msg.includes('dr.')) && !t;
        if (!data.doctorName || isSel) { const dn = userMessage.replace(/select specialist|select|dr\./gi, '').trim(); if (dn.length > 3 && !extractTime(dn)) { data.doctorName = dn; return reply(data, 'ask_date', `Dr. ${dn} is an excellent choice. On which date would you like to visit?`); } return reply(data, 'show_doctor_cards', `Please choose your ${data.serviceCategory} specialist:`); }
        if (!data.date) { const d = detectDate(msg); if (d) { data.date = d; return reply(data, 'show_slots', `Found available times for Dr. ${data.doctorName} on ${d}:`); } return reply(data, 'ask_date', `For which date should we book Dr. ${data.doctorName}?`); }
        if (!data.timeSlot) { const tm = extractTime(msg); if (tm) { data.timeSlot = tm; return reply(data, 'ask_name', `Reserved ${tm}. May I have the patient's full name?`); } return reply(data, 'show_slots', `Please pick a preferred time for ${data.date}:`); }
        if (!data.userName) { const n = userMessage.replace(/my name is|i am|this is|name is/gi, '').trim(); if (n.length > 2 && !msg.includes('select')) { data.userName = n; return reply(data, 'ask_age', `Thank you, ${n}. Patient's age?`); } return reply(data, 'ask_name', "Please provide the patient's full legal name:"); }
        if (!data.userAge) { const a = msg.match(/\d+/)?.[0]; if (a) { data.userAge = a; return reply(data, 'ask_gender', "Gender? (Male/Female)"); } return reply(data, 'ask_age', "Please provide the age:"); }
        if (!data.userGender) { if (msg.includes('male') || msg.includes('female')) { data.userGender = msg.includes('female') ? 'Female' : 'Male'; return reply(data, 'ask_phone', "Contact phone number?"); } return reply(data, 'ask_gender', "Gender? (Male/Female)"); }
        if (!data.userPhone) { const p = msg.replace(/\D/g, ''); if (p.length >= 10) { data.userPhone = p; return reply(data, 'ask_email', "And email address for confirmation?"); } return reply(data, 'ask_phone', "Full 10-digit phone number:"); }
        if (!data.userEmail) { if (msg.includes('@')) { data.userEmail = userMessage.trim(); return reply(data, 'confirm_booking', "Excellent. Review your summary below:", 'confirm_booking'); } return reply(data, 'ask_email', "Valid email address:"); }
        return reply(data, 'confirm_booking', "Please review your appointment summary below:", 'confirm_booking');
    }

    // ── FLOW: CHECK AVAILABILITY ──────────────────────────────────────────
    if (intent === 'check_availability') {
        if (!data.serviceCategory) { data.serviceCategory = extractCategory(msg); if (data.serviceCategory) return reply(data, 'show_doctor_cards', `Certainly. Which ${data.serviceCategory} specialist's schedule would you like to view?`); return reply(data, 'show_service_buttons', 'Choose a specialty to check availability:'); }
        if (!data.doctorName || msg.includes('select')) { const dn = userMessage.replace(/select specialist|select|dr\./gi, '').trim(); if (dn.length > 2) { data.doctorName = dn; return reply(data, 'ask_date', `Checking availability for Dr. ${dn}. For which date?`); } return reply(data, 'show_doctor_cards', `Select a specialist:`); }
        if (!data.date) { const d = detectDate(msg); if (d) { data.date = d; return reply(data, 'show_slots_readonly', `Here is the schedule for Dr. ${data.doctorName} on ${d}:`); } return reply(data, 'ask_date', `Which date should I check for Dr. ${data.doctorName}?`); }
        return reply(data, 'show_service_buttons', 'Availability for which specialty?');
    }

    // ── FLOW: INQUIRY ───────────────────────────────────────────────────
    if (intent === 'general_inquiry') {
        if (msg.includes('price')) return reply({ ...data, inquiryCardType: 'prices' }, 'show_info_card', 'Our current pricing and consult fees:');
        if (msg.includes('hour') || msg.includes('open')) return reply(data, 'show_info_card', 'Clinic hours:');
        if (msg.includes('location')) return reply(data, 'show_info_card', 'Our location:');
        return reply(data, 'show_topics', 'How can our concierge assist you with information?');
    }

    // ── FLOW: CANCEL ──────────────────────────────────────────────────────
    if (intent === 'cancel_appointment') {
        if (lastStep === 'ask_phone_cancel') { const p = msg.replace(/\D/g, ''); if (p.length >= 10) { data.userPhone = p; return reply(data, 'fetch_by_phone', 'Locating your record...'); } return reply(data, 'ask_phone_cancel', 'Enter a valid 10-digit number:'); }
        if (lastStep === 'ask_booking_id') { data.bookingId = userMessage.toUpperCase(); return reply(data, 'fetch_by_id', 'Searching...'); }
        if (lastStep === 'confirm_cancel_final' && (msg.includes('yes') || msg.includes('confirm') || msg.includes('cancel'))) return reply(data, 'cancelled', 'Success. Appointment cancelled.', 'cancellation_confirmed');
        if (lastStep === 'fetch_by_id' || lastStep === 'fetch_by_phone' || lastStep === 'show_found_card' || lastStep === 'show_booking_list') { if (msg.includes('cancel')) return reply(data, 'confirm_cancel_final', 'Confirm cancellation?', 'confirm_cancellation'); }
        return reply(data, 'ask_lookup_method', 'How should we locate the visit you wish to cancel?');
    }

    // ── FLOW: RESCHEDULE ──────────────────────────────────────────────────
    if (intent === 'reschedule_appointment') {
        if (lastStep === 'ask_phone_reschedule') { const p = msg.replace(/\D/g, ''); if (p.length >= 10) { data.userPhone = p; return reply(data, 'fetch_by_phone', 'Locating appointments...'); } return reply(data, 'ask_phone_reschedule', 'Valid phone:'); }
        if (lastStep === 'ask_new_date') { const d = detectDate(msg); if (d) { data.newDate = d; data.date = d; return reply(data, 'show_slots_reschedule', `Slots for your specialist on ${d}:`); } return reply(data, 'ask_new_date', 'Which new date?'); }
        if (lastStep === 'show_slots_reschedule') { const t = extractTime(msg); if (t) { data.newTimeSlot = t; return reply(data, 'show_reschedule_confirm', '', 'confirm_reschedule'); } }
        if (lastStep === 'fetch_by_id' || lastStep === 'fetch_by_phone' || lastStep === 'show_found_card' || lastStep === 'show_booking_list') { if (msg.includes('reschedule')) return reply(data, 'ask_new_date', 'What new date?'); }
        return reply(data, 'ask_lookup_method', 'How find appointment to reschedule?');
    }

    // ── FLOW: MY BOOKINGS ─────────────────────────────────────────────────
    if (intent === 'my_bookings') {
        const phone = msg.replace(/\D/g, '');
        if (lastStep === 'ask_phone' && phone.length >= 10) { data.userPhone = phone; return reply(data, 'show_booking_list', 'Fetching history...'); }
        return reply(data, 'ask_phone', 'Provide your phone number to see bookings:');
    }

    return null;
}

function detectIntent(msg) {
    if (msg.includes('book') || msg.includes('appointment')) return 'book_appointment';
    if (msg.includes('cancel')) return 'cancel_appointment';
    if (msg.includes('reschedule')) return 'reschedule_appointment';
    if (msg.startsWith('my booking') || (msg.includes('my') && msg.includes('booking'))) return 'my_bookings';
    if (msg.includes('availability') || msg.includes('open') || msg.includes('available')) return 'check_availability';
    if (msg.includes('inquiry') || msg.includes('price') || msg.includes('hour') || msg.includes('location')) return 'general_inquiry';
    return null;
}

function reply(data, nextStep, message, action = null) { return { intent: data.intent, nextStep, action, extractedData: data, responseMessage: message, lastStep: nextStep }; }
function startBooking(d) { d.intent='book_appointment'; return reply(d,'show_service_buttons','For which medical specialty do you require?'); }
function startCancel(d) { d.intent='cancel_appointment'; return reply(d,'ask_lookup_method','How find appointment to cancel?'); }
function startReschedule(d) { d.intent='reschedule_appointment'; return reply(d,'ask_lookup_method','How find appointment to reschedule?'); }
function startMyBookings(d) { d.intent='my_bookings'; return reply(d,'ask_phone','Enter phone number for history:'); }
function startAvailability(d) { d.intent='check_availability'; return reply(d,'show_service_buttons','Availability for which specialty?'); }
function startInquiry(d) { d.intent='general_inquiry'; return reply(d,'show_topics','Information requested. What would you like to know?'); }
function resetData(data) { const d={}; Object.keys(data).forEach(k => { if (typeof data[k] === 'boolean') d[k]=false; else d[k]=null; }); return d; }

function extractCategory(msg) { const c={cardio:'Cardiology',dent:'Dental',eye:'Eye Care',neuro:'Neurology',ortho:'Orthopedics'}; for(const[k,v]of Object.entries(c)) if(msg.includes(k)) return v; return null; }
function extractTime(msg) { const m=msg.match(/(\d+):00\s*(am|pm)/i)||msg.match(/(\d+)\s*(am|pm)/i); return m?m[0].toUpperCase().replace(/\s+/,''):null; }
function detectDate(msg) { const n=new Date(); const l=msg.toLowerCase(); if(l.includes('tomorrow'))return format(addDays(n,1),'yyyy-MM-dd'); if(l.includes('day after tomorrow'))return format(addDays(n,2),'yyyy-MM-dd'); const iso=l.match(/\d{4}-\d{2}-\d{2}/); if(iso)return iso[0]; const wk=['sunday','monday','tuesday','wednesday','thursday','friday','saturday']; const d=wk.find(w=>l.includes(w)); if(d){let f=(wk.indexOf(d)-n.getDay()+7)%7;if(f===0)f=7;return format(addDays(n,f),'yyyy-MM-dd');} return null; }
function extractBookingId(t){const m=t.match(/\b(apt-\d{3,6})\b/i);return m?m[1].toUpperCase():null;}

exports.processUserMessage = async (userMessage, conversationHistory, sessionData, services = [], doctors = []) => {
    const machine = runStateMachine(userMessage, sessionData);
    if (machine) { machine.lastStep = machine.nextStep; return machine; }
    return { intent: sessionData.intent, nextStep: 'show_intent_buttons', responseMessage: 'How else may I assist you today?', extractedData: sessionData, lastStep: 'show_intent_buttons' };
};