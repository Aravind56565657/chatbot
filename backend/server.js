require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const errorHandler = require('./middleware/errorHandler');

// Allow requests from the frontend (Vercel) and local dev
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.FRONTEND_URL,
].filter(Boolean);

const chatRoutes = require('./routes/chat');
const appointmentRoutes = require('./routes/appointments');
const serviceRoutes = require('./routes/services');
const doctorRoutes = require('./routes/doctors');

const app = express();
const PORT = process.env.PORT || 5000;

// Global state for when MongoDB is unavailable
global.isMongoConnected = false;
global.mockAppointments = [];
global.mockServices = [
  { _id: "s1", name: "Dental Checkup", category: "Dental", duration: 45, price: 500, description: "Professional dental checkup.", isActive: true },
  { _id: "s2", name: "Teeth Cleaning", category: "Dental", duration: 30, price: 800, description: "Complete scaling.", isActive: true },
  { _id: "s3", name: "General Consultation", category: "Medical", duration: 30, price: 300, description: "Primary care.", isActive: true },
  { _id: "s4", name: "Specialist Consultation", category: "Medical", duration: 45, price: 800, description: "Subject specialist.", isActive: true },
];

global.mockDoctors = [
  { _id: "661f8a84c8a2c8a2c8a2c8a1", name: "Dr. Kavya Reddy", specialization: "Cardiologist", serviceCategory: "Cardiology", isActive: true },
  { _id: "661f8a84c8a2c8a2c8a2c8a2", name: "Dr. Anirudh Sharma", specialization: "Dentist", serviceCategory: "Dental", isActive: true },
  { _id: "661f8a84c8a2c8a2c8a2c8a3", name: "Dr. Meera Krishnan", specialization: "Ophthalmologist", serviceCategory: "Eye Care", isActive: true },
  { _id: "661f8a84c8a2c8a2c8a2c8a4", name: "Dr. Sameer Verma", specialization: "Neurologist", serviceCategory: "Neurology", isActive: true },
  { _id: "661f8a84c8a2c8a2c8a2c8a5", name: "Dr. Rajesh Gupta", specialization: "Orthopedic Surgeon", serviceCategory: "Orthopedics", isActive: true }
];

// Middleware
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (e.g. mobile apps, curl, Render health checks)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
app.use(express.json());

// Routes
app.use('/api/chat', chatRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/doctors', doctorRoutes);

// Health Check
app.get('/health', (req, res) => res.json({ 
    status: 'ok', 
    database: global.isMongoConnected ? 'connected' : 'running-in-memory-mode' 
}));

// Error Handler
app.use(errorHandler);

// Database Connection
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/appointment_booking';

console.log('--- SYSTEM STARTUP ---');
console.log('Attempting to connect to MongoDB...');

mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 })
  .then(() => {
    console.log('✅ Connected to MongoDB');
    global.isMongoConnected = true;
  })
  .catch(err => {
    console.warn('⚠️ MongoDB connection failed. Entering In-Memory Evaluation Mode.');
    console.log('Your appointments will be saved in memory for this session only.');
    global.isMongoConnected = false;
  })
  .finally(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📡 API Base URL: http://localhost:${PORT}/api`);
    });
  });
