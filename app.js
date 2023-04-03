const path = require('path');
const express = require('express');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const cors = require('cors');
const AppError = require('./untilities/appError');
const globalErrorHandler = require('./controllers/errorController');

const app = express();

app.use(
  cors({
    origin: '*',
  })
);
app.use(express.static(path.join(__dirname, 'public')));
app.use(helmet());
app.use(morgan('dev'));
const limiter = rateLimit({
  max: 100,
  windowMs: 60 * 60 * 1000,
  message: 'Too many requests from this IP, please try again in an hour!',
});
app.use('/api', limiter);
app.use(express.json({ limit: '10kb' }));
app.use(mongoSanitize());
app.use(xss());
app.use(
  hpp({
    whitelist: [
      'duration',
      'ratingsQuantity',
      'ratingsAverage',
      'maxGroupSize',
      'difficulty',
      'price',
    ],
  })
);
app.use((req, res, next) => {
  req.time = new Date().toISOString();
  next();
});

const userRouter = require('./routes/userRouter');
app.use('/api/v1/users', userRouter);

const uploadRouter = require('./routes/uploadRouter');
app.use('/api/v1/up', uploadRouter);

app.all('*', (req, res, next) => {
  next(
    new AppError(`Can't find this ${req.originalUrl} url in the server!`, 404)
  );
});

app.use(globalErrorHandler);

module.exports = app;
