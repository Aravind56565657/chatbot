const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  bookingId: { type: String, required: true, unique: true },
  service: { type: String, required: true },
  serviceCategory: { type: String, required: true },
  date: { type: Date, required: true },
  timeSlot: { type: String, required: true },
  userName: { type: String, required: true },
  userPhone: { type: String, required: true },
  userAge: Number,
  userGender: { type: String, enum: ["Male", "Female", "Other"] },
  doctorName: String,
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor' },
  userEmail: String,
  notes: String,
  status: {
    type: String,
    enum: ["pending", "confirmed", "cancelled", "completed", "rescheduled"],
    default: "pending"
  },
  cancelledAt: Date,
  sessionId: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true // This is the modern way to handle updatedAt automatically
});

// COMPLETELY REMOVED ALL PRE-SAVE HOOKS TO AVOID "next is not a function" ERRORS

module.exports = mongoose.model('Appointment', appointmentSchema);
