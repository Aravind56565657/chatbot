const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
  name: { type: String, required: true },           // "Dental Checkup"
  category: { type: String, required: true },       // "Dental"
  description: String,
  duration: { type: Number, required: true },       // in minutes
  price: { type: Number, required: true },
  isActive: { type: Boolean, default: true }
});

module.exports = mongoose.model('Service', serviceSchema);
