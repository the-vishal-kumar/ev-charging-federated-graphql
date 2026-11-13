import { createLogger, format, transports } from 'winston';

const logFormatter = format.printf(info => {
  const { timestamp, level, stack, message } = info;
  const stackOrMessage = stack || message;
  return `${timestamp} ${level}: ${stackOrMessage}`;
});

export const config = {
  level: 'info',
  // Keep test output readable; assertions don't depend on log lines.
  silent: process.env.NODE_ENV === 'test',
  format: format.errors({ stack: true }),
  transports: [
    new transports.Console({
      format: format.combine(format.colorize(), format.simple(), format.timestamp(), logFormatter),
    }),
  ],
  handleExceptions: true,
  handleRejections: true,
};

const Logger = createLogger(config);

export default Logger;
