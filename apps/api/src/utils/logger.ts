type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const COLORS: Record<LogLevel, string> = {
  debug: '\x1b[36m',  // cyan
  info: '\x1b[32m',   // green
  warn: '\x1b[33m',   // yellow
  error: '\x1b[31m',  // red
};

const RESET = '\x1b[0m';

class Logger {
  private context: string;
  private minLevel: LogLevel;

  constructor(context: string, minLevel: LogLevel = 'debug') {
    this.context = context;
    this.minLevel = minLevel;
  }

  private shouldLog(level: LogLevel): boolean {
    return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[this.minLevel];
  }

  private format(level: LogLevel, message: string, data?: Record<string, unknown>): string {
    const ts = new Date().toISOString();
    const color = COLORS[level];
    const prefix = `${color}[${level.toUpperCase()}]${RESET}`;
    const ctx = `\x1b[90m[${this.context}]${RESET}`;
    const base = `${ts} ${prefix} ${ctx} ${message}`;
    if (data && Object.keys(data).length > 0) {
      return `${base} ${JSON.stringify(data)}`;
    }
    return base;
  }

  debug(message: string, data?: Record<string, unknown>) {
    if (this.shouldLog('debug')) {
      console.debug(this.format('debug', message, data));
    }
  }

  info(message: string, data?: Record<string, unknown>) {
    if (this.shouldLog('info')) {
      console.info(this.format('info', message, data));
    }
  }

  warn(message: string, data?: Record<string, unknown>) {
    if (this.shouldLog('warn')) {
      console.warn(this.format('warn', message, data));
    }
  }

  error(message: string, data?: Record<string, unknown>) {
    if (this.shouldLog('error')) {
      console.error(this.format('error', message, data));
    }
  }

  child(subContext: string): Logger {
    return new Logger(`${this.context}:${subContext}`, this.minLevel);
  }
}

export function createLogger(context: string): Logger {
  const minLevel = (process.env['LOG_LEVEL'] as LogLevel) ?? 'debug';
  return new Logger(context, minLevel);
}

export { Logger };
