// src/utils/validation.ts
// Input validation utilities

import { ValidationError } from './errors.js';

/**
 * Validate that a value is a positive integer
 */
export function validatePositiveInteger(
  value: unknown,
  fieldName: string,
  min: number = 1,
  max?: number
): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new ValidationError(`${fieldName} must be an integer`);
  }
  
  if (value < min) {
    throw new ValidationError(`${fieldName} must be at least ${min}`);
  }
  
  if (max !== undefined && value > max) {
    throw new ValidationError(`${fieldName} must be at most ${max}`);
  }
  
  return value;
}

/**
 * Validate that a value is a non-empty string
 */
export function validateNonEmptyString(
  value: unknown,
  fieldName: string,
  maxLength?: number
): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ValidationError(`${fieldName} must be a non-empty string`);
  }
  
  if (maxLength !== undefined && value.length > maxLength) {
    throw new ValidationError(`${fieldName} must be at most ${maxLength} characters`);
  }
  
  return value.trim();
}

/**
 * Validate email format
 */
export function validateEmail(value: unknown, fieldName: string = 'email'): string {
  const email = validateNonEmptyString(value, fieldName);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(email)) {
    throw new ValidationError(`${fieldName} must be a valid email address`);
  }
  
  return email.toLowerCase();
}

/**
 * Validate date string
 */
export function validateDate(
  value: unknown,
  fieldName: string = 'date',
  allowFuture: boolean = false
): Date {
  if (typeof value !== 'string') {
    throw new ValidationError(`${fieldName} must be a string`);
  }
  
  const date = new Date(value);
  
  if (isNaN(date.getTime())) {
    throw new ValidationError(`${fieldName} must be a valid date`);
  }
  
  if (!allowFuture && date > new Date()) {
    throw new ValidationError(`${fieldName} cannot be in the future`);
  }
  
  return date;
}

/**
 * Validate Discord user ID format
 */
export function validateDiscordId(value: unknown, fieldName: string = 'discord_id'): string {
  const id = validateNonEmptyString(value, fieldName);
  
  // Discord IDs are 17-19 digit numbers
  if (!/^\d{17,19}$/.test(id)) {
    throw new ValidationError(`${fieldName} must be a valid Discord ID`);
  }
  
  return id;
}

/**
 * Validate URL format
 */
export function validateUrl(value: unknown, fieldName: string = 'url'): string {
  const url = validateNonEmptyString(value, fieldName);
  
  try {
    new URL(url);
    return url;
  } catch {
    throw new ValidationError(`${fieldName} must be a valid URL`);
  }
}

/**
 * Validate and sanitize currency code (ISO 4217 format)
 */
export function validateCurrency(value: unknown, fieldName: string = 'currency'): string {
  const currency = validateNonEmptyString(value, fieldName);
  
  // Basic validation: 3 uppercase letters
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new ValidationError(`${fieldName} must be a valid 3-letter currency code (e.g., USD, EUR)`);
  }
  
  return currency;
}

/**
 * Validate numeric value (for prices, amounts, etc.)
 */
export function validateNumeric(
  value: unknown,
  fieldName: string,
  min?: number,
  max?: number,
  allowNull: boolean = true
): number | null {
  if (value === null || value === undefined) {
    if (allowNull) return null;
    throw new ValidationError(`${fieldName} is required`);
  }
  
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  
  if (isNaN(num)) {
    throw new ValidationError(`${fieldName} must be a valid number`);
  }
  
  if (min !== undefined && num < min) {
    throw new ValidationError(`${fieldName} must be at least ${min}`);
  }
  
  if (max !== undefined && num > max) {
    throw new ValidationError(`${fieldName} must be at most ${max}`);
  }
  
  return num;
}

/**
 * Validate transaction ID (alphanumeric string, max 255 chars)
 */
export function validateTransactionId(value: unknown, fieldName: string = 'transaction_id'): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  
  const id = String(value).trim();
  
  if (id.length === 0) {
    return null;
  }
  
  if (id.length > 255) {
    throw new ValidationError(`${fieldName} must be at most 255 characters`);
  }
  
  // Allow alphanumeric, hyphens, and underscores
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    throw new ValidationError(`${fieldName} contains invalid characters`);
  }
  
  return id;
}

/**
 * Validate and sanitize name (person name)
 */
export function validateName(value: unknown, fieldName: string = 'name', maxLength: number = 255): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  
  const name = String(value).trim();
  
  if (name.length === 0) {
    return null;
  }
  
  if (name.length > maxLength) {
    throw new ValidationError(`${fieldName} must be at most ${maxLength} characters`);
  }
  
  // Allow letters, spaces, hyphens, apostrophes, and common unicode characters
  // This is more permissive than strict validation but prevents injection
  if (!/^[\p{L}\s'-]+$/u.test(name)) {
    throw new ValidationError(`${fieldName} contains invalid characters`);
  }
  
  return name;
}

