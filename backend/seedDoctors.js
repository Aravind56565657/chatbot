require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const Doctor = require('./models/Doctor');

const doctors = [
  { name: "Dr. Kavya Reddy", specialization: "Cardiologist", serviceCategory: "Cardiology", qualification: "MD, DM (Cardiology)", experience: 12, rating: 4.8 },
  { name: "Dr. Anirudh Sharma", specialization: "Dentist", serviceCategory: "Dental", qualification: "BDS, MDS", experience: 8, rating: 4.7 },
  { name: "Dr. Meera Krishnan", specialization: "Ophthalmologist", serviceCategory: "Eye Care", qualification: "MS (Ophthalmology)", experience: 15, rating: 4.9 },
  { name: "Dr. Sameer Verma", specialization: "Neurologist", serviceCategory: "Neurology", qualification: "MD, DM (Neurology)", experience: 10, rating: 4.6 },
  { name: "Dr. Rajesh Gupta", specialization: "Orthopedic Surgeon", serviceCategory: "Orthopedics", qualification: "MS (Ortho)", experience: 20, rating: 5.0 }
];

const seedDoctors = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/appointment_booking';
    console.log(`Connecting to MongoDB to seed doctors at ${mongoUri}...`);
    await mongoose.connect(mongoUri);
    
    await Doctor.deleteMany({});
    await Doctor.insertMany(doctors);
    
    console.log("Doctors seeded successfully!");
    process.exit(0);
  } catch (err) {
    console.error("Error seeding doctors:", err);
    process.exit(1);
  }
};

seedDoctors();
