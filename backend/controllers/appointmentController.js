const Appointment = require('../models/Appointment');
const Service = require('../models/Service');

const SLOT_TIMES = ["9:00 AM", "10:00 AM", "11:00 AM", "12:00 PM", "2:00 PM", "3:00 PM", "4:00 PM", "5:00 PM", "6:00 PM"];

function normalizeTimeSlot(value) {
    return String(value || '')
        .trim()
        .replace(/\s+/g, '')
        .toUpperCase();
}

function buildDayRange(dateStr) {
    const start = new Date(dateStr);
    if (Number.isNaN(start.getTime())) return null;
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);
    return { start, end };
}

/**
 * Find appointments by phone number
 */
exports.findByPhone = async (req, res) => {
    try {
        const { phone } = req.body;
        if (!phone) return res.status(400).json({ message: "Phone number is required" });

        const appointments = await Appointment.find({ userPhone: phone })
            .sort({ date: -1 });
            
        res.json(appointments);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

/**
 * Find appointment by booking ID - EXPLICIT EXPORT FOR ROUTER
 */
exports.findByBookingId = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const appointment = await Appointment.findOne({ bookingId });
        
        if (!appointment) return res.status(404).json({ message: "Appointment not found" });
        res.json(appointment);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

/**
 * List appointments for admin portal.
 * Supports optional status filter and simple text search.
 */
exports.getAll = async (req, res) => {
    try {
        const { status = '', search = '', limit = 100 } = req.query;

        if (!global.isMongoConnected) {
            let items = Array.isArray(global.mockAppointments) ? [...global.mockAppointments] : [];

            if (status) {
                items = items.filter(a => String(a.status || '').toLowerCase() === String(status).toLowerCase());
            }

            if (search) {
                const q = String(search).toLowerCase();
                items = items.filter(a =>
                    String(a.userName || '').toLowerCase().includes(q) ||
                    String(a.bookingId || '').toLowerCase().includes(q) ||
                    String(a.userPhone || '').toLowerCase().includes(q) ||
                    String(a.doctorName || '').toLowerCase().includes(q) ||
                    String(a.serviceCategory || '').toLowerCase().includes(q)
                );
            }

            items.sort((a, b) => new Date(b.date) - new Date(a.date));
            const capped = items.slice(0, Number(limit) || 100);
            return res.json({ appointments: capped, totalCount: items.length });
        }

        const query = {};
        if (status) query.status = status;
        if (search) {
            query.$or = [
                { userName: { $regex: search, $options: 'i' } },
                { bookingId: { $regex: search, $options: 'i' } },
                { userPhone: { $regex: search, $options: 'i' } },
                { doctorName: { $regex: search, $options: 'i' } },
                { serviceCategory: { $regex: search, $options: 'i' } },
            ];
        }

        const [appointments, totalCount] = await Promise.all([
            Appointment.find(query).sort({ date: -1, createdAt: -1 }).limit(Number(limit) || 100),
            Appointment.countDocuments(query)
        ]);

        res.json({ appointments, totalCount });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

/**
 * Slots availability for a doctor on a given date.
 * Returns the fixed SlotGrid times with green/red availability.
 */
exports.getAvailability = async (req, res) => {
    try {
        const { doctorId, date } = req.query;
        if (!doctorId) return res.status(400).json({ message: "doctorId is required" });
        if (!date) return res.status(400).json({ message: "date is required (YYYY-MM-DD)" });

        const dayRange = buildDayRange(date);
        if (!dayRange) return res.status(400).json({ message: "Invalid date format" });

        // Count only appointments that occupy a slot. Cancelled/rescheduled slots are treated as free.
        const appointments = await Appointment.find({
            doctorId,
            date: { $gte: dayRange.start, $lte: dayRange.end },
            status: { $in: ['pending', 'confirmed', 'completed'] }
        }).select({ timeSlot: 1 });

        const booked = new Set(appointments.map(a => normalizeTimeSlot(a.timeSlot)));
        const slots = SLOT_TIMES.map(t => ({
            time: t,
            available: !booked.has(normalizeTimeSlot(t))
        }));

        res.json({ doctorId, date, slots });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

/**
 * Cancel an appointment
 */
exports.cancelAppointment = async (req, res) => {
    try {
        const { id } = req.params;
        const appointment = await Appointment.findByIdAndUpdate(
            id,
            { status: 'cancelled', cancelledAt: new Date(), updatedAt: new Date() },
            { new: true }
        );
        
        if (!appointment) return res.status(404).json({ message: "Appointment not found" });
        res.json({ message: "Appointment cancelled successfully", appointment });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

/**
 * Reschedule an appointment
 */
exports.rescheduleAppointment = async (req, res) => {
    try {
        const { id } = req.params;
        const { newDate, newTimeSlot } = req.body;

        const oldAppointment = await Appointment.findById(id);
        if (!oldAppointment) return res.status(404).json({ message: "Original appointment not found" });

        const dayRange = buildDayRange(newDate);
        if (!dayRange) return res.status(400).json({ message: "Invalid newDate" });

        const normalizedNewTimeSlot = normalizeTimeSlot(newTimeSlot);

        const doctorMatch = oldAppointment.doctorId
            ? { doctorId: oldAppointment.doctorId }
            : { doctorName: oldAppointment.doctorName };

        // Slot conflict is checked against appointments that actually occupy a slot.
        // Cancelled/rescheduled slots are treated as freed.
        const conflict = await Appointment.findOne({
            ...doctorMatch,
            date: { $gte: dayRange.start, $lte: dayRange.end },
            timeSlot: normalizedNewTimeSlot,
            status: { $in: ['pending', 'confirmed', 'completed'] }
        });

        if (conflict) {
            return res.status(409).json({ message: "That time slot is already booked." });
        }

        oldAppointment.status = 'rescheduled';
        await oldAppointment.save();

        const newBookingId = `APT-${Math.floor(1000 + Math.random() * 9000)}`;
        const newAppointment = new Appointment({
            ...oldAppointment.toObject(),
            _id: undefined,
            bookingId: newBookingId,
            date: new Date(newDate),
            timeSlot: normalizedNewTimeSlot,
            status: 'confirmed',
            createdAt: new Date(),
            updatedAt: new Date()
        });

        await newAppointment.save();
        res.json({ message: "Rescheduled", oldBookingId: oldAppointment.bookingId, newAppointment });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

/**
 * Create appointment from admin portal.
 */
exports.createAppointment = async (req, res) => {
    try {
        const payload = {
            ...req.body,
            bookingId: req.body.bookingId || `APT-${Math.floor(1000 + Math.random() * 9000)}`,
            sessionId: req.body.sessionId || 'admin-portal',
            date: req.body.date ? new Date(req.body.date) : new Date(),
        };

        const appointment = await Appointment.create(payload);
        res.status(201).json(appointment);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

/**
 * Update appointment from admin portal.
 */
exports.updateAppointment = async (req, res) => {
    try {
        const { id } = req.params;
        const payload = {
            ...req.body,
            updatedAt: new Date()
        };
        if (payload.date) payload.date = new Date(payload.date);

        const appointment = await Appointment.findByIdAndUpdate(id, payload, { new: true, runValidators: true });
        if (!appointment) return res.status(404).json({ message: "Appointment not found" });
        res.json(appointment);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

/**
 * Delete appointment from admin portal.
 */
exports.deleteAppointment = async (req, res) => {
    try {
        const { id } = req.params;
        const appointment = await Appointment.findByIdAndDelete(id);
        if (!appointment) return res.status(404).json({ message: "Appointment not found" });
        res.json({ message: "Appointment deleted successfully" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
