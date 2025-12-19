import { useState, useEffect, useCallback } from "react";
import { validatePrompt, BrandRules, ValidationResult } from "@/lib/brandValidation";

interface UseBrandValidationOptions {
  debounceMs?: number;
  enabled?: boolean;
}

export function useBrandValidation(
  prompt: string,
  brandRules: BrandRules | null,
  options: UseBrandValidationOptions = {}
) {
  const { debounceMs = 300, enabled = true } = options;
  
  const [result, setResult] = useState<ValidationResult>({
    isValid: true,
    score: 100,
    issues: []
  });
  const [isValidating, setIsValidating] = useState(false);

  const validate = useCallback(() => {
    if (!enabled || !brandRules || !prompt.trim()) {
      setResult({ isValid: true, score: 100, issues: [] });
      return;
    }

    setIsValidating(true);
    
    // Simulate slight delay for UX
    const validationResult = validatePrompt(prompt, brandRules);
    setResult(validationResult);
    setIsValidating(false);
  }, [prompt, brandRules, enabled]);

  useEffect(() => {
    if (!enabled) return;

    const timer = setTimeout(validate, debounceMs);
    return () => clearTimeout(timer);
  }, [prompt, validate, debounceMs, enabled]);

  return {
    ...result,
    isValidating,
    validate
  };
}
