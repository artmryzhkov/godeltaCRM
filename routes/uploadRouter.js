const express = require('express');
const authController = require('../controllers/authController');
const uploadController = require('../controllers/uploadController');

const router = express.Router();

router.use(authController.protect);
router.get('/get-driver-calculation', uploadController.getDriverCalculations);
router.post(
  '/upload-excel',
  authController.restrict('Admin'),
  uploadController.uploadExcel,
  uploadController.readExcelFile
);

module.exports = router;
