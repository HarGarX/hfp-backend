import { Global, Module } from '@nestjs/common';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import DailyRotateFile = require('winston-daily-rotate-file');
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuditLogService } from './services/audit-log.service';
import { EnhancedLoggingInterceptor } from './interceptors/enhanced-logging.interceptor';
import { AuditLogInterceptor } from './interceptors/audit-log.interceptor';

@Global()
@Module({
  imports: [
    WinstonModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const env = configService.get('NODE_ENV', 'development');
        const logLevel = configService.get('LOG_LEVEL', 'info');
        const logDir = configService.get('LOG_DIR', 'logs');

        // Define custom format
        const customFormat = winston.format.combine(
          winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          winston.format.errors({ stack: true }),
          winston.format.splat(),
          winston.format.json(),
          winston.format.printf(({ timestamp, level, message, context, trace, ...meta }) => {
            const logEntry: any = {
              timestamp,
              level,
              message,
              context,
            };

            // Add metadata if present
            if (Object.keys(meta).length > 0) {
              logEntry.meta = meta;
            }

            // Add stack trace for errors
            if (trace) {
              logEntry.trace = trace;
            }

            return JSON.stringify(logEntry);
          }),
        );

        // Console format with colors for development
        const consoleFormat = winston.format.combine(
          winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          winston.format.colorize(),
          winston.format.printf(({ timestamp, level, message, context, trace }) => {
            const contextStr = context ? `[${context}]` : '';
            const traceStr = trace ? `\n${trace}` : '';
            return `${timestamp} ${level} ${contextStr} ${message}${traceStr}`;
          }),
        );

        const transports: winston.transport[] = [];

        // Console transport (always enabled)
        transports.push(
          new winston.transports.Console({
            format: env === 'production' ? customFormat : consoleFormat,
            level: logLevel,
          }),
        );

        // File transports (enabled in production or when LOG_TO_FILE=true)
        if (env === 'production' || configService.get('LOG_TO_FILE') === 'true') {
          // Combined log file (all logs)
          transports.push(
            new DailyRotateFile({
              filename: `${logDir}/application-%DATE%.log`,
              datePattern: 'YYYY-MM-DD',
              zippedArchive: true,
              maxSize: '20m',
              maxFiles: '14d',
              format: customFormat,
              level: 'info',
            }),
          );

          // Error log file (errors only)
          transports.push(
            new DailyRotateFile({
              filename: `${logDir}/error-%DATE%.log`,
              datePattern: 'YYYY-MM-DD',
              zippedArchive: true,
              maxSize: '20m',
              maxFiles: '30d',
              format: customFormat,
              level: 'error',
            }),
          );

          // Audit log file (audit events only)
          transports.push(
            new DailyRotateFile({
              filename: `${logDir}/audit-%DATE%.log`,
              datePattern: 'YYYY-MM-DD',
              zippedArchive: true,
              maxSize: '20m',
              maxFiles: '90d', // Keep audit logs for 90 days
              format: customFormat,
              level: 'info',
            }),
          );
        }

        return {
          transports,
          exitOnError: false,
          // Handle uncaught exceptions
          exceptionHandlers:
            env === 'production'
              ? [
                  new DailyRotateFile({
                    filename: `${logDir}/exceptions-%DATE%.log`,
                    datePattern: 'YYYY-MM-DD',
                    zippedArchive: true,
                    maxSize: '20m',
                    maxFiles: '30d',
                    format: customFormat,
                  }),
                ]
              : [],
          // Handle unhandled promise rejections
          rejectionHandlers:
            env === 'production'
              ? [
                  new DailyRotateFile({
                    filename: `${logDir}/rejections-%DATE%.log`,
                    datePattern: 'YYYY-MM-DD',
                    zippedArchive: true,
                    maxSize: '20m',
                    maxFiles: '30d',
                    format: customFormat,
                  }),
                ]
              : [],
        };
      },
      inject: [ConfigService],
    }),
  ],
  providers: [AuditLogService, EnhancedLoggingInterceptor, AuditLogInterceptor],
  exports: [WinstonModule, AuditLogService, EnhancedLoggingInterceptor, AuditLogInterceptor],
})
export class LoggerModule {}
