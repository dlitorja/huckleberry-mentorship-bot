import { describe, it, expect } from '@jest/globals';
import {
  validatePositiveInteger,
  validateNonEmptyString,
  validateEmail,
  validateDate,
  validateDiscordId,
  validateUrl,
  validateCurrency,
  validateNumeric,
  validateTransactionId,
  validateName,
} from '../validation.js';
import { ValidationError } from '../errors.js';

describe('validation', () => {
  describe('validatePositiveInteger', () => {
    it('should accept valid positive integers', () => {
      expect(validatePositiveInteger(5, 'count')).toBe(5);
      expect(validatePositiveInteger(1, 'count')).toBe(1);
      expect(validatePositiveInteger(100, 'count')).toBe(100);
    });

    it('should accept integers within min/max range', () => {
      expect(validatePositiveInteger(5, 'count', 1, 10)).toBe(5);
      expect(validatePositiveInteger(1, 'count', 1, 10)).toBe(1);
      expect(validatePositiveInteger(10, 'count', 1, 10)).toBe(10);
    });

    it('should reject non-integers', () => {
      expect(() => validatePositiveInteger(5.5, 'count')).toThrow(ValidationError);
      expect(() => validatePositiveInteger('5', 'count')).toThrow(ValidationError);
      expect(() => validatePositiveInteger(null, 'count')).toThrow(ValidationError);
    });

    it('should reject values below minimum', () => {
      expect(() => validatePositiveInteger(0, 'count', 1)).toThrow(ValidationError);
      expect(() => validatePositiveInteger(-1, 'count', 1)).toThrow(ValidationError);
    });

    it('should reject values above maximum', () => {
      expect(() => validatePositiveInteger(11, 'count', 1, 10)).toThrow(ValidationError);
    });
  });

  describe('validateNonEmptyString', () => {
    it('should accept valid non-empty strings', () => {
      expect(validateNonEmptyString('hello', 'name')).toBe('hello');
      expect(validateNonEmptyString('  hello  ', 'name')).toBe('hello'); // trims
    });

    it('should reject empty strings', () => {
      expect(() => validateNonEmptyString('', 'name')).toThrow(ValidationError);
      expect(() => validateNonEmptyString('   ', 'name')).toThrow(ValidationError);
    });

    it('should reject non-strings', () => {
      expect(() => validateNonEmptyString(123, 'name')).toThrow(ValidationError);
      expect(() => validateNonEmptyString(null, 'name')).toThrow(ValidationError);
      expect(() => validateNonEmptyString(undefined, 'name')).toThrow(ValidationError);
    });

    it('should enforce max length', () => {
      expect(validateNonEmptyString('hello', 'name', 10)).toBe('hello');
      expect(() => validateNonEmptyString('hello world', 'name', 5)).toThrow(ValidationError);
    });
  });

  describe('validateEmail', () => {
    it('should accept valid email addresses', () => {
      expect(validateEmail('test@example.com', 'email')).toBe('test@example.com');
      expect(validateEmail('user.name@example.co.uk', 'email')).toBe('user.name@example.co.uk');
      expect(validateEmail('Test@Example.COM', 'email')).toBe('test@example.com'); // lowercase
    });

    it('should reject invalid email addresses', () => {
      expect(() => validateEmail('invalid', 'email')).toThrow(ValidationError);
      expect(() => validateEmail('invalid@', 'email')).toThrow(ValidationError);
      expect(() => validateEmail('@example.com', 'email')).toThrow(ValidationError);
      expect(() => validateEmail('test@', 'email')).toThrow(ValidationError);
    });

    it('should reject empty strings', () => {
      expect(() => validateEmail('', 'email')).toThrow(ValidationError);
    });
  });

  describe('validateDate', () => {
    it('should accept valid date strings', () => {
      const date = validateDate('2024-01-01', 'date');
      expect(date).toBeInstanceOf(Date);
      // Use UTC to avoid timezone issues
      const utcDate = new Date(Date.UTC(2024, 0, 1));
      expect(date.getTime()).toBe(utcDate.getTime());
    });

    it('should reject invalid date strings', () => {
      expect(() => validateDate('invalid', 'date')).toThrow(ValidationError);
      expect(() => validateDate('2024-13-01', 'date')).toThrow(ValidationError);
    });

    it('should reject future dates by default', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      expect(() => validateDate(futureDate.toISOString(), 'date')).toThrow(ValidationError);
    });

    it('should accept future dates when allowed', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const date = validateDate(futureDate.toISOString(), 'date', true);
      expect(date).toBeInstanceOf(Date);
    });
  });

  describe('validateDiscordId', () => {
    it('should accept valid Discord IDs', () => {
      expect(validateDiscordId('12345678901234567', 'discord_id')).toBe('12345678901234567');
      expect(validateDiscordId('123456789012345678', 'discord_id')).toBe('123456789012345678');
      expect(validateDiscordId('1234567890123456789', 'discord_id')).toBe('1234567890123456789');
    });

    it('should reject invalid Discord IDs', () => {
      expect(() => validateDiscordId('1234567890123456', 'discord_id')).toThrow(ValidationError); // too short
      expect(() => validateDiscordId('12345678901234567890', 'discord_id')).toThrow(ValidationError); // too long
      expect(() => validateDiscordId('abc123456789012345', 'discord_id')).toThrow(ValidationError); // non-numeric
    });
  });

  describe('validateUrl', () => {
    it('should accept valid URLs', () => {
      expect(validateUrl('https://example.com', 'url')).toBe('https://example.com');
      expect(validateUrl('http://example.com/path', 'url')).toBe('http://example.com/path');
      expect(validateUrl('https://example.com:8080/path?query=value', 'url')).toBe('https://example.com:8080/path?query=value');
    });

    it('should reject invalid URLs', () => {
      expect(() => validateUrl('not-a-url', 'url')).toThrow(ValidationError);
      expect(() => validateUrl('example.com', 'url')).toThrow(ValidationError); // missing protocol
    });
  });

  describe('validateCurrency', () => {
    it('should accept valid currency codes', () => {
      expect(validateCurrency('USD', 'currency')).toBe('USD');
      expect(validateCurrency('EUR', 'currency')).toBe('EUR');
      expect(validateCurrency('GBP', 'currency')).toBe('GBP');
    });

    it('should reject invalid currency codes', () => {
      expect(() => validateCurrency('usd', 'currency')).toThrow(ValidationError); // lowercase
      expect(() => validateCurrency('US', 'currency')).toThrow(ValidationError); // too short
      expect(() => validateCurrency('USDD', 'currency')).toThrow(ValidationError); // too long
      expect(() => validateCurrency('123', 'currency')).toThrow(ValidationError); // numbers
    });
  });

  describe('validateNumeric', () => {
    it('should accept valid numbers', () => {
      expect(validateNumeric(5, 'price')).toBe(5);
      expect(validateNumeric(5.5, 'price')).toBe(5.5);
      expect(validateNumeric('5', 'price')).toBe(5);
      expect(validateNumeric('5.5', 'price')).toBe(5.5);
    });

    it('should return null when value is null/undefined and allowNull is true', () => {
      expect(validateNumeric(null, 'price', undefined, undefined, true)).toBeNull();
      expect(validateNumeric(undefined, 'price', undefined, undefined, true)).toBeNull();
    });

    it('should reject null/undefined when allowNull is false', () => {
      expect(() => validateNumeric(null, 'price', undefined, undefined, false)).toThrow(ValidationError);
      expect(() => validateNumeric(undefined, 'price', undefined, undefined, false)).toThrow(ValidationError);
    });

    it('should enforce min/max values', () => {
      expect(validateNumeric(5, 'price', 0, 10)).toBe(5);
      expect(() => validateNumeric(-1, 'price', 0, 10)).toThrow(ValidationError);
      expect(() => validateNumeric(11, 'price', 0, 10)).toThrow(ValidationError);
    });

    it('should reject invalid numeric strings', () => {
      expect(() => validateNumeric('not-a-number', 'price')).toThrow(ValidationError);
    });
  });

  describe('validateTransactionId', () => {
    it('should accept valid transaction IDs', () => {
      expect(validateTransactionId('abc123', 'transaction_id')).toBe('abc123');
      expect(validateTransactionId('ABC-123_456', 'transaction_id')).toBe('ABC-123_456');
      expect(validateTransactionId('1234567890', 'transaction_id')).toBe('1234567890');
    });

    it('should return null for null/undefined/empty', () => {
      expect(validateTransactionId(null, 'transaction_id')).toBeNull();
      expect(validateTransactionId(undefined, 'transaction_id')).toBeNull();
      expect(validateTransactionId('', 'transaction_id')).toBeNull();
      expect(validateTransactionId('   ', 'transaction_id')).toBeNull();
    });

    it('should reject transaction IDs that are too long', () => {
      const longId = 'a'.repeat(256);
      expect(() => validateTransactionId(longId, 'transaction_id')).toThrow(ValidationError);
    });

    it('should reject transaction IDs with invalid characters', () => {
      expect(() => validateTransactionId('abc 123', 'transaction_id')).toThrow(ValidationError); // space
      expect(() => validateTransactionId('abc@123', 'transaction_id')).toThrow(ValidationError); // @ symbol
      expect(() => validateTransactionId('abc.123', 'transaction_id')).toThrow(ValidationError); // period
    });
  });

  describe('validateName', () => {
    it('should accept valid names', () => {
      expect(validateName('John Doe', 'name')).toBe('John Doe');
      expect(validateName("O'Brien", 'name')).toBe("O'Brien");
      expect(validateName('Jean-Pierre', 'name')).toBe('Jean-Pierre');
      expect(validateName('José María', 'name')).toBe('José María'); // unicode
    });

    it('should return null for null/undefined/empty', () => {
      expect(validateName(null, 'name')).toBeNull();
      expect(validateName(undefined, 'name')).toBeNull();
      expect(validateName('', 'name')).toBeNull();
      expect(validateName('   ', 'name')).toBeNull();
    });

    it('should reject names that are too long', () => {
      const longName = 'a'.repeat(256);
      expect(() => validateName(longName, 'name')).toThrow(ValidationError);
    });

    it('should reject names with invalid characters', () => {
      expect(() => validateName('John123', 'name')).toThrow(ValidationError); // numbers
      expect(() => validateName('John@Doe', 'name')).toThrow(ValidationError); // @ symbol
      expect(() => validateName('John_Doe', 'name')).toThrow(ValidationError); // underscore
    });
  });
});

