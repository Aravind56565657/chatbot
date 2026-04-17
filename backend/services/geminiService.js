const { format, addDays } = require('date-fns');

/**
 * ELITE CONCIERGE ENGINE - V8. Final. Zero-Bug.
 *
 * Root-cause fixes:
 * 1. ask_lookup_method step now HANDLES the user's choice ("phone" or "booking id")
 * 2. my_bookings & general_inquiry flows re-added (were missing)
 * 3. action tokens match frontend exactly:
 *    booking → 'confirm_booking', success → 'booking_confirmed'
 *    cancel  → 'confirm_cancellation', success → 'cancellation_secured'
 *    reschedule → 'confirm_reschedule', success → 'reschedule_secured'
 * 4. Booking ID returned with every confirmed booking via frontend bookingData
 */

function runStateMachine(userMessage, sessionData) {
    const msg = userMessage.trim().toLowerCase();
    const raw = userMessage.trim();
    const data = { ...sessionData };
    const lastStep = sessionData.lastStep || '';
    const intent = sessionData.intent || '';

    // ─────────────────────────────────────────────────────────────────────────
    // 1. GLOBAL OVERRIDES
    // ─────────────────────────────────────────────────────────────────────────
    if (['main menu','restart','restart flow','back to menu','modify details & restart flow'].includes(msg)) {
        return { intent: null, nextStep: 'show_intent_buttons', action: null,
            responseMessage: "Welcome back to our main menu. How may I assist you today?" };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. INTENT SWITCHING (only if NOT mid-confirmation)
    // ─────────────────────────────────────────────────────────────────────────
    const isMidFlow = ['show_confirm_card','confirm_cancel_final','confirm_reschedule_final','show_slots_reschedule','ask_new_date'].includes(lastStep);
    const newIntent = detectIntent(msg);
    if (newIntent && newIntent !== intent && !isMidFlow) {
        const fresh = {}; // always start fresh on intent switch
        fresh.intent = newIntent;
        if (newIntent === 'book_appointment') return reply(fresh, 'show_service_buttons', 'For which medical specialty would you like an appointment?');
        if (newIntent === 'cancel_appointment') return reply(fresh, 'ask_lookup_method', 'How would you like to find your appointment?');
        if (newIntent === 'reschedule_appointment') return reply(fresh, 'ask_lookup_method', 'How would you like to locate your current appointment?');
        if (newIntent === 'my_bookings') return reply(fresh, 'ask_phone', 'I would be happy to list your upcoming appointments. Please provide your registered phone number:');
        if (newIntent === 'check_availability') return reply(fresh, 'show_service_buttons', 'Check availability for which specialty?');
        if (newIntent === 'general_inquiry') return reply(fresh, 'show_topics', 'Of course. What information would you like today?');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. FLOW: BOOK APPOINTMENT
    // ─────────────────────────────────────────────────────────────────────────
    if (intent === 'book_appointment') {
        // Confirmation step — save & done
        if (lastStep === 'show_confirm_card' && (msg.includes('confirm') || msg === 'confirm booking')) {
            return reply(data, 'booking_confirmed', 'Splendid. Your visit has been confirmed!', 'confirm_booking');
        }

        // Merge any fields sent in this single message
        const ext = extractFields(raw);
        Object.keys(ext).forEach(k => { if (ext[k] != null) data[k] = ext[k]; });

        if (!data.serviceCategory) return reply(data, 'show_service_buttons', 'For which medical specialty would you like an appointment?');

        if (!data.doctorName) {
            const dn = raw.replace(/select specialist|select|dr\./gi, '').trim();
            const isSpecClic = data.serviceCategory && dn.toLowerCase().includes(data.serviceCategory.toLowerCase());
            if (dn.length > 3 && !extractTime(dn) && !isSpecClic) {
                data.doctorName = dn;
                return reply(data, 'ask_date', `Dr. ${dn} would be delighted to see you. On which date?`);
            }
            return reply(data, 'show_doctor_cards', `Please select your preferred ${data.serviceCategory} specialist:`);
        }

        if (!data.date) {
            const d = detectDate(msg);
            if (d) { data.date = d; return reply(data, 'show_slots', `Here are the available times for Dr. ${data.doctorName} on ${d}:`); }
            return reply(data, 'ask_date', `For which date would you like to visit Dr. ${data.doctorName}?`);
        }

        if (!data.timeSlot) {
            const tm = extractTime(msg);
            if (tm) { data.timeSlot = tm; return reply(data, 'ask_name', `${tm} is reserved. May I have the patient's full name?`); }
            return reply(data, 'show_slots', `Please choose a time slot for ${data.date}:`);
        }

        if (!data.userName) {
            const n = raw.replace(/my name is|i am|this is|name is|for/gi, '').trim();
            if (n.length > 2 && !msg.includes('select')) { data.userName = n; return reply(data, 'ask_age', `Thank you, ${n}. What is the patient's age?`); }
            return reply(data, 'ask_name', "Could you please provide the patient's full name?");
        }

        if (!data.userAge) {
            const a = msg.match(/\d+/)?.[0];
            if (a) { data.userAge = Number(a); return reply(data, 'ask_gender', "And the patient's gender?"); }
            return reply(data, 'ask_age', `Please provide the age for ${data.userName}:`);
        }

        if (!data.userGender) {
            if (msg.includes('female')) { data.userGender = 'Female'; return reply(data, 'ask_phone', "May I have a contact phone number?"); }
            if (msg.includes('male')) { data.userGender = 'Male'; return reply(data, 'ask_phone', "May I have a contact phone number?"); }
            return reply(data, 'ask_gender', "Gender? (Male / Female)");
        }

        if (!data.userPhone) {
            const p = msg.replace(/\D/g, '');
            if (p.length >= 10) { data.userPhone = p; return reply(data, 'ask_email', "And an email address for your confirmation?"); }
            return reply(data, 'ask_phone', "Please provide a full 10-digit phone number:");
        }

        if (!data.userEmail) {
            if (msg.includes('@')) { data.userEmail = raw; return reply(data, 'show_confirm_card', "Excellent. Please review your appointment summary:", 'confirm_booking'); }
            return reply(data, 'ask_email', "Please provide a valid email address:");
        }

        return reply(data, 'show_confirm_card', "Please review your appointment summary below:", 'confirm_booking');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. FLOW: CANCEL APPOINTMENT
    // ─────────────────────────────────────────────────────────────────────────
    if (intent === 'cancel_appointment') {
        // ** KEY FIX: handle lookup method choice **
        if (lastStep === 'ask_lookup_method') {
            if (msg.includes('phone')) return reply(data, 'ask_phone_cancel', 'Please enter your registered phone number:');
            if (msg.includes('booking') || msg.includes('id') || msg.includes('have')) return reply(data, 'ask_booking_id', 'Please enter your Booking ID (e.g. APT-1234):');
        }

        if (lastStep === 'ask_phone_cancel') {
            const p = msg.replace(/\D/g, '');
            if (p.length >= 10) { data.userPhone = p; return reply(data, 'fetch_by_phone', 'Searching for appointments linked to this number...'); }
            return reply(data, 'ask_phone_cancel', 'Please provide a valid 10-digit phone number:');
        }

        if (lastStep === 'ask_booking_id') {
            data.bookingId = raw.toUpperCase();
            return reply(data, 'fetch_by_id', 'Locating your appointment record...');
        }

        if (lastStep === 'confirm_cancel_final') {
            if (msg.includes('yes') || msg.includes('confirm') || msg.includes('cancel')) {
                return reply(data, 'cancellation_done', 'Your appointment has been successfully cancelled.', 'cancellation_secured');
            }
        }

        if (['fetch_by_id','fetch_by_phone','show_found_card','show_booking_list'].includes(lastStep)) {
            if (msg.includes('cancel')) return reply(data, 'confirm_cancel_final', 'Are you sure you wish to cancel this appointment?', 'confirm_cancellation');
        }

        return reply(data, 'ask_lookup_method', 'How would you like to find your appointment?');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 5. FLOW: RESCHEDULE APPOINTMENT
    // ─────────────────────────────────────────────────────────────────────────
    if (intent === 'reschedule_appointment') {
        // ** KEY FIX: handle lookup method choice **
        if (lastStep === 'ask_lookup_method') {
            if (msg.includes('phone')) return reply(data, 'ask_phone_reschedule', 'Please enter your registered phone number:');
            if (msg.includes('booking') || msg.includes('id') || msg.includes('have')) return reply(data, 'ask_booking_id', 'Please enter your Booking ID (e.g. APT-1234):');
        }

        if (lastStep === 'ask_phone_reschedule') {
            const p = msg.replace(/\D/g, '');
            if (p.length >= 10) { data.userPhone = p; return reply(data, 'fetch_by_phone', 'Locating your appointments. One moment please...'); }
            return reply(data, 'ask_phone_reschedule', 'Please provide a valid 10-digit phone number:');
        }

        if (lastStep === 'ask_booking_id') {
            data.bookingId = raw.toUpperCase();
            return reply(data, 'fetch_by_id', 'Locating your appointment...');
        }

        if (lastStep === 'ask_new_date') {
            const d = detectDate(msg);
            if (d) { data.newDate = d; data.date = d; return reply(data, 'show_slots_reschedule', `Here are the available slots on ${d}:`); }
            return reply(data, 'ask_new_date', 'Which new date would you like?');
        }

        if (lastStep === 'show_slots_reschedule') {
            const t = extractTime(msg);
            if (t) { data.newTimeSlot = t; return reply(data, 'confirm_reschedule_final', 'Please confirm you wish to reschedule to this new time:', 'confirm_reschedule'); }
        }

        if (lastStep === 'confirm_reschedule_final') {
            if (msg.includes('yes') || msg.includes('confirm')) {
                return reply(data, 'reschedule_done', 'Your appointment has been successfully rescheduled.', 'reschedule_secured');
            }
        }

        if (['fetch_by_id','fetch_by_phone','show_found_card','show_booking_list'].includes(lastStep)) {
            if (msg.includes('reschedule')) return reply(data, 'ask_new_date', 'On which new date would you like to reschedule?');
        }

        return reply(data, 'ask_lookup_method', 'How would you like to locate your current appointment?');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 6. FLOW: MY BOOKINGS
    // ─────────────────────────────────────────────────────────────────────────
    if (intent === 'my_bookings') {
        if (lastStep === 'ask_phone') {
            const p = msg.replace(/\D/g, '');
            if (p.length >= 10) { data.userPhone = p; return reply(data, 'show_booking_list', 'Here are your upcoming appointments:'); }
            return reply(data, 'ask_phone', 'Please provide your registered phone number:');
        }
        return reply(data, 'ask_phone', 'I would be happy to list your upcoming appointments. Please provide your registered phone number:');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 7. FLOW: CHECK AVAILABILITY
    // ─────────────────────────────────────────────────────────────────────────
    if (intent === 'check_availability') {
        if (!data.serviceCategory) {
            data.serviceCategory = extractCategory(msg);
            if (data.serviceCategory) return reply(data, 'show_doctor_cards', `Which ${data.serviceCategory} specialist's schedule would you like to view?`);
            return reply(data, 'show_service_buttons', 'Check availability for which specialty?');
        }
        if (!data.doctorName) {
            const dn = raw.replace(/select specialist|select|dr\./gi, '').trim();
            if (dn.length > 2) { data.doctorName = dn; return reply(data, 'ask_date', `Checking schedule for Dr. ${dn}. For which date?`); }
            return reply(data, 'show_doctor_cards', 'Please select a specialist:');
        }
        if (!data.date) {
            const d = detectDate(msg);
            if (d) { data.date = d; return reply(data, 'show_slots_readonly', `Here is the schedule for Dr. ${data.doctorName} on ${d}:`); }
            return reply(data, 'ask_date', `Which date shall I check for Dr. ${data.doctorName}?`);
        }
        return reply(data, 'show_service_buttons', 'Check availability for which specialty?');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 8. FLOW: GENERAL INQUIRY
    // ─────────────────────────────────────────────────────────────────────────
    if (intent === 'general_inquiry') {
        if (msg.includes('price') || msg.includes('cost') || msg.includes('fee')) return reply({ ...data, inquiryCardType: 'prices' }, 'show_info_card', 'Our current consultation fees and service pricing:');
        if (msg.includes('hour') || msg.includes('open') || msg.includes('working')) return reply({ ...data, inquiryCardType: 'hours' }, 'show_info_card', 'Elite Wellness clinic hours:');
        if (msg.includes('location') || msg.includes('address') || msg.includes('contact')) return reply({ ...data, inquiryCardType: 'contact' }, 'show_info_card', 'Our location and contact details:');
        if (msg.includes('doctor') || msg.includes('specialist')) return reply({ ...data, inquiryCardType: 'doctors' }, 'show_info_card', 'Our team of specialist doctors:');
        if (msg.includes('duration') || msg.includes('long')) return reply({ ...data, inquiryCardType: 'duration' }, 'show_info_card', 'Typical consultation durations:');
        return reply(data, 'show_topics', 'What information can I provide for you today?');
    }

    return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function detectIntent(msg) {
    if (msg.includes('my booking') || msg.startsWith('my book')) return 'my_bookings';
    if (msg.includes('cancel')) return 'cancel_appointment';
    if (msg.includes('reschedule')) return 'reschedule_appointment';
    if (msg.includes('availability') || msg.includes('check availability')) return 'check_availability';
    if (msg.includes('book') || msg.includes('appointment')) return 'book_appointment';
    if (msg.includes('inquiry') || msg.includes('price') || msg.includes('fee') || msg.includes('hour') || msg.includes('location') || msg.includes('doctor') || msg.includes('service')) return 'general_inquiry';
    return null;
}

function extractFields(msg) {
    const d = {}; const l = msg.toLowerCase();
    d.serviceCategory = extractCategory(l);
    d.date = detectDate(l);
    d.timeSlot = extractTime(l);
    const n = msg.match(/(?:patient\s+named?|named?\s+|patient\s+is\s+|name\s+is\s+)([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)/);
    if (n) d.userName = n[1].trim();
    const a = l.match(/(?:age|aged?)\s*(\d{1,3})/); if (a) d.userAge = Number(a[1]);
    if (l.includes('female')) d.userGender = 'Female'; else if (/\bmale\b/.test(l)) d.userGender = 'Male';
    const ph = l.match(/\b(\d[\d\s\-]{8,14}\d)\b/); if (ph) d.userPhone = ph[1].replace(/\D/g, '').slice(-10);
    const em = msg.match(/[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}/); if (em) d.userEmail = em[0];
    return d;
}

function extractCategory(msg) {
    const c = { cardio: 'Cardiology', dent: 'Dental', 'eye': 'Eye Care', neuro: 'Neurology', ortho: 'Orthopedics' };
    for (const [k, v] of Object.entries(c)) if (msg.includes(k)) return v;
    return null;
}

function extractTime(msg) {
    const m = msg.match(/(\d+):(\d{2})\s*(am|pm)/i) || msg.match(/(\d+)\s*(am|pm)/i);
    if (!m) return null;
    return m[0].replace(/\s+/g, '').toUpperCase();
}

function detectDate(msg) {
    const n = new Date(); const l = msg.toLowerCase();
    if (l.includes('day after tomorrow')) return format(addDays(n, 2), 'yyyy-MM-dd');
    if (l.includes('tomorrow')) return format(addDays(n, 1), 'yyyy-MM-dd');
    if (l.includes('today')) return format(n, 'yyyy-MM-dd');
    const iso = l.match(/\b(\d{4})-(\d{2})-(\d{2})\b/); if (iso) return iso[0];
    const dm = l.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/);
    if (dm) return `${dm[3]}-${dm[2].padStart(2,'0')}-${dm[1].padStart(2,'0')}`;
    const wk = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
    const d = wk.find(w => l.includes(w));
    if (d) { let f = (wk.indexOf(d) - n.getDay() + 7) % 7; if (f === 0) f = 7; return format(addDays(n, f), 'yyyy-MM-dd'); }
    return null;
}

function extractBookingId(t) { const m = t.match(/\b(apt-\d{3,6})\b/i); return m ? m[1].toUpperCase() : null; }

function reply(data, nextStep, message, action = null) {
    return { intent: data.intent, nextStep, action, extractedData: data, responseMessage: message, lastStep: nextStep };
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT
// ─────────────────────────────────────────────────────────────────────────────
exports.processUserMessage = async (userMessage, conversationHistory, sessionData, services = [], doctors = []) => {
    const machine = runStateMachine(userMessage, sessionData);
    if (machine) { machine.lastStep = machine.nextStep; return machine; }
    return {
        intent: sessionData.intent, nextStep: 'show_intent_buttons', action: null,
        responseMessage: 'How else may I assist you today?', extractedData: sessionData, lastStep: 'show_intent_buttons'
    };
};