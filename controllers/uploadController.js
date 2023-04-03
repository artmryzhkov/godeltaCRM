const DriverCalculation = require('../models/DriverCalculation');
const catchAsync = require('../untilities/catchAsync');
const AppError = require('../untilities/appError');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const csv = require('fast-csv');

const multerFilter = (req, file, cb) => {
  if (
    file.mimetype.startsWith('text/csv') ||
    file.mimetype.startsWith(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ) ||
    file.mimetype.startsWith(
      'application/vnd.ms-excel.sheet.binary.macroEnabled.12'
    ) ||
    file.mimetype.startsWith(
      'application/vnd.ms-excel.sheet.macroEnabled.12'
    ) ||
    file.mimetype.startsWith('application/vnd.ms-excel')
  ) {
    cb(null, true);
  } else {
    cb(new AppError('Please upload only excel files', 400), false);
  }
};
const multerStorage = multer.diskStorage({
  destination: function (req, res, cb) {
    if (!fs.existsSync('public')) {
      fs.mkdirSync('public');
    }
    if (!fs.existsSync('public/csv')) {
      fs.mkdirSync('public/csv');
    }

    cb(null, 'public/csv');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + file.originalname);
  },
});

const uploads = multer({
  storage: multerStorage,
  fileFilter: multerFilter,
});

exports.uploadExcel = uploads.single('csvFile');

exports.readExcelFile = catchAsync(async (req, res, next) => {
  try {
    const allRecord = [];
    fs.createReadStream(
      path.join(__dirname, '../public/csv/', req.file.filename)
    )
      .pipe(csv.parse({ headers: true }))
      .on('error', (err) => console.log(err))
      .on('data', (row) => allRecord.push(row))
      .on('end', async (rowCount) => {
        let total = 0,
          cash = 0,
          vat = 0;
        for (let i = 0; i < rowCount; i++) {
          total += Number(allRecord[i].Total);
          total += Number(allRecord[i].T2);
          cash += Number(allRecord[i].Cash);
          vat += Number(allRecord[i].Vat);
        }
        vat += Number(req.body.sumavat);
        const transfer = total + cash + vat - 45;

        try {
          const newData = await DriverCalculation.create({
            total: total.toFixed(2),
            cash: cash.toFixed(2),
            vat: vat.toFixed(2),
            transfer: transfer.toFixed(2),
          });
          res.status(200).json({
            status: 'Sucess',
            data: newData,
          });
        } catch (err) {
          return next(
            new AppError('Something went wrong. Please try again later!', 400)
          );
        }
      });
  } catch (err) {
    return next(
      new AppError('Something went wrong. Please try again later!', 500)
    );
  }
});

exports.getDriverCalculations = catchAsync(async (req, res, next) => {
  let allDriverCalculation = await DriverCalculation.find();
  res.status(200).json({
    status: 'Sucess',
    data: allDriverCalculation[allDriverCalculation.length - 1],
  });
});
