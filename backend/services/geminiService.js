const { format, addDays } = require('date-fns');

/**
 * ELITE CONCIERGE ENGINE - Spec-Compliant V5.
 * Strictly adheres to the 'nextStep Progression Rules' and 'Prompt Design Rules'.
 */

function runStateMachine(userMessage, sessionData) {
    const msg = userMessage.toLowerCase().trim();
    const data = { ...sessionData };
    const lastStep = sessionData.lastStep || '';
    
    // ── 1. GLOBAL COMMANDS ──
    if (msg === 'main menu' || msg === 'restart' || msg === 'restart flow') {
        return { intent: null, nextStep: 'show_intent_buttons', responseMessage: "Welcome back to our main menu. How may I assist you now?" };
    }

    // ── 2. INTENT DETECTION ──
    const detected = detectIntent(msg);
    const isConfirming = msg.includes('confirm') || msg.includes('yes') || msg.includes('this');
    
    if (detected && !isConfirming && detected !== sessionData.intent) {
        const d = resetData(data);
        if (detected === 'book_appointment') return startBooking(d);
        if (detected === 'cancel_appointment') return startCancel(d);
        if (detected === 'reschedule_appointment') return startReschedule(d);
        if (detected === 'my_bookings') return startMyBookings(d);
        if (detected === 'check_availability') return startAvailability(d);
        if (detected === 'general_inquiry') return startInquiry(d);
    }

    const intent = sessionData.intent || '';

    // ── 3. FLOW: BOOK APPOINTMENT (Spec-Compliant Progression) ──
    if (intent === 'book_appointment') {
        // Handle explicit confirmation first
        if (lastStep === 'show_confirm_card' && (msg.includes('confirm') || msg.includes('yes'))) {
            return reply(data, 'booking_confirmed', 'Splendid. Your visit is now officially confirmed.', 'confirm_booking');
        }

        // Rule: Single Message Extraction (Merge with session)
        const extracted = extractFieldsFromMessage(userMessage);
        Object.keys(extracted).forEach(k => { if (extracted[k]) data[k] = extracted[k]; });

        // Rule: Always show doctor cards even when category detected from freeform
        if (!data.serviceCategory) return reply(data, 'show_service_buttons', 'For which medical specialty would you like an appointment?');
        
        // Rule: Only one missing field asked at a time
        if (!data.doctorName) {
            const dn = userMessage.replace(/select specialist|select|dr\./gi, '').trim();
            if (dn.length > 3 && !extractTime(dn)) { data.doctorName = dn; return reply(data, 'ask_date', `Dr. ${dn} would be delighted to see you. For which date?`); }
            return reply(data, 'show_doctor_cards', `Please select your preferred ${data.serviceCategory} specialist:`); 
        }

        if (!data.date) {
            const d = detectDate(msg);
            if (d) { data.date = d; return reply(data, 'show_slots', `I've found availability for Dr. ${data.doctorName} on ${d}:`); }
            return reply(data, 'ask_date', `Which date would you like to request for Dr. ${data.doctorName}?`);
        }

        if (!data.timeSlot) {
            const tm = extractTime(msg);
            if (tm) { data.timeSlot = tm; return reply(data, 'ask_name', `${tm} has been reserved. May I have the patient's full name?`); }
            return reply(data, 'show_slots', `Please pick a time slot for your visit on ${data.date}:`);
        }

        if (!data.userName) {
            const n = userMessage.replace(/my name is|i am|this is|name is|for/gi, '').trim();
            if (n.length > 2 && !msg.includes('select')) { data.userName = n; return reply(data, 'ask_age', `Thank you, ${n}. And what is the patient's age?`); }
            return reply(data, 'ask_name', "For our registration records, could you please provide the patient's full name?");
        }

        if (!data.userAge) {
            const a = msg.match(/\d+/)?.[0];
            if (a) { data.userAge = Number(a); return reply(data, 'ask_gender', "Got it. And what is the patient's gender?"); }
            return reply(data, 'ask_age', `Could you please provide the age for ${data.userName}?`);
        }

        if (!data.userGender) {
            if (msg.includes('male') || msg.includes('female')) { data.userGender = msg.includes('female') ? 'Female' : 'Male'; return reply(data, 'ask_phone', "We're nearly done. May I have a contact phone number?"); }
            return reply(data, 'ask_gender', "Which gender should we note in the clinical chart? (Male or Female)");
        }

        if (!data.userPhone) {
            const p = msg.replace(/\D/g, '');
            if (p.length >= 10) { data.userPhone = p; return reply(data, 'ask_email', "Splendid. Lastly, an email address for your confirmation details?"); }
            return reply(data, 'ask_phone', "I will need a full 10-digit phone number to secure your booking:");
        }

        if (!data.userEmail) {
            if (msg.includes('@')) { data.userEmail = userMessage.trim(); return reply(data, 'show_confirm_card', "I have gathered all the details. Please review your summary below:", 'confirm_booking'); }
            return reply(data, 'ask_email', "Please provide a valid email address:");
        }

        return reply(data, 'show_confirm_card', "Please review your appointment summary below to ensure everything is correct:", 'confirm_booking');
    }

    // ── 4. OTHER INTENTS: CANCEL / RESCHEDULE / MY BOOKINGS (Consistent Step Naming) ──
    if (intent === 'cancel_appointment') {
        if (lastStep === 'ask_phone_cancel') { const p = msg.replace(/\D/g, ''); if (p.length >= 10) { data.userPhone = p; return reply(data, 'fetch_by_phone', 'Searching our database for your records...'); } return reply(data, 'ask_phone_cancel', 'Please provide your 10-digit phone number:'); }
        if (lastStep === 'ask_booking_id') { data.bookingId = userMessage.toUpperCase(); return reply(data, 'fetch_by_id', 'Locating your visit details...'); }
        if (lastStep === 'confirm_cancel_final' && (msg.includes('yes') || msg.includes('confirm') || msg.includes('cancel'))) return reply(data, 'booking_confirmed', 'Success. Your appointment is now cancelled.', 'cancellation_confirmed');
        if (lastStep === 'fetch_by_id' || lastStep === 'fetch_by_phone' || lastStep === 'show_found_card' || lastStep === 'show_booking_list') { if (msg.includes('cancel')) return reply(data, 'confirm_cancel_final', 'Are you absolutely certain you wish to cancel this visit?', 'confirm_cancellation'); }
        return reply(data, 'ask_lookup_method', 'How should we locate the appointment you wish to cancel?');
    }

    if (intent === 'reschedule_appointment') {
        if (lastStep === 'ask_phone_reschedule') { const p = msg.replace(/\D/g, ''); if (p.length >= 10) { data.userPhone = p; return reply(data, 'fetch_by_phone', 'Locating your appointments...'); } return reply(data, 'ask_phone_reschedule', 'Please provide your phone number:'); }
        if (lastStep === 'ask_new_date') { const d = detectDate(msg); if (d) { data.newDate = d; data.date = d; return reply(data, 'show_slots_reschedule', `I've found availability for your specialist on ${d}:`); } return reply(data, 'ask_new_date', 'Which new date should we look for?'); }
        if (lastStep === 'show_slots_reschedule') { const t = extractTime(msg); if (t) { data.newTimeSlot = t; return reply(data, 'show_reschedule_confirm', '', 'confirm_reschedule'); } }
        if (lastStep === 'fetch_by_id' || lastStep === 'fetch_by_phone' || lastStep === 'show_found_card' || lastStep === 'show_booking_list') { if (msg.includes('reschedule')) return reply(data, 'ask_new_date', 'On which date would you like to reschedule?'); }
        return reply(data, 'ask_lookup_method', 'How shall we find the appointment you wish to reschedule?');
    }

    if (intent === 'my_bookings') {
        const phone = msg.replace(/\D/g, '');
        if (lastStep === 'ask_phone' && phone.length >= 10) { data.userPhone = phone; return reply(data, 'show_booking_list', 'Searching your history...'); }
        return reply(data, 'ask_phone', 'Please provide your phone number to see your bookings:');
    }

    if (intent === 'general_inquiry') {
        if (msg.includes('price')) return reply({ ...data, inquiryCardType: 'prices' }, 'show_info_card', 'Our latest service and consult fees are listed here:');
        if (msg.includes('hour') || msg.includes('open')) return reply(data, 'show_info_card', 'Elite Wellness is pleased to serve you during these hours:');
        if (msg.includes('location')) return reply(data, 'show_info_card', 'We are located at:');
        return reply(data, 'show_topics', 'What information can I provide for you today?');
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

function extractFieldsFromMessage(msg) {
    const d={}; const l=msg.toLowerCase();
    d.serviceCategory = extractCategory(l);
    d.date = detectDate(l);
    d.timeSlot = extractTime(l);
    const n = msg.match(/(?:patient\s+named?|named?\s+|patient\s+is\s+|name\s+is\s+)([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)/);
    if(n) d.userName = n[1].trim();
    const a = l.match(/(?:age|aged?)\s*(\d{1,3})/); if(a) d.userAge = Number(a[1]);
    if(l.includes('female')) d.userGender = 'Female'; else if(l.includes(' male')) d.userGender = 'Male';
    const p = l.match(/\b(\d[\d\s\-]{8,14}\d)\b/); if(ph) d.userPhone = p[1].replace(/\D/g, '').slice(-10);
    return d;
}

function reply(data, nextStep, message, action = null) { return { intent: data.intent, nextStep, action, extractedData: data, responseMessage: message, lastStep: nextStep }; }
function resetData(data) { const d={}; Object.keys(data).forEach(k => { if (typeof data[k] === 'boolean') d[k]=false; else d[k]=null; }); return d; }
function startBooking(d) { d.intent='book_appointment'; return reply(d,'show_service_buttons','Which medical specialty do you require?'); }
function startCancel(d) { d.intent='cancel_appointment'; return reply(d,'ask_lookup_method','How find appointment to cancel?'); }
function startReschedule(d) { d.intent='reschedule_appointment'; return reply(d,'ask_lookup_method','How find appointment to reschedule?'); }
function startMyBookings(d) { d.intent='my_bookings'; return reply(d,'ask_phone','Enter phone number for history:'); }
function startAvailability(d) { d.intent='check_availability'; return reply(d,'show_service_buttons','Availability for which specialty?'); }
function startInquiry(d) { d.intent='general_inquiry'; return reply(d,'show_topics','Information requested. What would you like to know?'); }

function extractCategory(msg) { const c={cardio:'Cardiology',dent:'Dental',eye:'Eye Care',neuro:'Neurology',ortho:'Orthopedics'}; for(const[k,v]of Object.entries(c)) if(msg.includes(k)) return v; return null; }
function extractTime(msg) { const m=msg.match(/(\d+):00\s*(am|pm)/i)||msg.match(/(\d+)\s*(am|pm)/i); return m?m[0].toUpperCase().replace(/\s+/,''):null; }
function detectDate(msg) { const n=new Date(); const l=msg.toLowerCase(); if(l.includes('tomorrow'))return format(addDays(n,1),'yyyy-MM-dd'); if(l.includes('day after tomorrow'))return format(addDays(n,2),'yyyy-MM-dd'); const iso=l.match(/\b(\d{4})-(\d{2})-(\d{2})\b/); if(iso)return iso[0]; const wk=['sunday','monday','tuesday','wednesday','thursday','friday','saturday']; const d=wk.find(w=>l.includes(w)); if(d){let f=(wk.indexOf(d)-n.getDay()+7)%7;if(f===0)f=7;return format(addDays(n,f),'yyyy-MM-dd');} return null; }
function extractBookingId(t){const m=t.match(/\b(apt-\d{3,6})\b/i);return m?m[1].toUpperCase():null;}

exports.processUserMessage = async (userMessage, conversationHistory, sessionData, services = [], doctors = []) => {
    const machine = runStateMachine(userMessage, sessionData);
    if (machine) { machine.lastStep = machine.nextStep; return machine; }
    return { intent: sessionData.intent, nextStep: 'show_intent_buttons', responseMessage: 'How else may I assist you today?', extractedData: sessionData, lastStep: 'show_intent_buttons' };
};