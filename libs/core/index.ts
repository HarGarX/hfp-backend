/**
 * Core utilities and shared components for HFP backend
 */

// Core module
export { CoreModule } from './core.module';

// Configuration
export { AppConfigService } from './config/app-config.service';

// Interceptors
export { LoggingInterceptor } from './interceptors/logging.interceptor';

// Filters  
export { GlobalExceptionFilter } from './filters/global-exception.filter';

// Validation
export * from './validation/validation-exception';
export * from './validation/validation.decorators';