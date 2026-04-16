const express = require('express');
const router = express.Router();
const Service = require('../models/Service');

router.get('/', async (req, res, next) => {
  try {
    if (!global.isMongoConnected) {
        return res.json(global.mockServices);
    }
    const services = await Service.find({ isActive: true });
    res.json(services);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
