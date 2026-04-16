require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const Service = require('./models/Service');

const services = [
  { name: "Dental Checkup", category: "Dental", duration: 45, price: 500, description: "Professional dental checkup and consultation." },
  { name: "Teeth Cleaning", category: "Dental", duration: 30, price: 800, description: "Complete scaling and polishing." },
  { name: "General Consultation", category: "Medical", duration: 30, price: 300, description: "Primary care checkup." },
  { name: "Specialist Consultation", category: "Medical", duration: 45, price: 800, description: "Consultation with a subject specialist." },
  { name: "Hair Cut & Styling", category: "Salon", duration: 60, price: 400, description: "Expert hair styling and cut." },
  { name: "Deep Hair Treatment", category: "Salon", duration: 90, price: 1200, description: "Intensive nourishing hair treatment." }
];

const seedDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/appointment_booking';
    console.log(`Connecting to MongoDB at ${mongoUri}...`);
    await mongoose.connect(mongoUri);
    
    // Clear existing services if any
    await Service.deleteMany({});
    
    // Insert seed data
    await Service.insertMany(services);
    
    console.log("Database seeded successfully!");
    process.exit(0);
  } catch (err) {
    console.error("Error seeding database:", err);
    process.exit(1);
  }
};

seedDB();
