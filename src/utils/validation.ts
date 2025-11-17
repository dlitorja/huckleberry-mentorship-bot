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

