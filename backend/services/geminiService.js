const { format, addDays } = require('date-fns');

/**
 * ELITE CONCIERGE - State Machine V10
 * All flows: Book, Cancel, Reschedule, My Bookings, Availability, Inquiry
 * All lookup transitions: ask_lookup_method → ask_phone_X / ask_booking_id
 */

function runStateMachine(userMessage, sessionData) {
    const msg = userMessage.trim().toLowerCase();
    const raw = userMessage.trim();
    const intent  = (sessionData.intent  || '').toLowerCase();
    const lastStep = sessionData.lastStep || '';
    const data = { ...sessionData };

    // ─────────────────────────────────────────────────────────────────────────
    // 1. GLOBAL RESET
    // ─────────────────────────────────────────────────────────────────────────
    const RESET_CMDS = ['main menu','restart','restart flow','back to menu','modify details & restart flow'];
    if (RESET_CMDS.includes(msg)) {
        return ok(null, 'show_intent_buttons', null, "Welcome back to our main menu. How may I assist you today?");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. INTENT SWITCHING (only when not mid-confirmation)
    // ─────────────────────────────────────────────────────────────────────────
    const LOCKED_STEPS = ['show_confirm_card','confirm_cancel_final','confirm_reschedule_final','show_slots_reschedule','ask_new_date'];
    const newIntent = detectIntent(msg);

    if (newIntent && newIntent !== intent && !LOCKED_STEPS.includes(lastStep)) {
        const fresh = { intent: newIntent };
        if (newIntent === 'book_appointment')       return ok(fresh, 'show_service_buttons',  null, 'For which medical specialty would you like an appointment?');
        if (newIntent === 'cancel_appointment')     return ok(fresh, 'ask_lookup_method',     null, 'How would you like to find your appointment?');
        if (newIntent === 'reschedule_appointment') return ok(fresh, 'ask_lookup_method',     null, 'How would you like to locate your current appointment?');
        if (newIntent === 'my_bookings')            return ok(fresh, 'ask_phone',             null, 'Please provide your registered phone number to view your bookings:');
        if (newIntent === 'check_availability')     return ok(fresh, 'show_service_buttons',  null, 'Check availability for which specialty?');
        if (newIntent === 'general_inquiry')        return ok(fresh, 'show_topics',           null, 'Of course! What information would you like today?');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. BOOK APPOINTMENT
    // ─────────────────────────────────────────────────────────────────────────
    if (intent === 'book_appointment') {
        if (lastStep === 'show_confirm_card' && (msg.includes('confirm') || msg === 'confirm booking')) {
            return ok(data, 'booking_confirmed', 'confirm_booking', 'Splendid! Your visit has been officially confirmed.');
        }
        // Merge any inline fields
        const ext = extractFields(raw); Object.keys(ext).forEach(k => { if (ext[k] != null) data[k] = ext[k]; });

        if (!data.serviceCategory) return ok(data, 'show_service_buttons', null, 'For which medical specialty would you like an appointment?');

        if (!data.doctorName) {
            const dn = raw.replace(/select specialist|select|dr\./gi, '').trim();
            const isSpecClick = data.serviceCategory && dn.toLowerCase().includes(data.serviceCategory.toLowerCase());
            if (dn.length > 3 && !extractTime(dn) && !isSpecClick) { data.doctorName = dn; return ok(data, 'ask_date', null, `Dr. ${dn} would be delighted to see you. On which date?`); }
            return ok(data, 'show_doctor_cards', null, `Please select your preferred ${data.serviceCategory} specialist:`);
        }
        if (!data.date) { const d = detectDate(msg); if (d) { data.date = d; return ok(data, 'show_slots', null, `Here are the available times for Dr. ${data.doctorName} on ${d}:`); } return ok(data, 'ask_date', null, `For which date would you like to visit Dr. ${data.doctorName}?`); }
        if (!data.timeSlot) { const tm = extractTime(msg); if (tm) { data.timeSlot = tm; return ok(data, 'ask_name', null, `${tm} is reserved. May I have the patient's full name?`); } return ok(data, 'show_slots', null, `Please choose a time slot for ${data.date}:`); }
        if (!data.userName) { const n = raw.replace(/my name is|i am|this is|name is|for/gi, '').trim(); if (n.length > 2 && !msg.includes('select')) { data.userName = n; return ok(data, 'ask_age', null, `Thank you ${n}. What is the patient's age?`); } return ok(data, 'ask_name', null, "Could you please provide the patient's full name?"); }
        if (!data.userAge) { const a = msg.match(/\d+/)?.[0]; if (a) { data.userAge = Number(a); return ok(data, 'ask_gender', null, "And the patient's gender?"); } return ok(data, 'ask_age', null, `Please provide the age for ${data.userName}:`); }
        if (!data.userGender) { if (msg.includes('female')) { data.userGender = 'Female'; return ok(data, 'ask_phone', null, "May I have a contact phone number?"); } if (msg.includes('male')) { data.userGender = 'Male'; return ok(data, 'ask_phone', null, "May I have a contact phone number?"); } return ok(data, 'ask_gender', null, "Gender? (Male / Female)"); }
        if (!data.userPhone) { const p = msg.replace(/\D/g, ''); if (p.length >= 10) { data.userPhone = p; return ok(data, 'ask_email', null, "And an email address for your confirmation?"); } return ok(data, 'ask_phone', null, "Please provide a full 10-digit phone number:"); }
        if (!data.userEmail) { if (msg.includes('@')) { data.userEmail = raw; return ok(data, 'show_confirm_card', 'confirm_booking', "Excellent. Please review your appointment summary:"); } return ok(data, 'ask_email', null, "Please provide a valid email address:"); }
        return ok(data, 'show_confirm_card', 'confirm_booking', "Please review your appointment summary below:");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. CANCEL APPOINTMENT
    // ─────────────────────────────────────────────────────────────────────────
    if (intent === 'cancel_appointment') {
        if (lastStep === 'ask_lookup_method') {
            if (msg.includes('phone'))                                   return ok(data, 'ask_phone_cancel',  null, 'Please enter your registered phone number:');
            if (msg.includes('booking') || msg.includes('id') || msg.includes('have')) return ok(data, 'ask_booking_id', null, 'Please enter your Booking ID (e.g. APT-1234):');
        }
        if (lastStep === 'ask_phone_cancel')    { const p = msg.replace(/\D/g,''); if (p.length>=10) { data.userPhone=p; return ok(data,'fetch_by_phone',null,'Searching for appointments linked to this number...'); } return ok(data,'ask_phone_cancel',null,'Please provide a valid 10-digit number:'); }
        if (lastStep === 'ask_booking_id')      { data.bookingId = raw.toUpperCase(); return ok(data,'fetch_by_id',null,'Locating your appointment record...'); }
        if (lastStep === 'confirm_cancel_final' && (msg.includes('yes')||msg.includes('confirm'))) return ok(data,'cancellation_done','cancellation_secured','Your appointment has been successfully cancelled.');
        if (['fetch_by_id','fetch_by_phone','show_found_card','show_booking_list'].includes(lastStep) && msg.includes('cancel')) return ok(data,'confirm_cancel_final','confirm_cancellation','Are you sure you wish to cancel this appointment?');
        return ok(data, 'ask_lookup_method', null, 'How would you like to find your appointment?');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 5. RESCHEDULE APPOINTMENT
    // ─────────────────────────────────────────────────────────────────────────
    if (intent === 'reschedule_appointment') {
        if (lastStep === 'ask_lookup_method') {
            if (msg.includes('phone'))                                   return ok(data, 'ask_phone_reschedule', null, 'Please enter your registered phone number:');
            if (msg.includes('booking') || msg.includes('id') || msg.includes('have')) return ok(data, 'ask_booking_id',      null, 'Please enter your Booking ID (e.g. APT-1234):');
        }
        if (lastStep === 'ask_phone_reschedule') { const p = msg.replace(/\D/g,''); if (p.length>=10) { data.userPhone=p; return ok(data,'fetch_by_phone',null,'Locating your appointments. One moment please...'); } return ok(data,'ask_phone_reschedule',null,'Please provide a valid 10-digit phone number:'); }
        if (lastStep === 'ask_booking_id')       { data.bookingId = raw.toUpperCase(); return ok(data,'fetch_by_id',null,'Locating your appointment...'); }
        if (lastStep === 'ask_new_date')         { const d = detectDate(msg); if (d) { data.newDate=d; data.date=d; return ok(data,'show_slots_reschedule',null,`Here are the available slots on ${d}:`); } return ok(data,'ask_new_date',null,'Which new date would you like?'); }
        if (lastStep === 'show_slots_reschedule'){ const t = extractTime(msg); if (t) { data.newTimeSlot=t; return ok(data,'confirm_reschedule_final','confirm_reschedule','Please confirm to reschedule to this new time:'); } }
        if (lastStep === 'confirm_reschedule_final' && (msg.includes('yes')||msg.includes('confirm'))) return ok(data,'reschedule_done','reschedule_secured','Your appointment has been successfully rescheduled!');
        if (['fetch_by_id','fetch_by_phone','show_found_card','show_booking_list'].includes(lastStep) && msg.includes('reschedule')) return ok(data,'ask_new_date',null,'On which new date would you like to reschedule?');
        return ok(data, 'ask_lookup_method', null, 'How would you like to locate your current appointment?');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 6. MY BOOKINGS
    // ─────────────────────────────────────────────────────────────────────────
    if (intent === 'my_bookings') {
        if (lastStep === 'ask_phone') { const p = msg.replace(/\D/g,''); if (p.length>=10) { data.userPhone=p; return ok(data,'show_booking_list',null,'Here are your upcoming appointments:'); } return ok(data,'ask_phone',null,'Please provide your registered phone number:'); }
        return ok(data, 'ask_phone', null, 'Please provide your registered phone number to view your bookings:');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 7. CHECK AVAILABILITY
    // ─────────────────────────────────────────────────────────────────────────
    if (intent === 'check_availability') {
        if (!data.serviceCategory) { data.serviceCategory = extractCategory(msg); if (data.serviceCategory) return ok(data,'show_doctor_cards',null,`Which ${data.serviceCategory} specialist's schedule would you like to check?`); return ok(data,'show_service_buttons',null,'Check availability for which specialty?'); }
        if (!data.doctorName) { const dn = raw.replace(/select specialist|select|dr\./gi,'').trim(); if (dn.length>2) { data.doctorName=dn; return ok(data,'ask_date',null,`Checking schedule for Dr. ${dn}. For which date?`); } return ok(data,'show_doctor_cards',null,'Please select a specialist:'); }
        if (!data.date) { const d = detectDate(msg); if (d) { data.date=d; return ok(data,'show_slots_readonly',null,`Here is the schedule for Dr. ${data.doctorName} on ${d}:`); } return ok(data,'ask_date',null,`Which date shall I check for Dr. ${data.doctorName}?`); }
        return ok(data, 'show_service_buttons', null, 'Check availability for which specialty?');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 8. GENERAL INQUIRY
    // ─────────────────────────────────────────────────────────────────────────
    if (intent === 'general_inquiry') {
        if (msg.includes('price')||msg.includes('fee')||msg.includes('cost'))  return ok({...data,inquiryCardType:'prices'}, 'show_info_card', null, 'Current consultation fees and pricing:');
        if (msg.includes('hour')||msg.includes('open')||msg.includes('working')) return ok({...data,inquiryCardType:'hours'}, 'show_info_card', null, 'Elite Wellness clinic hours:');
        if (msg.includes('location')||msg.includes('address')||msg.includes('contact')) return ok({...data,inquiryCardType:'contact'}, 'show_info_card', null, 'Our location and contact details:');
        if (msg.includes('doctor')||msg.includes('specialist'))                return ok({...data,inquiryCardType:'doctors'}, 'show_info_card', null, 'Our specialist doctors:');
        if (msg.includes('duration')||msg.includes('long'))                    return ok({...data,inquiryCardType:'duration'}, 'show_info_card', null, 'Typical consultation durations:');
        return ok(data, 'show_topics', null, 'What information can I provide for you today?');
    }

    return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function ok(data, nextStep, action, message) {
    return { intent: (data && data.intent) || null, nextStep, action, extractedData: data || {}, responseMessage: message, lastStep: nextStep };
}

function detectIntent(msg) {
    if (msg.includes('my booking') || msg.startsWith('my book')) return 'my_bookings';
    if (msg.includes('cancel'))      return 'cancel_appointment';
    if (msg.includes('reschedule'))  return 'reschedule_appointment';
    if (msg.includes('availability') || msg.includes('check avail')) return 'check_availability';
    if (msg.includes('book') || msg.includes('appointment')) return 'book_appointment';
    if (msg.includes('inquiry')||msg.includes('price')||msg.includes('fee')||msg.includes('hour')||msg.includes('location')||msg.includes('doctor')||msg.includes('service')) return 'general_inquiry';
    return null;
}

function extractFields(raw) {
    const d = {}; const l = raw.toLowerCase();
    d.serviceCategory = extractCategory(l);
    d.date = detectDate(l);
    d.timeSlot = extractTime(l);
    const nm = raw.match(/(?:patient\s+named?|named?\s+|patient\s+is\s+|name\s+is\s+)([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)/); if (nm) d.userName = nm[1].trim();
    const ag = l.match(/(?:age|aged?)\s*(\d{1,3})/); if (ag) d.userAge = Number(ag[1]);
    if (l.includes('female')) d.userGender = 'Female'; else if (/\bmale\b/.test(l)) d.userGender = 'Male';
    const ph = l.match(/\b(\d[\d\s\-]{8,14}\d)\b/); if (ph) d.userPhone = ph[1].replace(/\D/g,'').slice(-10);
    const em = raw.match(/[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}/); if (em) d.userEmail = em[0];
    return d;
}

function extractCategory(msg) {
    const map = { cardio:'Cardiology', dent:'Dental', 'eye care':'Eye Care', eye:'Eye Care', neuro:'Neurology', ortho:'Orthopedics' };
    for (const [k,v] of Object.entries(map)) if (msg.includes(k)) return v;
    return null;
}

function extractTime(msg) {
    const m = msg.match(/(\d+):(\d{2})\s*(am|pm)/i) || msg.match(/(\d+)\s*(am|pm)/i);
    if (!m) return null;
    return m[0].replace(/\s+/g,'').toUpperCase();
}

function detectDate(msg) {
    const n = new Date(); const l = msg.toLowerCase();
    if (l.includes('day after tomorrow')) return format(addDays(n,2),'yyyy-MM-dd');
    if (l.includes('tomorrow'))           return format(addDays(n,1),'yyyy-MM-dd');
    if (l.includes('today'))              return format(n,'yyyy-MM-dd');
    const iso = l.match(/\b(\d{4})-(\d{2})-(\d{2})\b/); if (iso) return iso[0];
    const dm  = l.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/); if (dm) return `${dm[3]}-${dm[2].padStart(2,'0')}-${dm[1].padStart(2,'0')}`;
    const wk  = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
    const day = wk.find(w => l.includes(w));
    if (day) { let f=(wk.indexOf(day)-n.getDay()+7)%7; if(f===0) f=7; return format(addDays(n,f),'yyyy-MM-dd'); }
    return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT
// ─────────────────────────────────────────────────────────────────────────────
exports.processUserMessage = async (userMessage, conversationHistory, sessionData, services=[], doctors=[]) => {
    const result = runStateMachine(userMessage, sessionData);
    if (result) { result.lastStep = result.nextStep; return result; }
    return { intent: sessionData.intent, nextStep:'show_intent_buttons', action:null,
             responseMessage:'How else may I assist you today?', extractedData:sessionData, lastStep:'show_intent_buttons' };
};