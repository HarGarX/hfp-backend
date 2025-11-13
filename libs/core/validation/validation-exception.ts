import { BadRequestException } from '@nestjs/common';

/**
 * Custom exception for validation errors
 * Provides structured error messages for client consumption
 */
export class ValidationException extends BadRequestException {
  public readonly field: string;
  public readonly value: any;
  public readonly constraint: string;

  constructor(
    field: string,
    value: any,
    constraint: string,
    message?: string,
  ) {
    super({
      error: 'Validation Error',
      message: message || `Validation failed for field '${field}'`,
      details: {
        field,
        value,
        constraint,
      },
      timestamp: new Date().toISOString(),
    });
    
    this.field = field;
    this.value = value;
    this.constraint = constraint;
  }

  /**
   * Create validation exception from class-validator errors
   */
  static fromValidationError(errors: any[]): ValidationException {
    const firstError = errors[0];
    const constraint = Object.keys(firstError.constraints || {})[0];
    const message = firstError.constraints?.[constraint];

    return new ValidationException(
      firstError.property,
      firstError.value,
      constraint,
      message,
    );
  }

  /**
   * Create multiple validation exceptions
   */
  static fromValidationErrors(errors: any[]): ValidationException[] {
    return errors.map(error => {
      const constraint = Object.keys(error.constraints || {})[0];
      const message = error.constraints?.[constraint];

      return new ValidationException(
        error.property,
        error.value,
        constraint,
        message,
      );
    });
  }
}