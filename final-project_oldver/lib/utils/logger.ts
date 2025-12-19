type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  data?: unknown;
  error?: Error;
}

class Logger {
  private formatMessage(entry: LogEntry): string {
    const { level, message, timestamp, data, error } = entry;
    let logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

    if (data) {
      logMessage += ` | Data: ${JSON.stringify(data)}`;
    }

    if (error) {
      logMessage += ` | Error: ${error.message}`;
      if (error.stack) {
        logMessage += ` | Stack: ${error.stack}`;
      }
    }

    return logMessage;
  }

  private log(level: LogLevel, message: string, data?: unknown, error?: Error): void {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      data,
      error,
    };

    const formattedMessage = this.formatMessage(entry);

    switch (level) {
      case 'error':
        console.error(formattedMessage);
        break;
      case 'warn':
        console.warn(formattedMessage);
        break;
      case 'debug':
        if (process.env.NODE_ENV === 'development') {
          console.debug(formattedMessage);
        }
        break;
      default:
        console.log(formattedMessage);
    }
  }

  info(message: string, data?: unknown): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: unknown): void {
    this.log('warn', message, data);
  }

  error(message: string, error?: Error, data?: unknown): void {
    this.log('error', message, data, error);
  }

  debug(message: string, data?: unknown): void {
    this.log('debug', message, data);
  }
}

export const logger = new Logger();

