import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Centralized configuration service for the HFP application
 * Provides type-safe access to environment variables and configuration values
 */
@Injectable()
export class AppConfigService {
  private readonly logger = new Logger(AppConfigService.name);

  constructor(private configService: ConfigService) {
    this.validateConfiguration();
  }

  // Database Configuration
  get database() {
    return {
      host: this.configService.get<string>('DB_HOST', 'localhost'),
      port: this.configService.get<number>('DB_PORT', 5432),
      username: this.configService.get<string>('DB_USERNAME', 'hfp_user'),
      password: this.configService.get<string>('DB_PASSWORD', 'hfp_password'),
      database: this.configService.get<string>('DB_DATABASE', 'hfp_dev'),
      synchronize: this.configService.get<boolean>('DB_SYNCHRONIZE', false),
      logging: this.configService.get<boolean>('DB_LOGGING', false),
    };
  }

  // Redis Configuration
  get redis() {
    return {
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: this.configService.get<number>('REDIS_PORT', 6379),
      password: this.configService.get<string>('REDIS_PASSWORD'),
      db: this.configService.get<number>('REDIS_DB', 0),
    };
  }

  // JWT Configuration
  get jwt() {
    return {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: this.configService.get<string>('JWT_EXPIRES_IN', '1h'),
      refreshExpiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
    };
  }

  // Application Configuration
  get app() {
    return {
      port: this.configService.get<number>('PORT', 3000),
      host: this.configService.get<string>('HOST', 'localhost'),
      nodeEnv: this.configService.get<string>('NODE_ENV', 'development'),
      apiPrefix: this.configService.get<string>('API_PREFIX', 'api/v1'),
      corsOrigins: this.configService.get<string>('CORS_ORIGINS', '*').split(','),
    };
  }

  // File Storage Configuration
  get storage() {
    return {
      provider: this.configService.get<string>('STORAGE_PROVIDER', 'local'),
      uploadDir: this.configService.get<string>('UPLOAD_DIR', './uploads'),
      maxFileSize: this.configService.get<number>('MAX_FILE_SIZE', 10 * 1024 * 1024), // 10MB
      allowedMimeTypes: this.configService.get<string>('ALLOWED_MIME_TYPES', 'image/jpeg,image/png,application/pdf').split(','),
    };
  }

  // Rate Limiting Configuration
  get rateLimit() {
    return {
      ttl: this.configService.get<number>('RATE_LIMIT_TTL', 60), // seconds
      limit: this.configService.get<number>('RATE_LIMIT_MAX', 10), // requests per TTL
    };
  }

  // Email Configuration
  get email() {
    return {
      host: this.configService.get<string>('SMTP_HOST'),
      port: this.configService.get<number>('SMTP_PORT', 587),
      secure: this.configService.get<boolean>('SMTP_SECURE', false),
      user: this.configService.get<string>('SMTP_USER'),
      password: this.configService.get<string>('SMTP_PASSWORD'),
      from: this.configService.get<string>('SMTP_FROM', 'noreply@hfp.com'),
    };
  }

  // Feature Flags
  get features() {
    return {
      enableSignup: this.configService.get<boolean>('ENABLE_SIGNUP', true),
      enableEmailVerification: this.configService.get<boolean>('ENABLE_EMAIL_VERIFICATION', false),
      enablePasswordReset: this.configService.get<boolean>('ENABLE_PASSWORD_RESET', true),
      enableFileUpload: this.configService.get<boolean>('ENABLE_FILE_UPLOAD', true),
      enableNotifications: this.configService.get<boolean>('ENABLE_NOTIFICATIONS', true),
      enableInsights: this.configService.get<boolean>('ENABLE_INSIGHTS', true),
    };
  }

  // Utility Methods
  get isDevelopment(): boolean {
    return this.app.nodeEnv === 'development';
  }

  get isProduction(): boolean {
    return this.app.nodeEnv === 'production';
  }

  get isTest(): boolean {
    return this.app.nodeEnv === 'test';
  }

  /**
   * Validates critical configuration values on startup
   */
  private validateConfiguration() {
    const required = [
      'JWT_SECRET',
    ];

    const missing = required.filter(key => !this.configService.get(key));

    if (missing.length > 0) {
      this.logger.error(`Missing required configuration: ${missing.join(', ')}`);
      process.exit(1);
    }

    if (this.isProduction) {
      const prodRequired = [
        'DB_HOST',
        'DB_USERNAME', 
        'DB_PASSWORD',
        'DB_DATABASE',
        'REDIS_HOST',
      ];

      const prodMissing = prodRequired.filter(key => !this.configService.get(key));

      if (prodMissing.length > 0) {
        this.logger.error(`Missing required production configuration: ${prodMissing.join(', ')}`);
        process.exit(1);
      }
    }

    this.logger.log(`Configuration loaded for environment: ${this.app.nodeEnv}`);
  }
}