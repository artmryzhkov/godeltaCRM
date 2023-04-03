const User = require('../models/User');
const fs = require('fs');
const multer = require('multer');
const sharp = require('sharp');
const crypto = require('crypto');
const { promisify } = require('util');
const catchAsync = require('../untilities/catchAsync');
const AppError = require('../untilities/appError');
const Email = require('../untilities/email');
const jwt = require('jsonwebtoken');

const multerFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image')) {
    cb(null, true);
  } else {
    cb(new AppError('Please upload only image files', 400), false);
  }
};
const multerStorage = multer.memoryStorage();
const uploads = multer({
  storage: multerStorage,
  fileFilter: multerFilter,
});

exports.uploadUserImage = uploads.single('image');

exports.resizeImage = catchAsync(async (req, res, next) => {
  if (!req.file) {
    req.defaultProfile = `${req.protocol}://${req.get(
      'host'
    )}/img/users/default.jpg`;
    return next();
  }

  req.file.filename = `user-${crypto
    .randomBytes(8)
    .toString('hex')}-${Date.now()}.jpeg`;

  await sharp(req.file.buffer)
    .resize(600, 600)
    .toFormat('jpeg')
    .jpeg({ quality: 90 })
    .toFile(`public/img/users/${req.file.filename}`);

  req.file.filename = `${req.protocol}://${req.get('host')}/img/users/${
    req.file.filename
  }`;
  next();
});

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

const createAndSendToken = (user, code, res) => {
  const token = signToken(user._id);
  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
  };
  if (process.env.NODE_ENV === 'production') cookieOptions.secure = true;
  res.cookie('jwt', token, cookieOptions);
  res.status(code).json({
    status: 'Success',
    token,
    data: {
      user: {
        name: user.name,
        email: user.email,
        image: user.image,
        role: user.role,
      },
    },
  });
};

const signUserEmailVarification = (email, site) => {
  const validateToken = jwt.sign({ email }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });

  const validateUrl = `${site}/active-account?token=${validateToken}`;

  return validateUrl;
};

exports.signup = catchAsync(async (req, res, next) => {
  const { name, email, password, confirmPassword } = req.body;

  if (!name || !email || !password || !confirmPassword) {
    return next(new AppError("You can't leave any field empty", 400));
  }
  let imgPath;
  if (!req.file) {
    imgPath = req.defaultProfile;
  } else {
    imgPath = req.file.filename;
  }
  const newUser = await User.create({
    name: req.body.name,
    email: req.body.email,
    image: imgPath,
    password: req.body.password,
    confirmPassword: req.body.confirmPassword,
  });

  try {
    const validateUrl = signUserEmailVarification(
      req.body.email,
      req.get('origin')
    );
    await new Email(newUser, validateUrl).sendWelcome();

    res.status(201).json({
      status: 'Success',
      message:
        'We have sent an account activation link in your provided email. Please active your account before you continue. Please note: Your account will be deleted if you do not take any action in 24 hour',
    });
  } catch (err) {
    await User.findOneAndDelete({ email: req.body.email });
    const imageFilename = req.file.filename.split('/users/')[1];
    if (req.file) {
      fs.unlinkSync(`${__dirname}/../public/img/users/${imageFilename}`);
    }
    return next(
      new AppError(
        'Something went wrong in sending email. Please try again later!',
        500
      )
    );
  }
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(new AppError("You can't leave any field empty", 400));
  }

  const user = await User.findOne({ email }).select('+validEmail +password');

  if (user && !user['validEmail']) {
    return next(
      new AppError(
        'Your account is not activated please check your mail inbox and active your account first!',
        401
      )
    );
  }

  if (!user || !(await user.comparePassword(password, user.password))) {
    return next(new AppError('Invalid email or password', 401));
  }

  createAndSendToken(user, 200, res);
});

exports.setRole = catchAsync(async (req, res, next) => {
  if (req.user.role !== 'admin') {
    return next(new AppError(`You don't have permission to update role.`, 400));
  }
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(new AppError(`Didn't found any user with that email`, 400));
  }

  user.role = req.body.role;
  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    status: 'Sucess',
    data: {
      user,
    },
  });
});

exports.protect = catchAsync(async (req, res, next) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) {
    return next(new AppError('You are not logged in!', 401));
  }

  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

  const freshUser = await User.findById(decoded.id);
  if (!freshUser) {
    return next(
      new AppError('The user belonging this token no longer exist', 401)
    );
  }

  if (freshUser.changedPasswordAfter(decoded.iat)) {
    return next(
      new AppError('Password changed recently! Please log in again.')
    );
  }

  req.user = freshUser;
  next();
});

exports.restrict = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      next(
        new AppError("You don't have permission to access this resource", 403)
      );
    }
    next();
  };
};

exports.forgetPassword = catchAsync(async (req, res, next) => {
  const user = await User.findOne({ email: req.body.email });

  if (!user) {
    return next(new AppError(`Didn't found any user with that email`, 404));
  }

  const resetToken = user.createPasswordResetToken();

  await user.save({ validateBeforeSave: false });

  const resetUrl = `${req.get('origin')}/reset-password?token=${resetToken}`;

  try {
    await new Email(user, resetUrl).sendPasswordReset();
  } catch (err) {
    user.passResetToken = undefined;
    user.passResetExpire = undefined;
    await user.save({ validateBeforeSave: false });

    return next(
      new AppError(
        'Something went wrong in sending email. Please try again later!',
        500
      )
    );
  }

  res.status(200).json({
    status: 'Sucess',
  });
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  const hashedPass = crypto
    .createHash('sha256')
    .update(req.params.resetToken)
    .digest('hex');

  const user = await User.findOne({
    passResetToken: hashedPass,
    passResetExpire: { $gt: Date.now() },
  });

  if (!user) {
    return next(
      new AppError('Invalid token or has expired. Please try again.', 400)
    );
  }

  user.password = req.body.password;
  user.confirmPassword = req.body.confirmPassword;
  user.passResetToken = undefined;
  user.passResetExpire = undefined;
  await user.save();
  createAndSendToken(user, 200, res);
});

exports.updatePassword = catchAsync(async (req, res, next) => {
  const user = await User.findOne({ _id: req.user.id }).select('+password');

  if (!(await user.comparePassword(req.body.currentPassword, user.password))) {
    return next(new AppError('Your current password is wrong', 401));
  }

  if (await user.comparePassword(req.body.password, user.password)) {
    return next(
      new AppError(`Your current password and new password can't be same`, 400)
    );
  }

  user.password = req.body.password;
  user.confirmPassword = req.body.confirmPassword;
  await user.save();
  createAndSendToken(user, 200, res);
});

exports.auth = (req, res) => {
  res.status(200).json({
    status: 'success',
  });
};

exports.validateEmail = catchAsync(async (req, res) => {
  const decoded = await promisify(jwt.verify)(
    req.params.token,
    process.env.JWT_SECRET
  );

  if (!(await User.findOne({ email: decoded.email }))) {
    return new AppError(
      'Sorry! Your account has been deleted due to our account activation time policy. Please sign up again to continue.'
    );
  }

  await User.findOneAndUpdate(
    { email: decoded.email },
    { $unset: { expiresAt: '' } },
    {
      new: true,
      runValidators: true,
    }
  );

  const user = await User.findOneAndUpdate(
    { email: decoded.email },
    { validEmail: true },
    {
      new: true,
      runValidators: true,
    }
  );

  createAndSendToken(user, 201, res);
});

exports.verifyEmail = catchAsync(async (req, res, next) => {
  const decoded = await promisify(jwt.verify)(
    req.params.token,
    process.env.JWT_SECRET
  );

  const user = await User.findOneAndUpdate(
    { _id: req.user._id },
    { email: decoded.email },
    {
      new: true,
      runValidators: true,
    }
  );

  res.status(200).json({
    status: 'success',
    data: {
      user: {
        name: user.name,
        email: user.email,
        image: user.image,
      },
    },
  });
});

exports.getAllDrivers = catchAsync(async (req, res, next) => {
  let allDrivers = await User.find({ role: 'Driver' });
  res.status(200).json({
    status: 'Sucess',
    data: allDrivers,
  });
});
