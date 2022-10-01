const { createLogger, format, transports } = require('winston');
const { combine, timestamp, label, printf } = format;

const myFormat = printf(({ level, message, label, timestamp }) => {
    return `${timestamp} [${label}] ${level}: ${message}`;
  });  

const logger = createLogger({
    format: format.combine(
        label({ label: 'Crawler' }),
        timestamp(),
        myFormat  
    ),
    transports: [
        new transports.File({ filename: 'info.log', level: 'info' }),
    ],
});

module.exports = logger;