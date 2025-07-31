// Comprehensive logging system for Convex functions
import { v } from 'convex/values';

// Log levels
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4,
}

// Log entry interface
export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  userId?: string;
  teamId?: string;
  functionName?: string;
  duration?: number;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  metadata?: {
    userAgent?: string;
    ip?: string;
    sessionId?: string;
    requestId?: string;
  };
}

// Logger class
class Logger {
  private minLevel: LogLevel = LogLevel.INFO;
  private logs: LogEntry[] = [];
  private maxLogs = 10000; // Keep last 10k logs in memory

  constructor(minLevel: LogLevel = LogLevel.INFO) {
    this.minLevel = minLevel;
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.minLevel;
  }

  private addLog(entry: LogEntry) {
    this.logs.push(entry);

    // Keep only recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // In production, send to external logging service
    if (process.env.NODE_ENV === 'production') {
      this.sendToExternalService(entry);
    } else {
      // Console output for development
      this.logToConsole(entry);
    }
  }

  private logToConsole(entry: LogEntry) {
    const timestamp = new Date(entry.timestamp).toISOString();
    const levelName = LogLevel[entry.level];
    const prefix = `[${timestamp}] ${levelName}`;

    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(prefix, entry.message, entry.context);
        break;
      case LogLevel.INFO:
        console.info(prefix, entry.message, entry.context);
        break;
      case LogLevel.WARN:
        console.warn(prefix, entry.message, entry.context);
        break;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(prefix, entry.message, entry.context, entry.error);
        break;
    }
  }

  private sendToExternalService(entry: LogEntry) {
    // In production, integrate with services like:
    // - Datadog
    // - New Relic
    // - Sentry
    // - CloudWatch
    // - Custom logging endpoint
    // Example implementation:
    // fetch('/api/logs', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(entry)
    // }).catch(console.error);
  }

  debug(
    message: string,
    context?: Record<string, any>,
    metadata?: LogEntry['metadata']
  ) {
    if (!this.shouldLog(LogLevel.DEBUG)) return;

    this.addLog({
      timestamp: Date.now(),
      level: LogLevel.DEBUG,
      message,
      context,
      metadata,
    });
  }

  info(
    message: string,
    context?: Record<string, any>,
    metadata?: LogEntry['metadata']
  ) {
    if (!this.shouldLog(LogLevel.INFO)) return;

    this.addLog({
      timestamp: Date.now(),
      level: LogLevel.INFO,
      message,
      context,
      metadata,
    });
  }

  warn(
    message: string,
    context?: Record<string, any>,
    metadata?: LogEntry['metadata']
  ) {
    if (!this.shouldLog(LogLevel.WARN)) return;

    this.addLog({
      timestamp: Date.now(),
      level: LogLevel.WARN,
      message,
      context,
      metadata,
    });
  }

  error(
    message: string,
    error?: Error,
    context?: Record<string, any>,
    metadata?: LogEntry['metadata']
  ) {
    if (!this.shouldLog(LogLevel.ERROR)) return;

    this.addLog({
      timestamp: Date.now(),
      level: LogLevel.ERROR,
      message,
      context,
      metadata,
      error: error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
          }
        : undefined,
    });
  }

  fatal(
    message: string,
    error?: Error,
    context?: Record<string, any>,
    metadata?: LogEntry['metadata']
  ) {
    this.addLog({
      timestamp: Date.now(),
      level: LogLevel.FATAL,
      message,
      context,
      metadata,
      error: error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
          }
        : undefined,
    });
  }

  // Function execution logging
  logFunctionStart(
    functionName: string,
    args: any,
    userId?: string,
    teamId?: string
  ) {
    this.info(`Function ${functionName} started`, {
      functionName,
      args: this.sanitizeArgs(args),
      userId,
      teamId,
    });
  }

  logFunctionEnd(
    functionName: string,
    duration: number,
    result?: any,
    userId?: string,
    teamId?: string
  ) {
    this.info(`Function ${functionName} completed`, {
      functionName,
      duration,
      resultSize: result ? JSON.stringify(result).length : 0,
      userId,
      teamId,
    });
  }

  logFunctionError(
    functionName: string,
    error: Error,
    duration: number,
    userId?: string,
    teamId?: string
  ) {
    this.error(`Function ${functionName} failed`, error, {
      functionName,
      duration,
      userId,
      teamId,
    });
  }

  // Database operation logging
  logDatabaseQuery(
    operation: string,
    table: string,
    duration: number,
    resultCount?: number
  ) {
    this.debug(`Database ${operation} on ${table}`, {
      operation,
      table,
      duration,
      resultCount,
    });
  }

  logDatabaseError(
    operation: string,
    table: string,
    error: Error,
    duration: number
  ) {
    this.error(`Database ${operation} on ${table} failed`, error, {
      operation,
      table,
      duration,
    });
  }

  // User activity logging
  logUserAction(
    action: string,
    userId: string,
    teamId?: string,
    details?: Record<string, any>
  ) {
    this.info(`User action: ${action}`, {
      action,
      userId,
      teamId,
      ...details,
    });
  }

  // Security logging
  logSecurityEvent(
    event: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    details: Record<string, any>
  ) {
    const level =
      severity === 'critical'
        ? LogLevel.FATAL
        : severity === 'high'
          ? LogLevel.ERROR
          : severity === 'medium'
            ? LogLevel.WARN
            : LogLevel.INFO;

    this.addLog({
      timestamp: Date.now(),
      level,
      message: `Security event: ${event}`,
      context: { ...details, severity, securityEvent: true },
    });
  }

  // Performance logging
  logPerformanceMetric(
    metric: string,
    value: number,
    unit: string,
    context?: Record<string, any>
  ) {
    this.info(`Performance metric: ${metric}`, {
      metric,
      value,
      unit,
      ...context,
    });
  }

  // Get logs for analysis
  getLogs(filters?: {
    level?: LogLevel;
    functionName?: string;
    userId?: string;
    teamId?: string;
    startTime?: number;
    endTime?: number;
    limit?: number;
  }): LogEntry[] {
    let filtered = this.logs;

    if (filters) {
      if (filters.level !== undefined) {
        filtered = filtered.filter((log) => log.level >= filters.level!);
      }
      if (filters.functionName) {
        filtered = filtered.filter(
          (log) => log.functionName === filters.functionName
        );
      }
      if (filters.userId) {
        filtered = filtered.filter((log) => log.userId === filters.userId);
      }
      if (filters.teamId) {
        filtered = filtered.filter((log) => log.teamId === filters.teamId);
      }
      if (filters.startTime) {
        filtered = filtered.filter(
          (log) => log.timestamp >= filters.startTime!
        );
      }
      if (filters.endTime) {
        filtered = filtered.filter((log) => log.timestamp <= filters.endTime!);
      }
    }

    const limit = filters?.limit || 1000;
    return filtered.slice(-limit);
  }

  // Get log statistics
  getLogStats(timeRange?: number): {
    totalLogs: number;
    logsByLevel: Record<string, number>;
    errorRate: number;
    topErrors: Array<{ message: string; count: number }>;
    topFunctions: Array<{ name: string; count: number; avgDuration: number }>;
  } {
    const cutoff = timeRange ? Date.now() - timeRange : 0;
    const relevantLogs = this.logs.filter((log) => log.timestamp > cutoff);

    const logsByLevel: Record<string, number> = {};
    const errorMessages = new Map<string, number>();
    const functionStats = new Map<
      string,
      { count: number; totalDuration: number }
    >();

    for (const log of relevantLogs) {
      // Count by level
      const levelName = LogLevel[log.level];
      logsByLevel[levelName] = (logsByLevel[levelName] || 0) + 1;

      // Track errors
      if (log.level >= LogLevel.ERROR && log.error) {
        const count = errorMessages.get(log.error.message) || 0;
        errorMessages.set(log.error.message, count + 1);
      }

      // Track function performance
      if (log.functionName && log.duration !== undefined) {
        const stats = functionStats.get(log.functionName) || {
          count: 0,
          totalDuration: 0,
        };
        stats.count++;
        stats.totalDuration += log.duration;
        functionStats.set(log.functionName, stats);
      }
    }

    const totalLogs = relevantLogs.length;
    const errorLogs = (logsByLevel['ERROR'] || 0) + (logsByLevel['FATAL'] || 0);
    const errorRate = totalLogs > 0 ? (errorLogs / totalLogs) * 100 : 0;

    const topErrors = Array.from(errorMessages.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([message, count]) => ({ message, count }));

    const topFunctions = Array.from(functionStats.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([name, stats]) => ({
        name,
        count: stats.count,
        avgDuration: stats.totalDuration / stats.count,
      }));

    return {
      totalLogs,
      logsByLevel,
      errorRate,
      topErrors,
      topFunctions,
    };
  }

  private sanitizeArgs(args: any): any {
    // Remove sensitive information from logs
    if (typeof args !== 'object' || args === null) {
      return args;
    }

    const sanitized = { ...args };
    const sensitiveKeys = ['password', 'token', 'apiKey', 'secret', 'auth'];

    for (const key of Object.keys(sanitized)) {
      if (
        sensitiveKeys.some((sensitive) => key.toLowerCase().includes(sensitive))
      ) {
        sanitized[key] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  // Clear old logs
  clearOldLogs(olderThan: number) {
    const cutoff = Date.now() - olderThan;
    this.logs = this.logs.filter((log) => log.timestamp > cutoff);
  }

  // Export logs for analysis
  exportLogs(format: 'json' | 'csv' = 'json'): string {
    if (format === 'csv') {
      const headers = [
        'timestamp',
        'level',
        'message',
        'functionName',
        'userId',
        'teamId',
        'duration',
      ];
      const rows = this.logs.map((log) => [
        new Date(log.timestamp).toISOString(),
        LogLevel[log.level],
        log.message,
        log.functionName || '',
        log.userId || '',
        log.teamId || '',
        log.duration || '',
      ]);

      return [headers, ...rows].map((row) => row.join(',')).join('\n');
    }

    return JSON.stringify(this.logs, null, 2);
  }
}

// Global logger instance
export const logger = new Logger(
  process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.INFO
);

// Function wrapper for automatic logging
export function withLogging<T extends any[], R>(
  functionName: string,
  fn: (...args: T) => Promise<R>
) {
  return async (...args: T): Promise<R> => {
    const startTime = Date.now();

    try {
      logger.logFunctionStart(functionName, args);
      const result = await fn(...args);
      const duration = Date.now() - startTime;
      logger.logFunctionEnd(functionName, duration, result);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.logFunctionError(functionName, error as Error, duration);
      throw error;
    }
  };
}

// Database operation wrapper
export function withDatabaseLogging<T>(
  operation: string,
  table: string,
  fn: () => Promise<T>
) {
  return async (): Promise<T> => {
    const startTime = Date.now();

    try {
      const result = await fn();
      const duration = Date.now() - startTime;
      const resultCount = Array.isArray(result) ? result.length : undefined;
      logger.logDatabaseQuery(operation, table, duration, resultCount);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.logDatabaseError(operation, table, error as Error, duration);
      throw error;
    }
  };
}

// Note: Cleanup would be handled by a scheduled function in production
// setInterval is not available in Convex runtime environment
