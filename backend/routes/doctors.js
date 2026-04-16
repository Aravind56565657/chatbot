const express = require('express');
const router = express.Router();
const Doctor = require('../models/Doctor');

// GET /api/doctors - returns active doctors with optional category filter
router.get('/', async (req, res) => {
    try {
        const { category } = req.query;
        let query = { isActive: true };
        if (category) {
            query.serviceCategory = category;
        }

        let doctors = await Doctor.find(query);

        // SELF-SEEDING: If no doctors exist, seed them now
        if (doctors.length === 0 && !category) {
            const seedDoctors = [
                { name: "Dr. Arjun Mehta", specialization: "MBBS, MD Cardiology", serviceCategory: "Cardiology", qualification: "MD", experience: 12, rating: 4.8 },
                { name: "Dr. Priya Sharma", specialization: "MBBS, DM Cardiology", serviceCategory: "Cardiology", qualification: "DM", experience: 8, rating: 4.6 },
                { name: "Dr. Kavya Reddy", specialization: "BDS, MDS", serviceCategory: "Dental", qualification: "MDS", experience: 10, rating: 4.7 },
                { name: "Dr. Suresh Babu", specialization: "BDS, MDS", serviceCategory: "Dental", qualification: "MDS", experience: 6, rating: 4.5 },
                { name: "Dr. Ramesh Iyer", specialization: "MBBS, MS Ophthalmology", serviceCategory: "Eye Care", qualification: "MS", experience: 15, rating: 4.9 },
                { name: "Dr. Ananya Singh", specialization: "MBBS, DNB Ophthalmology", serviceCategory: "Eye Care", qualification: "DNB", experience: 7, rating: 4.6 },
                { name: "Dr. Vikram Nair", specialization: "MBBS, DM Neurology", serviceCategory: "Neurology", qualification: "DM", experience: 14, rating: 4.8 },
                { name: "Dr. Meena Pillai", specialization: "MBBS, MD Neurology", serviceCategory: "Neurology", qualification: "MD", experience: 9, rating: 4.7 },
                { name: "Dr. Sanjay Rao", specialization: "MBBS, MS Orthopedics", serviceCategory: "Orthopedics", qualification: "MS", experience: 11, rating: 4.6 },
                { name: "Dr. Lakshmi Devi", specialization: "MBBS, DNB Orthopedics", serviceCategory: "Orthopedics", qualification: "DNB", experience: 8, rating: 4.5 },
                { name: "Sr. Stylist Pooja", specialization: "Certified Hair Specialist", serviceCategory: "Salon", qualification: "Certified", experience: 7, rating: 4.8 },
                { name: "Sr. Stylist Rajan", specialization: "Certified Color Expert", serviceCategory: "Salon", qualification: "Certified", experience: 5, rating: 4.6 }
            ];
            await Doctor.insertMany(seedDoctors);
            doctors = await Doctor.find(query);
        }

        res.json(doctors);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
