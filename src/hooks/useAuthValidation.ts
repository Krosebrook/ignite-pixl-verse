/**
 * Auth Form Validation Hook
 * Centralized validation logic for authentication forms
 */

import { useCallback } from 'react';
import { z } from 'zod';

// Validation schemas
export const emailSchema = z.string()
  .email('Please enter a valid email address')
  .max(255, 'Email must be less than 255 characters');

export const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be less than 72 characters');

export const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export const signInSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const magicLinkSchema = z.object({
  email: emailSchema,
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

interface ValidationResult {
  isValid: boolean;
  error: string | null;
}

interface UseAuthValidationReturn {
  validateEmail: (email: string) => ValidationResult;
  validatePassword: (password: string) => ValidationResult;
  validateSignIn: (email: string, password: string) => ValidationResult;
  validateSignUp: (email: string, password: string, confirmPassword: string) => ValidationResult;
  validateMagicLink: (email: string) => ValidationResult;
  validateForgotPassword: (email: string) => ValidationResult;
}

export function useAuthValidation(): UseAuthValidationReturn {
  const validateEmail = useCallback((email: string): ValidationResult => {
    const result = emailSchema.safeParse(email);
    return {
      isValid: result.success,
      error: result.success ? null : result.error.errors[0]?.message || 'Invalid email',
    };
  }, []);

  const validatePassword = useCallback((password: string): ValidationResult => {
    const result = passwordSchema.safeParse(password);
    return {
      isValid: result.success,
      error: result.success ? null : result.error.errors[0]?.message || 'Invalid password',
    };
  }, []);

  const validateSignIn = useCallback((email: string, password: string): ValidationResult => {
    const result = signInSchema.safeParse({ email, password });
    return {
      isValid: result.success,
      error: result.success ? null : result.error.errors[0]?.message || 'Invalid credentials',
    };
  }, []);

  const validateSignUp = useCallback((
    email: string, 
    password: string, 
    confirmPassword: string
  ): ValidationResult => {
    const result = signUpSchema.safeParse({ email, password, confirmPassword });
    return {
      isValid: result.success,
      error: result.success ? null : result.error.errors[0]?.message || 'Invalid form data',
    };
  }, []);

  const validateMagicLink = useCallback((email: string): ValidationResult => {
    const result = magicLinkSchema.safeParse({ email });
    return {
      isValid: result.success,
      error: result.success ? null : result.error.errors[0]?.message || 'Invalid email',
    };
  }, []);

  const validateForgotPassword = useCallback((email: string): ValidationResult => {
    const result = forgotPasswordSchema.safeParse({ email });
    return {
      isValid: result.success,
      error: result.success ? null : result.error.errors[0]?.message || 'Invalid email',
    };
  }, []);

  return {
    validateEmail,
    validatePassword,
    validateSignIn,
    validateSignUp,
    validateMagicLink,
    validateForgotPassword,
  };
}

/**
 * Simple validation functions for direct use
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isValidPassword(password: string): { valid: boolean; error: string | null } {
  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters' };
  }
  if (password.length > 72) {
    return { valid: false, error: 'Password must be less than 72 characters' };
  }
  return { valid: true, error: null };
}
