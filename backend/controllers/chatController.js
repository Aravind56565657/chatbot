const aiService = require('../services/geminiService');
const sessionStore = require('../services/sessionStore');
const Service = require('../models/Service');
const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const { format } = require('date-fns');

/**
 * PRODUCTION CHAT CONTROLLER - V9 (Clean Architecture)
 *
 * KEY DESIGN:
 *  - The state machine returns nextStep (e.g. 'fetch_by_phone', 'fetch_by_id').
 *  - The FRONTEND handles its own data fetching (findByPhone, findById) when it
 *    sees those step names. DO NOT override nextStep here.
 *  - The controller only intercepts TERMINAL actions (confirm, cancel, reschedule)
 *    to persist data to MongoDB, then returns the correct action token.
 *
 * Action tokens the frontend listens for:
 *   'confirm_booking'      → show BookingConfirmCard (summary to approve)
 *   'booking_confirmed'    → show BookingSuccess card (done)
 *   'confirm_cancellation' → show CancellationConfirmCard (ask to confirm)
 *   'cancellation_secured' → show CancellationSuccess card
 *   'confirm_reschedule'   → show RescheduleConfirmCard (ask to confirm)
 *   'reschedule_secured'   → show RescheduleSuccess card
 */
exports.handleChat = async (req, res, next) => {
    const { sessionId, message } = req.body;
    try {
        const session = sessionStore.getSession(sessionId);
        let services = [], doctors = [];
        if (global.isMongoConnected) {
            services = await Service.find({ isActive: true });
            doctors  = await Doctor.find({ isActive: true });
        }
        if (!services.length) services = global.mockServices || [];
        if (!doctors.length)  doctors  = global.mockDoctors  || [];

        // Run the deterministic state machine
        const ai = await aiService.processUserMessage(
            message,
            session.conversationHistory,
            { ...session.extractedData, lastStep: session.lastStep, intent: session.intent },
            services, doctors
        );

        // ── TERMINAL ACTIONS ONLY ──────────────────────────────────────────────
        let isFinished = false;

        // A: BOOKING — save to DB when user confirmed
        if (ai.action === 'confirm_booking') {
            const d = ai.extractedData;
            const bId = `APT-${Math.floor(1000 + Math.random() * 9000)}`;
            let saved = null;

            if (global.isMongoConnected) {
                const dateStr = d.date || format(new Date(), 'yyyy-MM-dd');
                saved = new Appointment({
                    bookingId: bId,  sessionId,
                    service:         d.serviceCategory || 'Clinical Visit',
                    serviceCategory: d.serviceCategory || 'General',
                    date:            new Date(dateStr),
                    timeSlot:        d.timeSlot  || '09:00 AM',
                    userName:        d.userName  || 'Guest',
                    userPhone:       d.userPhone || '0000000000',
                    userAge:         d.userAge,
                    userGender:      d.userGender,
                    doctorName:      d.doctorName,
                    doctorId:        d.doctorId,
                    userEmail:       d.userEmail,
                    status:         'confirmed'
                });
                await saved.save();
            }

            // Override to tell frontend to show the success card
            ai.nextStep       = 'booking_confirmed';
            ai.action         = 'booking_confirmed';
            ai.bookingData    = saved || { ...d, bookingId: bId };
            ai.extractedData.bookingId = bId;
            ai.responseMessage = `Your visit is confirmed! Reference: **${bId}**`;
            isFinished = true;
        }

        // B: CANCELLATION — mark cancelled in DB
        if (ai.action === 'cancellation_secured') {
            const bId = ai.extractedData?.bookingId;
            if (bId && global.isMongoConnected) {
                await Appointment.findOneAndUpdate({ bookingId: bId }, { status: 'cancelled' });
            }
            isFinished = true;
        }

        // C: RESCHEDULE — update date + time in DB
        if (ai.action === 'reschedule_secured') {
            const { bookingId: bId, newDate, newTimeSlot } = ai.extractedData || {};
            if (bId && newDate && newTimeSlot && global.isMongoConnected) {
                const updated = await Appointment.findOneAndUpdate(
                    { bookingId: bId },
                    { date: new Date(newDate), timeSlot: newTimeSlot },
                    { new: true }
                );
                ai.extractedData.newData = updated;
            }
            isFinished = true;
        }

        // ── SESSION UPDATE ─────────────────────────────────────────────────────
        session.conversationHistory.push(
            { role: 'user',      text: message },
            { role: 'assistant', text: ai.responseMessage, isBot: true }
        );

        if (isFinished) {
            // Full reset so next intent starts clean
            sessionStore.updateSession(sessionId, { extractedData: {}, lastStep: null, intent: null });
        } else {
            sessionStore.updateSession(sessionId, {
                extractedData: ai.extractedData,
                intent:        ai.intent,
                lastStep:      ai.nextStep
            });
        }

        res.json(ai);
    } catch (err) {
        console.error('CHAT CONTROLLER ERROR:', err);
        res.status(500).json({ responseMessage: 'I encountered a snag. Please try one more time.' });
    }
};
