const express = require('express');
const router = express.Router();
const appointmentController = require('../controllers/appointmentController');

// Search routes
router.post('/find-by-phone', appointmentController.findByPhone);
router.get('/find-by-id/:bookingId', appointmentController.findByBookingId);

// Action routes
router.put('/:id/cancel', appointmentController.cancelAppointment);
router.put('/:id/reschedule', appointmentController.rescheduleAppointment);

module.exports = router;
