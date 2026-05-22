/**
 * Validation Engine for Rule-Based Pattern Strengthening
 * 
 * Provides comprehensive validation utilities for:
 * - Type checking and constraint validation
 * - Input sanitization and boundary checking
 * - Pattern matching with confidence scoring
 * - Success/failure criteria evaluation
 */

import { z, ZodSchema } from 'zod';

// ── Core Types ──────────────────────────────────────────────────────

export interface ValidationResult<T = unknown> {
  isValid: boolean;
  value?: T;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  confidence: number; // 0.0 - 1.0
  metadata?: Record<string, unknown>;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  severity: 'critical' | 'error';
}

export interface ValidationWarning {
  field: string;
  message: string;
  code: string;
  suggestion?: string;
}

export interface ValidationRule<T = unknown> {
  name: string;
  validate: (value: unknown) => ValidationResult<T>;
  priority: number; // Higher priority runs first
  required: boolean;
}

export interface ConfidenceFactors {
  exactMatch?: number; // 1.0 for exact match
  patternMatch?: number; // 0.7-0.9 for pattern match
  fuzzyMatch?: number; // 0.5-0.7 for fuzzy match
  contextMatch?: number; // 0.3-0.5 for context-based match
  penalties?: number[]; // Deductions for warnings/issues
}

// ── Validation Engine ───────────────────────────────────────────────

export class ValidationEngine {
  private rules: Map<string, ValidationRule[]> = new Map();

  /**
   * Register a validation rule for a specific field/type
   */
  registerRule(fieldName: string, rule: ValidationRule): void {
    const existing = this.rules.get(fieldName) ?? [];
    existing.push(rule);
    // Sort by priority (descending)
    existing.sort((a, b) => b.priority - a.priority);
    this.rules.set(fieldName, existing);
  }

  /**
   * Validate a value against registered rules
   */
  validate<T>(fieldName: string, value: unknown): ValidationResult<T> {
    const rules = this.rules.get(fieldName);
    if (!rules || rules.length === 0) {
      return {
        isValid: true,
        value: value as T,
        errors: [],
        warnings: [],
        confidence: 0.5, // Unknown field, medium confidence
      };
    }

    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    let validatedValue: T | undefined;
    let maxConfidence = 0;

    for (const rule of rules) {
      const result = rule.validate(value);
      
      if (result.errors.length > 0) {
        errors.push(...result.errors);
        if (rule.required) {
          // Required rule failed, stop validation
          return {
            isValid: false,
            errors,
            warnings,
            confidence: 0,
          };
        }
      }

      if (result.warnings.length > 0) {
        warnings.push(...result.warnings);
      }

      if (result.isValid && result.confidence > maxConfidence) {
        maxConfidence = result.confidence;
        validatedValue = result.value as T;
      }
    }

    return {
      isValid: errors.length === 0,
      value: validatedValue,
      errors,
      warnings,
      confidence: maxConfidence,
    };
  }

  /**
   * Validate multiple fields in a batch
   */
  validateBatch(fields: Record<string, unknown>): Record<string, ValidationResult> {
    const results: Record<string, ValidationResult> = {};
    for (const [fieldName, value] of Object.entries(fields)) {
      results[fieldName] = this.validate(fieldName, value);
    }
    return results;
  }

  /**
   * Clear all registered rules
   */
  clear(): void {
    this.rules.clear();
  }
}

// ── Built-in Validators ─────────────────────────────────────────────

/**
 * Create a Zod schema validator with confidence scoring
 */
export function createZodValidator<T>(
  schema: ZodSchema<T>,
  name: string,
  priority = 100,
  required = true,
): ValidationRule<T> {
  return {
    name,
    priority,
    required,
    validate: (value: unknown): ValidationResult<T> => {
      const result = schema.safeParse(value);
      
      if (result.success) {
        return {
          isValid: true,
          value: result.data,
          errors: [],
          warnings: [],
          confidence: 1.0, // Exact schema match
        };
      }

      const errors: ValidationError[] = result.error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code,
        severity: 'error' as const,
      }));

      return {
        isValid: false,
        errors,
        warnings: [],
        confidence: 0,
      };
    },
  };
}

/**
 * String length validator with confidence scoring
 */
export function createLengthValidator(
  minLength: number,
  maxLength: number,
  name = 'length-validator',
  priority = 90,
): ValidationRule<string> {
  return {
    name,
    priority,
    required: false,
    validate: (value: unknown): ValidationResult<string> => {
      if (typeof value !== 'string') {
        return {
          isValid: false,
          errors: [{
            field: 'value',
            message: 'Value must be a string',
            code: 'INVALID_TYPE',
            severity: 'error',
          }],
          warnings: [],
          confidence: 0,
        };
      }

      const length = value.length;
      const errors: ValidationError[] = [];
      const warnings: ValidationWarning[] = [];

      if (length < minLength) {
        errors.push({
          field: 'value',
          message: `String length ${length} is below minimum ${minLength}`,
          code: 'LENGTH_TOO_SHORT',
          severity: 'error',
        });
      }

      if (length > maxLength) {
        errors.push({
          field: 'value',
          message: `String length ${length} exceeds maximum ${maxLength}`,
          code: 'LENGTH_TOO_LONG',
          severity: 'error',
        });
      }

      // Warn if close to boundaries
      if (length < minLength * 1.2) {
        warnings.push({
          field: 'value',
          message: `String length ${length} is close to minimum`,
          code: 'LENGTH_NEAR_MIN',
          suggestion: `Consider adding more content (min: ${minLength})`,
        });
      }

      if (length > maxLength * 0.9) {
        warnings.push({
          field: 'value',
          message: `String length ${length} is close to maximum`,
          code: 'LENGTH_NEAR_MAX',
          suggestion: `Consider reducing content (max: ${maxLength})`,
        });
      }

      // Calculate confidence based on how well it fits the range
      let confidence = 1.0;
      if (length < minLength || length > maxLength) {
        confidence = 0;
      } else {
        const optimalLength = (minLength + maxLength) / 2;
        const deviation = Math.abs(length - optimalLength) / (maxLength - minLength);
        confidence = Math.max(0.7, 1.0 - deviation);
      }

      return {
        isValid: errors.length === 0,
        value,
        errors,
        warnings,
        confidence,
      };
    },
  };
}

/**
 * Pattern matching validator with confidence scoring
 */
export function createPatternValidator(
  patterns: Array<{ regex: RegExp; confidence: number; name: string }>,
  name = 'pattern-validator',
  priority = 80,
): ValidationRule<string> {
  return {
    name,
    priority,
    required: false,
    validate: (value: unknown): ValidationResult<string> => {
      if (typeof value !== 'string') {
        return {
          isValid: false,
          errors: [{
            field: 'value',
            message: 'Value must be a string',
            code: 'INVALID_TYPE',
            severity: 'error',
          }],
          warnings: [],
          confidence: 0,
        };
      }

      let bestMatch: { confidence: number; name: string } | null = null;

      for (const pattern of patterns) {
        if (pattern.regex.test(value)) {
          if (!bestMatch || pattern.confidence > bestMatch.confidence) {
            bestMatch = { confidence: pattern.confidence, name: pattern.name };
          }
        }
      }

      if (!bestMatch) {
        return {
          isValid: false,
          errors: [{
            field: 'value',
            message: 'Value does not match any known patterns',
            code: 'NO_PATTERN_MATCH',
            severity: 'error',
          }],
          warnings: [],
          confidence: 0,
        };
      }

      return {
        isValid: true,
        value,
        errors: [],
        warnings: [],
        confidence: bestMatch.confidence,
        metadata: { matchedPattern: bestMatch.name },
      };
    },
  };
}

/**
 * Enum validator with confidence scoring
 */
export function createEnumValidator<T extends string>(
  allowedValues: readonly T[],
  name = 'enum-validator',
  priority = 95,
): ValidationRule<T> {
  const valueSet = new Set(allowedValues);

  return {
    name,
    priority,
    required: true,
    validate: (value: unknown): ValidationResult<T> => {
      if (typeof value !== 'string') {
        return {
          isValid: false,
          errors: [{
            field: 'value',
            message: 'Value must be a string',
            code: 'INVALID_TYPE',
            severity: 'error',
          }],
          warnings: [],
          confidence: 0,
        };
      }

      if (valueSet.has(value as T)) {
        return {
          isValid: true,
          value: value as T,
          errors: [],
          warnings: [],
          confidence: 1.0, // Exact match
        };
      }

      // Try case-insensitive match
      const lowerValue = value.toLowerCase();
      const caseInsensitiveMatch = allowedValues.find(
        v => v.toLowerCase() === lowerValue
      );

      if (caseInsensitiveMatch) {
        return {
          isValid: true,
          value: caseInsensitiveMatch,
          errors: [],
          warnings: [{
            field: 'value',
            message: `Value '${value}' was normalized to '${caseInsensitiveMatch}'`,
            code: 'CASE_NORMALIZED',
            suggestion: `Use '${caseInsensitiveMatch}' for exact match`,
          }],
          confidence: 0.9, // Case-insensitive match
        };
      }

      return {
        isValid: false,
        errors: [{
          field: 'value',
          message: `Value '${value}' is not in allowed values: ${allowedValues.join(', ')}`,
          code: 'INVALID_ENUM_VALUE',
          severity: 'error',
        }],
        warnings: [],
        confidence: 0,
      };
    },
  };
}

/**
 * Range validator for numeric values
 */
export function createRangeValidator(
  min: number,
  max: number,
  name = 'range-validator',
  priority = 85,
): ValidationRule<number> {
  return {
    name,
    priority,
    required: false,
    validate: (value: unknown): ValidationResult<number> => {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        return {
          isValid: false,
          errors: [{
            field: 'value',
            message: 'Value must be a finite number',
            code: 'INVALID_TYPE',
            severity: 'error',
          }],
          warnings: [],
          confidence: 0,
        };
      }

      const errors: ValidationError[] = [];
      const warnings: ValidationWarning[] = [];

      if (value < min) {
        errors.push({
          field: 'value',
          message: `Value ${value} is below minimum ${min}`,
          code: 'VALUE_TOO_LOW',
          severity: 'error',
        });
      }

      if (value > max) {
        errors.push({
          field: 'value',
          message: `Value ${value} exceeds maximum ${max}`,
          code: 'VALUE_TOO_HIGH',
          severity: 'error',
        });
      }

      // Calculate confidence based on position in range
      let confidence = 1.0;
      if (value < min || value > max) {
        confidence = 0;
      } else {
        const optimal = (min + max) / 2;
        const deviation = Math.abs(value - optimal) / (max - min);
        confidence = Math.max(0.7, 1.0 - deviation);
      }

      return {
        isValid: errors.length === 0,
        value,
        errors,
        warnings,
        confidence,
      };
    },
  };
}

/**
 * Calculate overall confidence from multiple factors
 */
export function calculateConfidence(factors: ConfidenceFactors): number {
  const scores: number[] = [];

  if (factors.exactMatch !== undefined) scores.push(factors.exactMatch);
  if (factors.patternMatch !== undefined) scores.push(factors.patternMatch);
  if (factors.fuzzyMatch !== undefined) scores.push(factors.fuzzyMatch);
  if (factors.contextMatch !== undefined) scores.push(factors.contextMatch);

  if (scores.length === 0) return 0.5; // Default medium confidence

  // Take the maximum score from all factors
  let confidence = Math.max(...scores);

  // Apply penalties
  if (factors.penalties && factors.penalties.length > 0) {
    const totalPenalty = factors.penalties.reduce((sum, p) => sum + p, 0);
    confidence = Math.max(0, confidence - totalPenalty);
  }

  return Math.min(1.0, Math.max(0, confidence));
}

/**
 * Sanitize string input by removing potentially harmful content
 */
export function sanitizeString(input: string): string {
  return input
    .trim()
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .replace(/<script[^>]*>.*?<\/script>/gi, '') // Remove script tags
    .replace(/<[^>]+>/g, '') // Remove HTML tags
    .slice(0, 10000); // Cap at 10k chars
}

/**
 * Sanitize object by removing potentially harmful content
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const sanitized: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value);
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitizeObject(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item =>
        typeof item === 'string' ? sanitizeString(item) :
        typeof item === 'object' && item !== null ? sanitizeObject(item as Record<string, unknown>) :
        item
      );
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized as T;
}
