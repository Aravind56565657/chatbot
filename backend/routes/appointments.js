const express = require('express');
const router = express.Router();
const appointmentController = require('../controllers/appointmentController');

// Admin/data routes
router.get('/', appointmentController.getAll);

// Search routes
router.post('/find-by-phone', appointmentController.findByPhone);
router.get('/find-by-id/:bookingId', appointmentController.findByBookingId);
router.get('/availability', appointmentController.getAvailability);

// Action routes
router.post('/', appointmentController.createAppointment);
router.put('/:id', appointmentController.updateAppointment);
router.delete('/:id', appointmentController.deleteAppointment);
router.put('/:id/cancel', appointmentController.cancelAppointment);
router.put('/:id/reschedule', appointmentController.rescheduleAppointment);

module.exports = router;
