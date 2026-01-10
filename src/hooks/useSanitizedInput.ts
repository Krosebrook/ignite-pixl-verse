import { useState, useCallback } from 'react';
import { sanitizeForStorage, sanitizeHtml, sanitizeUrl } from '@/lib/sanitize';

interface UseSanitizedInputOptions {
  maxLength?: number;
  allowHtml?: boolean;
  sanitizeUrls?: boolean;
}

/**
 * Hook for managing sanitized form inputs
 * Automatically sanitizes content before state updates
 */
export function useSanitizedInput(
  initialValue: string = '',
  options: UseSanitizedInputOptions = {}
) {
  const { maxLength = 10000, allowHtml = false, sanitizeUrls = false } = options;
  const [value, setValue] = useState(initialValue);
  const [rawValue, setRawValue] = useState(initialValue);

  const handleChange = useCallback((
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const input = e.target.value;
    setRawValue(input);
    
    // Apply appropriate sanitization
    let sanitized: string;
    if (sanitizeUrls) {
      sanitized = sanitizeUrl(input);
    } else if (allowHtml) {
      sanitized = sanitizeHtml(input);
    } else {
      sanitized = sanitizeForStorage(input, maxLength);
    }
    
    setValue(sanitized);
  }, [maxLength, allowHtml, sanitizeUrls]);

  const setDirectValue = useCallback((newValue: string) => {
    setRawValue(newValue);
    
    let sanitized: string;
    if (sanitizeUrls) {
      sanitized = sanitizeUrl(newValue);
    } else if (allowHtml) {
      sanitized = sanitizeHtml(newValue);
    } else {
      sanitized = sanitizeForStorage(newValue, maxLength);
    }
    
    setValue(sanitized);
  }, [maxLength, allowHtml, sanitizeUrls]);

  const reset = useCallback(() => {
    setValue(initialValue);
    setRawValue(initialValue);
  }, [initialValue]);

  return {
    value,           // Sanitized value (use for database storage)
    rawValue,        // Original value (use for display in input)
    onChange: handleChange,
    setValue: setDirectValue,
    reset,
  };
}

/**
 * Hook for managing sanitized object state
 * Useful for forms with multiple fields
 */
export function useSanitizedForm<T extends Record<string, string>>(
  initialValues: T,
  options: UseSanitizedInputOptions = {}
) {
  const { maxLength = 10000 } = options;
  const [values, setValues] = useState<T>(initialValues);
  const [rawValues, setRawValues] = useState<T>(initialValues);

  const handleChange = useCallback((field: keyof T) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const input = e.target.value;
    
    setRawValues(prev => ({ ...prev, [field]: input }));
    setValues(prev => ({ 
      ...prev, 
      [field]: sanitizeForStorage(input, maxLength) 
    }));
  }, [maxLength]);

  const setField = useCallback((field: keyof T, value: string) => {
    setRawValues(prev => ({ ...prev, [field]: value }));
    setValues(prev => ({ 
      ...prev, 
      [field]: sanitizeForStorage(value, maxLength) 
    }));
  }, [maxLength]);

  const setAllValues = useCallback((newValues: T) => {
    setRawValues(newValues);
    
    const sanitized = Object.fromEntries(
      Object.entries(newValues).map(([key, val]) => [
        key,
        sanitizeForStorage(val, maxLength)
      ])
    ) as T;
    
    setValues(sanitized);
  }, [maxLength]);

  const reset = useCallback(() => {
    setValues(initialValues);
    setRawValues(initialValues);
  }, [initialValues]);

  return {
    values,           // Sanitized values (use for database storage)
    rawValues,        // Original values (use for display in inputs)
    handleChange,
    setField,
    setAllValues,
    reset,
  };
}

export default useSanitizedInput;
