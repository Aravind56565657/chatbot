const { GoogleGenerativeAI } = require("@google/generative-ai");
const { format, addDays } = require('date-fns');

/**
 * DETERMINISTIC STATE MACHINE - Elite Concierge Edition.
 * Maintains a premium, elite tone while enforcing strict clinical data collection.
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
        return reply(data, 'fetch_by_id', `Certainly. I am locating appointment ${bId} in our records...`);
    }

    if (msg === 'main menu' || msg === 'restart') {
        return { intent: null, nextStep: 'show_intent_buttons', responseMessage: "Welcome back to the main menu. I've reset your current session. How may I assist you now?" };
    }

    // Keyword Triggers (Restricted to prevent collision with "Personal" keywords)
    const isBooking = (msg.includes('book') || msg.includes('appointment')) && !msg.includes('cancel') && !msg.includes('reschedule') && !msg.includes('confirm') && !msg.includes('my') && !msg.includes('your');
    if (isBooking) return startBooking(data);
    if (msg.includes('cancel') && (msg.includes('appointment') || msg.includes('booking')) && !msg.includes('cancel this')) return startCancel(data);
    if (msg.includes('reschedule') && !msg.includes('reschedule this')) return startReschedule(data);
    if ((msg === 'my bookings' || msg === 'my appointment') || (msg.includes('my') && msg.includes('appointment') && !msg.includes('reschedule') && !msg.includes('cancel'))) return startMyBookings(data);
    if (msg.includes('general inquiry') || msg.includes('prices') || msg.includes('location') || msg.includes('hours')) return startInquiry(data);

    // ── CANCEL FLOW ────────────────────────────────────────────────────────────
    if (intent === 'cancel_appointment') {
        if (last === 'ask_lookup_method') {
            if (msg.includes('phone')) { data.lookupMethod = 'phone'; return reply(data, 'ask_phone_cancel', 'Of course. Please provide your registered phone number so I may find your visit:'); }
            if (msg.includes('id')) { data.lookupMethod = 'bookingId'; return reply(data, 'ask_booking_id', 'Understood. Please enter your unique Booking ID (e.g., APT-1234):'); }
        }
        if (last === 'ask_phone_cancel') { 
            const phone = msg.replace(/\D/g, ''); 
            if (phone.length >= 10) { data.userPhone = phone; return reply(data, 'fetch_by_phone', 'Thank you. I am now searching our database for appointments linked to that number...'); } 
            return reply(data, 'ask_phone_cancel', 'I apologize, but that does not appear to be a valid 10-digit number. Could you please provide it again?'); 
        }
        if (last === 'ask_booking_id') { data.bookingId = userMessage.toUpperCase(); return reply(data, 'fetch_by_id', 'Searching our records for that ID. Please wait a moment...'); }
        
        if (last === 'fetch_by_id' || last === 'fetch_by_phone' || last === 'show_found_card' || last === 'show_booking_list') {
             if (msg.includes('cancel')) return reply(data, 'confirm_cancel_final', 'I have identified the appointment. Are you absolutely certain you wish to proceed with the cancellation?', 'confirm_cancellation');
        }
        if (last === 'confirm_cancel_final') {
             if (msg.includes('yes') || msg.includes('confirm') || msg.includes('cancel')) return reply(data, 'cancelled', 'Your appointment has been successfully cancelled. We hope to see you again soon.', 'cancellation_confirmed');
             return reply(data, 'show_intent_buttons', 'Cancellation has been successfully aborted. How else can I help?');
        }
        return reply(data, 'ask_lookup_method', 'How would you prefer to locate the appointment you wish to cancel?');
    }

    // ── RESCHEDULE FLOW ─────────────────────────────────────────────────────────
    if (intent === 'reschedule_appointment') {
        if (last === 'ask_lookup_method') {
            if (msg.includes('phone')) { data.lookupMethod = 'phone'; return reply(data, 'ask_phone_reschedule', 'Please provide your registered phone number to begin the rescheduling process:'); }
            if (msg.includes('id')) { data.lookupMethod = 'bookingId'; return reply(data, 'ask_booking_id_reschedule', 'Please provide your Booking ID so I may locate your appointment:'); }
        }
        if (last === 'ask_phone_reschedule') { 
            const phone = msg.replace(/\D/g, ''); 
            if (phone.length >= 10) { data.userPhone = phone; return reply(data, 'fetch_by_phone', 'Searching for your current appointments. One moment please...'); } 
            return reply(data, 'ask_phone_reschedule', 'That phone number seems incomplete. Please provide a full 10-digit number:'); 
        }
        if (last === 'ask_booking_id_reschedule') { data.bookingId = userMessage.toUpperCase(); return reply(data, 'fetch_by_id', 'Searching for that specific ID. Please wait...'); }
        
        if (last === 'fetch_by_id' || last === 'fetch_by_phone' || last === 'show_found_card' || last === 'show_booking_list') {
             if (msg.includes('reschedule')) return reply(data, 'ask_new_date', 'I have found your appointment. What new date would you like to consider?');
        }
        if (last === 'ask_new_date') { 
            const d = detectDate(msg); 
            if (d) { data.newDate = d; data.date = d; return reply(data, 'show_slots_reschedule', `I have found several available times for ${data.doctorName || 'your specialist'} on ${d}:`); } 
            return reply(data, 'ask_new_date', 'On which date would you like to reschedule your visit? (e.g., Tomorrow, or April 25)'); 
        }
        if (last === 'show_slots_reschedule') { const t = extractTime(msg); if (t) { data.newTimeSlot = t; return reply(data, 'show_reschedule_confirm', '', 'confirm_reschedule'); } }
        return reply(data, 'ask_lookup_method', 'How shall we find the appointment you wish to reschedule today?');
    }

    // ── GENERAL INQUIRY FLOW ───────────────────────────────────────────────────
    if (intent === 'general_inquiry') {
        if (msg.includes('prices')) return reply({ ...data, inquiryCardType: 'prices' }, 'show_info_card', 'I have prepared our latest service pricing and surgical consult fees for you:');
        if (msg.includes('hours') || msg.includes('open')) return reply(data, 'show_info_card', 'Elite Wellness is pleased to serve you during the following hours:');
        if (msg.includes('location') || msg.includes('where')) return reply(data, 'show_info_card', 'We are located in the heart of the city. Here are our exact coordinates:');
        return reply(data, 'show_topics', 'Our concierge desk is open to any questions. What details would you like to know?');
    }

    // ── BOOK APPOINTMENT FLOW ──────────────────────────────────────────────────
    if (intent === 'book_appointment') {
        if (last === 'confirm_booking' && (msg.includes('confirm') || msg.includes('yes'))) return reply(data, 'booking_success', 'Perfect. Your appointment is now officially confirmed!', 'confirm_booking');
        
        // Step 1: Specialty
        if (!data.serviceCategory) { 
            data.serviceCategory = extractCategory(msg); 
            if (data.serviceCategory) return reply(data, 'show_doctor_cards', `Excellent choice. Please select your preferred ${data.serviceCategory} specialist from our elite team:`); 
            return reply(data, 'show_service_buttons', 'Certainly. For which medical specialty would you like to request an appointment today?'); 
        }

        // Step 2: Doctor
        const t = extractTime(msg);
        const isDocMsg = (msg.includes('select') || msg.includes('dr.')) && !t;
        if (data.serviceCategory && (!data.doctorName || isDocMsg)) {
            const dn = userMessage.replace(/select specialist|select|specialist|dr\./gi, '').trim();
            if (dn.length > 3 && !extractTime(dn)) { 
                data.doctorName = dn; 
                return reply(data, 'ask_date', `Dr. ${dn} would be delighted to see you. For which date would you like to request a visit?`); 
            }
            if (!data.doctorName) return reply(data, 'show_doctor_cards', `Please select your specialist for ${data.serviceCategory} to proceed:`);
        }

        // Step 3: Date
        if (data.doctorName && !data.date) { 
            const d = detectDate(msg); 
            if (d) { data.date = d; return reply(data, 'show_slots', `Splendid. I have found several available time slots for Dr. ${data.doctorName} on ${d}:`); } 
            return reply(data, 'ask_date', `On which date would you like to meet with Dr. ${data.doctorName}? (e.g., Tomorrow, or April 25)`); 
        }

        // Step 4: Time Slot
        if (data.date && !data.timeSlot) { 
            const tm = extractTime(msg); 
            if (tm) { data.timeSlot = tm; return reply(data, 'ask_name', `The ${tm} slot has been reserved for you. May I have the patient's full name for the registration?`); } 
            return reply(data, 'show_slots', `Please pick a preferred time for your visit on ${data.date}:`); 
        }

        // Step 5: Name
        if (data.timeSlot && !data.userName) { 
            const n = userMessage.replace(/my name is|i am|this is|patient is|name is/gi, '').trim(); 
            if (n.length > 2 && !msg.includes('select')) { data.userName = n; return reply(data, 'ask_age', `Thank you, ${n}. And what is the patient's current age?`); } 
            return reply(data, 'ask_name', "Thank you. For our records, could you please provide the patient's full legal name?"); 
        }

        // Step 6: Age
        if (data.userName && !data.userAge) { 
            const a = msg.match(/\d+/)?.[0]; 
            if (a) { data.userAge = a; return reply(data, 'ask_gender', `Got it. And what is the patient's gender for our clinical records?`); } 
            return reply(data, 'ask_age', `Understood. Could you please provide the age for ${data.userName}?`); 
        }

        // Step 7: Gender
        if (data.userAge && !data.userGender) { 
            if (msg.includes('male') || msg.includes('female')) { data.userGender = msg.includes('female') ? 'Female' : 'Male'; return reply(data, 'ask_phone', "We're almost finished. May I have a contact phone number for the appointment?"); } 
            return reply(data, 'ask_gender', "And which gender should we note in the clinical chart? (Male or Female)"); 
        }

        // Step 8: Phone
        if (data.userGender && !data.userPhone) { 
            const p = msg.replace(/\D/g, ''); 
            if (p.length >= 10) { data.userPhone = p; return reply(data, 'ask_email', "Splendid. Lastly, could you provide an email address where we may send your confirmation details?"); } 
            return reply(data, 'ask_phone', "I will need a full 10-digit phone number to secure your booking:"); 
        }

        // Step 9: Email
        if (data.userPhone && !data.userEmail) { 
            if (msg.includes('@')) { data.userEmail = userMessage.trim(); return reply(data, 'confirm_booking', "I have gathered all the necessary details. Please review your booking summary below one final time:", 'confirm_booking'); } 
            return reply(data, 'ask_email', "Please provide a valid email address so we may reach out to you:"); 
        }

        return reply(data, 'confirm_booking', "Please review your appointment summary below to ensure everything is correct:", 'confirm_booking');
    }
    return null;
}

function reply(data, nextStep, message, action = null) { return { intent: data.intent, nextStep, action, extractedData: data, responseMessage: message, lastStep: nextStep }; }
function resetFlowData(data) { Object.keys(data).forEach(k => { if (typeof data[k] === 'boolean') data[k]=false; else data[k]=null; }); return data; }
function startBooking(data) { resetFlowData(data); data.intent='book_appointment'; return reply(data,'show_service_buttons','Welcome to Elite Wellness. I would be delighted to assist you with a new booking. Which specialty do you require?'); }
function startCancel(data) { resetFlowData(data); data.intent='cancel_appointment'; return reply(data,'ask_lookup_method','I understand you wish to cancel an appointment. How would you like to find your record in our system?'); }
function startReschedule(data) { resetFlowData(data); data.intent='reschedule_appointment'; return reply(data,'ask_lookup_method','Of course. I can help you reschedule your visit. How should we locate your current appointment?'); }
function startInquiry(data) { resetFlowData(data); data.intent='general_inquiry'; return reply(data,'show_topics','The Elite Concierge is at your service. What information can I provide for you today?'); }
function startMyBookings(data) { resetFlowData(data); data.intent='my_bookings'; return reply(data,'ask_phone','I would be happy to list your upcoming appointments. Please provide your registered phone number:'); }

function extractCategory(msg) { const cats={cardiology:'Cardiology',dental:'Dental',eye:'Eye Care',neuro:'Neurology',ortho:'Orthopedics'}; for(const[k,v]of Object.entries(cats)) if(msg.includes(k))return v; return null; }
function extractTime(msg){const m=msg.match(/(\d+):00\s*(am|pm)/i)||msg.match(/(\d+)\s*(am|pm)/i);return m?m[0].toUpperCase().replace(/\s+/,''):null;}
function detectDate(msg){const n=new Date();const l=msg.toLowerCase();if(l.includes('tomorrow'))return format(addDays(n,1),'yyyy-MM-dd');const iso=l.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);if(iso)return iso[0];const wk=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];const d=wk.find(w=>l.includes(w));if(d){let f=(wk.indexOf(d)-n.getDay()+7)%7;if(f===0)f=7;return format(addDays(n,f),'yyyy-MM-dd');}return null;}
function extractBookingId(t){const m=t.match(/\b(apt-\d{3,6})\b/i);return m?m[1].toUpperCase():null;}

async function callAI(userMessage, conversationHistory, sessionData, services, doctors) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_1; if (!apiKey) return null;
    try {
        const genAI = new (require("@google/generative-ai").GoogleGenerativeAI)(apiKey.trim());
        const result = await genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" }).startChat({ history: [] }).sendMessage(`Clinic Concierge Personality. JSON ONLY {intent,nextStep,action,extractedData,responseMessage}. User:${userMessage} Data:${JSON.stringify(sessionData)}`);
        const text = result.response.text(); const s = text.indexOf('{'), e = text.lastIndexOf('}'); return s !== -1 ? JSON.parse(text.substring(s, e+1)) : null;
    } catch { return null; }
}

exports.processUserMessage = async (userMessage, conversationHistory, sessionData, services = [], doctors = []) => {
    const machine = runStateMachine(userMessage, sessionData);
    if (machine) { machine.lastStep = machine.nextStep; return machine; }
    const ai = await callAI(userMessage, conversationHistory, sessionData, services, doctors);
    if (ai && ai.responseMessage) { ai.lastStep = ai.nextStep; return ai; }
    return { intent: sessionData.intent || 'book_appointment', nextStep: 'show_intent_buttons', responseMessage: 'How may I assist you with your clinic needs today?', extractedData: sessionData, lastStep: 'show_intent_buttons' };
};