const express = require('express');
const authController = require('../controllers/authController');

const router = express.Router();

router.get('/active-account/:token', authController.validateEmail);
router.post(
  '/signup',
  authController.uploadUserImage,
  authController.resizeImage,
  authController.signup
);
router.post('/login', authController.login);
router.post('/forgot-password', authController.forgetPassword);
router.patch('/reset-password/:resetToken', authController.resetPassword);

router.use(authController.protect);
router.get('/get-all-drivers', authController.getAllDrivers);
router.get('/verify-email/:token', authController.verifyEmail);
router.get('/auth', authController.auth);
router.patch('/update-password', authController.updatePassword);
router.post(
  '/set-role',
  authController.restrict('Admin'),
  authController.setRole
);

module.exports = router;
