const aiService = require('../services/geminiService');
const sessionStore = require('../services/sessionStore');
const Service = require('../models/Service');
const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const { format } = require('date-fns');

/**
 * PRODUCTION CHAT CONTROLLER - V8 Final
 * Action token mapping:
 *   confirm_booking      → save & return booking_confirmed (with bookingData + bookingId)
 *   cancellation_secured → cancel by ID & return success
 *   reschedule_secured   → update date/time & return success
 */
exports.handleChat = async (req, res, next) => {
    const { sessionId, message } = req.body;
    try {
        const session = sessionStore.getSession(sessionId);
        let services = [], doctors = [];
        if (global.isMongoConnected) {
            services = await Service.find({ isActive: true });
            doctors = await Doctor.find({ isActive: true });
        }
        if (!services.length) services = global.mockServices || [];
        if (!doctors.length) doctors = global.mockDoctors || [];

        const ai = await aiService.processUserMessage(
            message,
            session.conversationHistory,
            { ...session.extractedData, lastStep: session.lastStep, intent: session.intent },
            services, doctors
        );

        // ── DATA FETCHING ──────────────────────────────────────────────────────
        if (['show_booking_list', 'fetch_by_phone'].includes(ai.nextStep)) {
            const ph = ai.extractedData?.userPhone;
            if (ph) {
                let list = [];
                if (global.isMongoConnected) {
                    list = await Appointment.find({ userPhone: ph, status: 'confirmed' }).sort({ date: 1 });
                } else {
                    list = (global.mockAppointments || []).filter(x => x.userPhone === ph && x.status === 'confirmed');
                }

                if (!list.length) {
                    const retry = ai.intent === 'my_bookings' ? 'ask_phone'
                        : ai.intent === 'reschedule_appointment' ? 'ask_phone_reschedule'
                        : 'ask_phone_cancel';
                    ai.nextStep = retry;
                    ai.responseMessage = "No active appointments found for that number. Please double-check and try again.";
                } else if (list.length === 1 && ai.nextStep !== 'show_booking_list') {
                    ai.nextStep = 'show_found_card';
                    ai.appointment = list[0];
                    ai.extractedData.bookingId = list[0].bookingId;
                    ai.extractedData.doctorName = list[0].doctorName;
                } else {
                    ai.nextStep = 'show_booking_list';
                    ai.appointments = list;
                }
            }
        }

        if (ai.nextStep === 'fetch_by_id') {
            const id = (ai.extractedData?.bookingId || '').toUpperCase();
            if (id) {
                let a = null;
                if (global.isMongoConnected) {
                    a = await Appointment.findOne({ bookingId: id, status: 'confirmed' });
                } else {
                    a = (global.mockAppointments || []).find(x => x.bookingId === id && x.status === 'confirmed');
                }
                if (!a) {
                    ai.nextStep = 'ask_booking_id';
                    ai.responseMessage = "That Booking ID was not found. Please check it and try again.";
                } else {
                    ai.nextStep = 'show_found_card';
                    ai.appointment = a;
                    ai.extractedData.doctorName = a.doctorName;
                }
            }
        }

        // ── TERMINAL ACTIONS ───────────────────────────────────────────────────
        let isFinished = false;

        // A: Booking confirmed
        if (ai.action === 'confirm_booking' && ['booking_confirmed', 'show_confirm_card'].includes(ai.nextStep)) {
            const d = ai.extractedData;
            const bId = `APT-${Math.floor(1000 + Math.random() * 9000)}`;
            let saved = null;
            if (global.isMongoConnected) {
                const dateStr = d.date || format(new Date(), 'yyyy-MM-dd');
                saved = new Appointment({
                    bookingId: bId, sessionId,
                    service: d.serviceCategory || 'Clinical Visit',
                    serviceCategory: d.serviceCategory || 'General',
                    date: new Date(dateStr),
                    timeSlot: d.timeSlot || '09:00 AM',
                    userName: d.userName || 'Guest',
                    userPhone: d.userPhone || '0000000000',
                    userAge: d.userAge,
                    userGender: d.userGender,
                    doctorName: d.doctorName,
                    doctorId: d.doctorId,
                    userEmail: d.userEmail,
                    status: 'confirmed'
                });
                await saved.save();
            }
            ai.nextStep = 'booking_confirmed';
            ai.action = 'booking_confirmed';
            ai.bookingData = saved || { ...d, bookingId: bId };
            ai.extractedData.bookingId = bId; // Always include the ref ID
            ai.responseMessage = `Your visit has been confirmed! Reference: ${bId}`;
            isFinished = true;
        }

        // B: Cancellation confirmed
        if (ai.action === 'cancellation_secured') {
            const bId = ai.extractedData?.bookingId;
            if (bId && global.isMongoConnected) {
                await Appointment.findOneAndUpdate({ bookingId: bId }, { status: 'cancelled' });
            }
            ai.nextStep = 'cancellation_done';
            isFinished = true;
        }

        // C: Reschedule confirmed
        if (ai.action === 'reschedule_secured') {
            const bId = ai.extractedData?.bookingId;
            const nDate = ai.extractedData?.newDate;
            const nTime = ai.extractedData?.newTimeSlot;
            if (bId && nDate && nTime && global.isMongoConnected) {
                const updated = await Appointment.findOneAndUpdate(
                    { bookingId: bId },
                    { date: new Date(nDate), timeSlot: nTime },
                    { new: true }
                );
                ai.extractedData.newData = updated;
            }
            ai.nextStep = 'reschedule_done';
            isFinished = true;
        }

        // ── SESSION PERSISTENCE ────────────────────────────────────────────────
        session.conversationHistory.push(
            { role: 'user', text: message },
            { role: 'assistant', text: ai.responseMessage, isBot: true }
        );

        if (isFinished) {
            sessionStore.updateSession(sessionId, { extractedData: {}, lastStep: null, intent: null });
        } else {
            sessionStore.updateSession(sessionId, {
                extractedData: ai.extractedData,
                intent: ai.intent,
                lastStep: ai.nextStep
            });
        }

        res.json(ai);
    } catch (err) {
        console.error('FATAL CHAT ERROR:', err);
        res.status(500).json({ responseMessage: 'I encountered a snag. Please try again.' });
    }
};
