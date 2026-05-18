import type { KeyType } from './types.js';

/**
 * Normalize an email address: lowercase, trim.
 */
export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Normalize a phone number: strip spaces, dashes, parentheses.
 * Preserve leading + if present.
 */
export function normalizePhone(value: string): string {
  const trimmed = value.trim();
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/[\s\-().]/g, '');
  return hasPlus && !digits.startsWith('+') ? `+${digits}` : digits;
}

/**
 * Normalize a generic ID: uppercase, trim, collapse internal whitespace.
 */
export function normalizeGenericId(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, ' ');
}

/**
 * Dispatch to the correct normalizer based on key type.
 */
export function normalizeKeyValue(value: string, keyType: KeyType): string {
  switch (keyType) {
    case 'email':
      return normalizeEmail(value);
    case 'phone':
      return normalizePhone(value);
    case 'product_id':
    case 'user_id':
    case 'customer_id':
    case 'employee_id':
    case 'license_number':
    case 'registration_id':
    case 'invoice_number':
    case 'order_id':
    case 'serial_number':
    case 'batch_number':
    case 'asset_id':
    case 'generic_id':
      return normalizeGenericId(value);
    case 'unknown':
      return value.trim();
    default:
      return value.trim();
  }
}
