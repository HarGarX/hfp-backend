import { 
  registerDecorator, 
  ValidationOptions, 
  ValidatorConstraint, 
  ValidatorConstraintInterface,
  ValidationArguments 
} from 'class-validator';

/**
 * Validates that a string is a valid UUID
 */
@ValidatorConstraint({ async: false })
export class IsUuidConstraint implements ValidatorConstraintInterface {
  validate(value: any): boolean {
    if (typeof value !== 'string') return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(value);
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must be a valid UUID`;
  }
}

export function IsUuid(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsUuidConstraint,
    });
  };
}

/**
 * Validates that a value is not empty (null, undefined, or empty string)
 */
@ValidatorConstraint({ async: false })
export class IsNotEmptyConstraint implements ValidatorConstraintInterface {
  validate(value: any): boolean {
    return value !== null && value !== undefined && value !== '';
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} should not be empty`;
  }
}

export function IsNotEmpty(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsNotEmptyConstraint,
    });
  };
}

/**
 * Validates that a string matches the household ID format
 */
@ValidatorConstraint({ async: false })
export class IsHouseholdIdConstraint implements ValidatorConstraintInterface {
  validate(value: any): boolean {
    if (typeof value !== 'string') return false;
    // Household IDs are UUIDs
    return new IsUuidConstraint().validate(value);
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must be a valid household ID`;
  }
}

export function IsHouseholdId(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsHouseholdIdConstraint,
    });
  };
}

/**
 * Validates that a value is a positive number
 */
@ValidatorConstraint({ async: false })
export class IsPositiveNumberConstraint implements ValidatorConstraintInterface {
  validate(value: any): boolean {
    return typeof value === 'number' && value > 0;
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must be a positive number`;
  }
}

export function IsPositiveNumber(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsPositiveNumberConstraint,
    });
  };
}

/**
 * Validates that a value is a valid monetary amount (up to 2 decimal places)
 */
@ValidatorConstraint({ async: false })
export class IsMoneyAmountConstraint implements ValidatorConstraintInterface {
  validate(value: any): boolean {
    if (typeof value !== 'number') return false;
    if (value < 0) return false;
    
    // Check for at most 2 decimal places
    const decimalPlaces = (value.toString().split('.')[1] || '').length;
    return decimalPlaces <= 2;
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must be a valid monetary amount with at most 2 decimal places`;
  }
}

export function IsMoneyAmount(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsMoneyAmountConstraint,
    });
  };
}

/**
 * Validates that a string is a valid email format
 */
@ValidatorConstraint({ async: false })
export class IsValidEmailConstraint implements ValidatorConstraintInterface {
  validate(value: any): boolean {
    if (typeof value !== 'string') return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must be a valid email address`;
  }
}

export function IsValidEmail(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidEmailConstraint,
    });
  };
}

/**
 * Validates that a date is not in the future
 */
@ValidatorConstraint({ async: false })
export class IsNotFutureDateConstraint implements ValidatorConstraintInterface {
  validate(value: any): boolean {
    if (!(value instanceof Date)) return false;
    return value <= new Date();
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} cannot be in the future`;
  }
}

export function IsNotFutureDate(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsNotFutureDateConstraint,
    });
  };
}