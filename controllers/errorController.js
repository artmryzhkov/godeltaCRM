const AppError = require('../untilities/appError');

const handleCastErrorDB = (err) => {
  const m = `Invalid ${err.path} : ${err.value}`;
  return new AppError(m, 400);
};

const handleDublicateFieldsDB = (err) => {
  const m = `${err.keyValue.email} already exits in the database.`;
  return new AppError(m, 400);
};

const handleUpdateDataDB = (err) => {
  const errMessages = Object.values(err.errors).map((val) => val.message);
  const m = `Invalid actions! ${errMessages.join('. ')}`;
  return new AppError(m, 400);
};

const handleJsonWebTokenError = () =>
  new AppError('Your token is invalid', 401);

const handleTokenExpiredError = () =>
  new AppError('Your token has expired! Please login again', 401);

const sendErrDev = (err, res) => {
  console.log(err);
  res.status(err.statusCode).json({
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack,
  });
};

const sendErrProd = (err, res) => {
  // console.error('Error: ', err);
  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });
  } else {
    console.log(err.message);
    res.status(500).json({
      status: 'Error',
      message: 'Something went wrong',
    });
  }
};

module.exports = (err, req, res, next) => {
  // console.log(err.stack);
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    sendErrDev(err, res);
  } else if (process.env.NODE_ENV === 'production') {
    let error = { ...err };
    error.message = err.message;
    if (err.name === 'CastError') error = handleCastErrorDB(error);
    if (err.code === 11000) error = handleDublicateFieldsDB(error);
    if (err.name === 'ValidationError') error = handleUpdateDataDB(error);
    if (err.name === 'JsonWebTokenError') error = handleJsonWebTokenError();
    if (err.name === 'TokenExpiredError') error = handleTokenExpiredError();
    sendErrProd(error, res);
  }
};
