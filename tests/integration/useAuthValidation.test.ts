/**
 * Integration tests for useAuthValidation hook
 * Tests validation logic for authentication forms
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { 
  useAuthValidation, 
  isValidEmail, 
  isValidPassword,
  emailSchema,
  passwordSchema,
  signUpSchema,
  signInSchema,
  magicLinkSchema,
  forgotPasswordSchema,
} from '@/hooks/useAuthValidation';

describe('useAuthValidation Hook', () => {
  describe('validateEmail', () => {
    it('should accept valid email addresses', () => {
      const { result } = renderHook(() => useAuthValidation());
      
      const validEmails = [
        'test@example.com',
        'user.name@domain.org',
        'user+tag@example.co.uk',
        'name123@test.io',
      ];
      
      validEmails.forEach(email => {
        const validation = result.current.validateEmail(email);
        expect(validation.isValid).toBe(true);
        expect(validation.error).toBeNull();
      });
    });
    
    it('should reject invalid email addresses', () => {
      const { result } = renderHook(() => useAuthValidation());
      
      const invalidEmails = [
        '',
        'notanemail',
        '@nodomain.com',
        'no@domain',
        'spaces in@email.com',
        'missing@.com',
      ];
      
      invalidEmails.forEach(email => {
        const validation = result.current.validateEmail(email);
        expect(validation.isValid).toBe(false);
        expect(validation.error).not.toBeNull();
      });
    });
    
    it('should reject emails longer than 255 characters', () => {
      const { result } = renderHook(() => useAuthValidation());
      
      const longEmail = 'a'.repeat(250) + '@test.com';
      const validation = result.current.validateEmail(longEmail);
      
      expect(validation.isValid).toBe(false);
      expect(validation.error).toContain('255');
    });
  });
  
  describe('validatePassword', () => {
    it('should accept valid passwords', () => {
      const { result } = renderHook(() => useAuthValidation());
      
      const validPasswords = [
        'password123',
        'MySecureP@ss',
        'abcdefgh',
        '12345678',
      ];
      
      validPasswords.forEach(password => {
        const validation = result.current.validatePassword(password);
        expect(validation.isValid).toBe(true);
        expect(validation.error).toBeNull();
      });
    });
    
    it('should reject passwords shorter than 8 characters', () => {
      const { result } = renderHook(() => useAuthValidation());
      
      const shortPasswords = ['', '1234567', 'abc'];
      
      shortPasswords.forEach(password => {
        const validation = result.current.validatePassword(password);
        expect(validation.isValid).toBe(false);
        expect(validation.error).toContain('8 characters');
      });
    });
    
    it('should reject passwords longer than 72 characters', () => {
      const { result } = renderHook(() => useAuthValidation());
      
      const longPassword = 'a'.repeat(73);
      const validation = result.current.validatePassword(longPassword);
      
      expect(validation.isValid).toBe(false);
      expect(validation.error).toContain('72');
    });
  });
  
  describe('validateSignIn', () => {
    it('should accept valid sign in credentials', () => {
      const { result } = renderHook(() => useAuthValidation());
      
      const validation = result.current.validateSignIn('test@example.com', 'password123');
      
      expect(validation.isValid).toBe(true);
      expect(validation.error).toBeNull();
    });
    
    it('should reject invalid email in sign in', () => {
      const { result } = renderHook(() => useAuthValidation());
      
      const validation = result.current.validateSignIn('notanemail', 'password123');
      
      expect(validation.isValid).toBe(false);
      expect(validation.error).not.toBeNull();
    });
    
    it('should reject invalid password in sign in', () => {
      const { result } = renderHook(() => useAuthValidation());
      
      const validation = result.current.validateSignIn('test@example.com', 'short');
      
      expect(validation.isValid).toBe(false);
      expect(validation.error).not.toBeNull();
    });
  });
  
  describe('validateSignUp', () => {
    it('should accept valid sign up data', () => {
      const { result } = renderHook(() => useAuthValidation());
      
      const validation = result.current.validateSignUp(
        'test@example.com',
        'password123',
        'password123'
      );
      
      expect(validation.isValid).toBe(true);
      expect(validation.error).toBeNull();
    });
    
    it('should reject mismatched passwords', () => {
      const { result } = renderHook(() => useAuthValidation());
      
      const validation = result.current.validateSignUp(
        'test@example.com',
        'password123',
        'differentpassword'
      );
      
      expect(validation.isValid).toBe(false);
      expect(validation.error).toContain('match');
    });
    
    it('should reject invalid email in sign up', () => {
      const { result } = renderHook(() => useAuthValidation());
      
      const validation = result.current.validateSignUp(
        'notanemail',
        'password123',
        'password123'
      );
      
      expect(validation.isValid).toBe(false);
    });
  });
  
  describe('validateMagicLink', () => {
    it('should accept valid email for magic link', () => {
      const { result } = renderHook(() => useAuthValidation());
      
      const validation = result.current.validateMagicLink('test@example.com');
      
      expect(validation.isValid).toBe(true);
      expect(validation.error).toBeNull();
    });
    
    it('should reject invalid email for magic link', () => {
      const { result } = renderHook(() => useAuthValidation());
      
      const validation = result.current.validateMagicLink('notanemail');
      
      expect(validation.isValid).toBe(false);
      expect(validation.error).not.toBeNull();
    });
  });
  
  describe('validateForgotPassword', () => {
    it('should accept valid email for forgot password', () => {
      const { result } = renderHook(() => useAuthValidation());
      
      const validation = result.current.validateForgotPassword('test@example.com');
      
      expect(validation.isValid).toBe(true);
      expect(validation.error).toBeNull();
    });
    
    it('should reject invalid email for forgot password', () => {
      const { result } = renderHook(() => useAuthValidation());
      
      const validation = result.current.validateForgotPassword('invalid');
      
      expect(validation.isValid).toBe(false);
      expect(validation.error).not.toBeNull();
    });
  });
});

describe('Standalone Validation Functions', () => {
  describe('isValidEmail', () => {
    it('should return true for valid emails', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.org')).toBe(true);
    });
    
    it('should return false for invalid emails', () => {
      expect(isValidEmail('')).toBe(false);
      expect(isValidEmail('notanemail')).toBe(false);
      expect(isValidEmail('@nodomain.com')).toBe(false);
    });
  });
  
  describe('isValidPassword', () => {
    it('should return valid for passwords with 8+ characters', () => {
      const result = isValidPassword('password123');
      expect(result.valid).toBe(true);
      expect(result.error).toBeNull();
    });
    
    it('should return invalid for short passwords', () => {
      const result = isValidPassword('short');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('8 characters');
    });
    
    it('should return invalid for very long passwords', () => {
      const result = isValidPassword('a'.repeat(73));
      expect(result.valid).toBe(false);
      expect(result.error).toContain('72');
    });
  });
});

describe('Zod Schemas', () => {
  describe('emailSchema', () => {
    it('should parse valid emails', () => {
      expect(emailSchema.safeParse('test@example.com').success).toBe(true);
    });
    
    it('should reject invalid emails', () => {
      expect(emailSchema.safeParse('invalid').success).toBe(false);
    });
  });
  
  describe('passwordSchema', () => {
    it('should parse valid passwords', () => {
      expect(passwordSchema.safeParse('validpassword').success).toBe(true);
    });
    
    it('should reject short passwords', () => {
      expect(passwordSchema.safeParse('short').success).toBe(false);
    });
  });
  
  describe('signUpSchema', () => {
    it('should validate complete sign up data', () => {
      const result = signUpSchema.safeParse({
        email: 'test@example.com',
        password: 'password123',
        confirmPassword: 'password123',
      });
      expect(result.success).toBe(true);
    });
    
    it('should reject mismatched passwords', () => {
      const result = signUpSchema.safeParse({
        email: 'test@example.com',
        password: 'password123',
        confirmPassword: 'different',
      });
      expect(result.success).toBe(false);
    });
  });
  
  describe('signInSchema', () => {
    it('should validate sign in data', () => {
      const result = signInSchema.safeParse({
        email: 'test@example.com',
        password: 'password123',
      });
      expect(result.success).toBe(true);
    });
  });
  
  describe('magicLinkSchema', () => {
    it('should validate magic link data', () => {
      const result = magicLinkSchema.safeParse({ email: 'test@example.com' });
      expect(result.success).toBe(true);
    });
  });
  
  describe('forgotPasswordSchema', () => {
    it('should validate forgot password data', () => {
      const result = forgotPasswordSchema.safeParse({ email: 'test@example.com' });
      expect(result.success).toBe(true);
    });
  });
});
