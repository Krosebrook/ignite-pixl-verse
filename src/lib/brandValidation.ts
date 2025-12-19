export interface ColorRules {
  required?: string[];
  forbidden?: string[];
  tolerance?: number;
}

export interface ToneRules {
  allowed?: string[];
  forbidden_words?: string[];
  brand_voice?: string;
}

export interface BrandRules {
  colors?: ColorRules;
  tone?: ToneRules;
}

export interface ValidationIssue {
  type: "error" | "warning";
  category: "color" | "tone" | "content";
  message: string;
  suggestion?: string;
}

export interface ValidationResult {
  isValid: boolean;
  score: number;
  issues: ValidationIssue[];
}

const COLOR_REGEX = /#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})\b/g;
const COLOR_WORDS = [
  "red", "blue", "green", "yellow", "orange", "purple", "pink", "black", "white",
  "cyan", "magenta", "gold", "silver", "navy", "teal", "coral", "violet"
];

export function validateColors(prompt: string, rules: ColorRules): ValidationResult {
  const issues: ValidationIssue[] = [];
  let score = 100;

  // Check for hex colors in prompt
  const hexColors = prompt.match(COLOR_REGEX) || [];
  
  // Check for color words
  const lowerPrompt = prompt.toLowerCase();
  const mentionedColorWords = COLOR_WORDS.filter(color => lowerPrompt.includes(color));

  // Check forbidden colors
  if (rules.forbidden) {
    for (const forbidden of rules.forbidden) {
      const forbiddenLower = forbidden.toLowerCase();
      if (hexColors.some(c => c.toLowerCase() === forbiddenLower) || 
          mentionedColorWords.includes(forbiddenLower)) {
        issues.push({
          type: "error",
          category: "color",
          message: `Forbidden color "${forbidden}" detected`,
          suggestion: `Remove or replace with a brand-approved color`
        });
        score -= 20;
      }
    }
  }

  // Check if required colors are mentioned (warning only)
  if (rules.required && rules.required.length > 0) {
    const hasRequiredColor = rules.required.some(required => {
      const reqLower = required.toLowerCase();
      return hexColors.some(c => c.toLowerCase() === reqLower) ||
             mentionedColorWords.some(w => reqLower.includes(w));
    });

    if (!hasRequiredColor && hexColors.length === 0 && mentionedColorWords.length === 0) {
      issues.push({
        type: "warning",
        category: "color",
        message: "Consider mentioning brand colors for consistency",
        suggestion: `Brand colors: ${rules.required.join(", ")}`
      });
      score -= 5;
    }
  }

  return {
    isValid: !issues.some(i => i.type === "error"),
    score: Math.max(0, score),
    issues
  };
}

export function validateTone(prompt: string, rules: ToneRules): ValidationResult {
  const issues: ValidationIssue[] = [];
  let score = 100;
  const lowerPrompt = prompt.toLowerCase();

  // Check forbidden words
  if (rules.forbidden_words) {
    for (const word of rules.forbidden_words) {
      if (lowerPrompt.includes(word.toLowerCase())) {
        issues.push({
          type: "error",
          category: "tone",
          message: `Forbidden word "${word}" detected`,
          suggestion: `Remove or replace with brand-appropriate language`
        });
        score -= 15;
      }
    }
  }

  // Check for overly casual language if brand voice is formal
  if (rules.brand_voice === "professional" || rules.brand_voice === "formal") {
    const casualIndicators = ["lol", "omg", "btw", "gonna", "wanna", "kinda", "sorta"];
    const foundCasual = casualIndicators.filter(c => lowerPrompt.includes(c));
    if (foundCasual.length > 0) {
      issues.push({
        type: "warning",
        category: "tone",
        message: `Casual language detected: ${foundCasual.join(", ")}`,
        suggestion: `Consider more ${rules.brand_voice} alternatives`
      });
      score -= 10;
    }
  }

  // Check prompt length for quality
  if (prompt.length < 20) {
    issues.push({
      type: "warning",
      category: "content",
      message: "Prompt is quite short",
      suggestion: "Add more detail for better results"
    });
    score -= 5;
  }

  return {
    isValid: !issues.some(i => i.type === "error"),
    score: Math.max(0, score),
    issues
  };
}

export function calculateComplianceScore(results: ValidationResult[]): number {
  if (results.length === 0) return 100;
  const totalScore = results.reduce((acc, r) => acc + r.score, 0);
  return Math.round(totalScore / results.length);
}

export function validatePrompt(prompt: string, brandRules: BrandRules): ValidationResult {
  const colorResult = brandRules.colors ? validateColors(prompt, brandRules.colors) : { isValid: true, score: 100, issues: [] };
  const toneResult = brandRules.tone ? validateTone(prompt, brandRules.tone) : { isValid: true, score: 100, issues: [] };

  const allIssues = [...colorResult.issues, ...toneResult.issues];
  const overallScore = calculateComplianceScore([colorResult, toneResult]);

  return {
    isValid: colorResult.isValid && toneResult.isValid,
    score: overallScore,
    issues: allIssues
  };
}
