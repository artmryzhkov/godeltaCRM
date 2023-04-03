const mongoose = require('mongoose');

const driverCalculationSchema = new mongoose.Schema(
  {
    total: {
      type: String,
      required: [true, 'Please enter total'],
    },
    cash: {
      type: String,
      required: [true, 'Please enter cash'],
    },
    vat: {
      type: String,
      required: [true, 'Please enter vat'],
    },
    transfer: {
      type: String,
      required: [true, 'Please enter transfer'],
    },
  },
  {
    timestamps: true,
  }
);

const DriverCalculation = mongoose.model(
  'DriverCalculation',
  driverCalculationSchema
);
module.exports = DriverCalculation;
