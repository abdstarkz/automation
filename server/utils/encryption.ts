import crypto from 'crypto';
import bcryptjs from 'bcryptjs';
import * as jwtModule from 'jsonwebtoken';
const jwt = (jwtModule as any).default || jwtModule;

// Environment variables with fallbacks
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-key-change-in-production-32ch';
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

// Ensure encryption key is exactly 32 bytes for AES-256
const KEY = Buffer.from(ENCRYPTION_KEY, 'utf8').slice(0, 32);

// ============================================
// SYMMETRIC ENCRYPTION (for API keys, tokens)
// ============================================

/**
 * Encrypt sensitive data like API keys and OAuth tokens
 * @param text - Plain text to encrypt
 * @returns Encrypted string in format: iv:encryptedData
 */
export function encrypt(text: string): string {
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt sensitive data
 * @param encryptedText - Encrypted string in format: iv:encryptedData
 * @returns Decrypted plain text
 */
export function decrypt(encryptedText: string): string {
  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 2) {
      throw new Error('Invalid encrypted data format');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
}

// ============================================
// PASSWORD HASHING (for user authentication)
// ============================================

/**
 * Hash a password using bcrypt
 * @param password - Plain text password
 * @returns Hashed password
 */
export async function hashPassword(password: string): Promise<string> {
  try {
    const salt = await bcryptjs.genSalt(12);
    return await bcryptjs.hash(password, salt);
  } catch (error) {
    console.error('Password hashing error:', error);
    throw new Error('Failed to hash password');
  }
}

/**
 * Verify a password against its hash
 * @param password - Plain text password
 * @param hash - Hashed password to compare against
 * @returns True if password matches
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await bcryptjs.compare(password, hash);
  } catch (error) {
    console.error('Password verification error:', error);
    return false;
  }
}

// ============================================
// JWT TOKEN MANAGEMENT
// ============================================

export interface JWTPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
  [key: string]: any;
}

/**
 * Generate a JWT token
 * @param payload - Data to encode in the token
 * @returns Signed JWT token
 */
export function generateJWT(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  try {
    return jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
      algorithm: 'HS256',
    });
  } catch (error) {
    console.error('JWT generation error:', error);
    throw new Error('Failed to generate token');
  }
}

/**
 * Verify and decode a JWT token
 * @param token - JWT token to verify
 * @returns Decoded payload or null if invalid
 */
export function verifyJWT(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256'],
    });
    return decoded as JWTPayload;
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      console.log('Token expired');
    } else if (error.name === 'JsonWebTokenError') {
      console.log('Invalid token');
    } else {
      console.error('JWT verification error:', error);
    }
    return null;
  }
}

/**
 * Decode JWT without verification (for debugging)
 * @param token - JWT token to decode
 * @returns Decoded payload or null
 */
export function decodeJWT(token: string): JWTPayload | null {
  try {
    const decoded = jwt.decode(token);
    return decoded as JWTPayload;
  } catch (error) {
    console.error('JWT decode error:', error);
    return null;
  }
}

// ============================================
// RANDOM TOKEN GENERATION
// ============================================

/**
 * Generate a secure random token
 * @param length - Length in bytes (default 32)
 * @returns Hex string of random bytes
 */
export function generateToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Generate a secure random string (alphanumeric)
 * @param length - Desired length of string
 * @returns Random alphanumeric string
 */
export function generateRandomString(length: number = 16): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const bytes = crypto.randomBytes(length);
  
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  
  return result;
}

/**
 * Generate a UUID v4
 * @returns UUID string
 */
export function generateUUID(): string {
  return crypto.randomUUID();
}

// ============================================
// API KEY MANAGEMENT
// ============================================

/**
 * Encrypt an API credential for storage
 * @param credential - Credential object to encrypt
 * @returns Encrypted JSON string
 */
export function encryptCredential(credential: Record<string, any>): string {
  const jsonString = JSON.stringify(credential);
  return encrypt(jsonString);
}

/**
 * Decrypt an API credential from storage
 * @param encryptedCredential - Encrypted credential string
 * @returns Decrypted credential object
 */
export function decryptCredential(encryptedCredential: string): Record<string, any> {
  const decrypted = decrypt(encryptedCredential);
  return JSON.parse(decrypted);
}

// ============================================
// HASHING (for checksums, non-sensitive data)
// ============================================

/**
 * Create SHA-256 hash
 * @param data - Data to hash
 * @returns Hex string of hash
 */
export function sha256(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Create MD5 hash (for checksums only, NOT for security)
 * @param data - Data to hash
 * @returns Hex string of hash
 */
export function md5(data: string): string {
  return crypto.createHash('md5').update(data).digest('hex');
}

// ============================================
// VALIDATION HELPERS
// ============================================

/**
 * Validate password strength
 * @param password - Password to validate
 * @returns Object with validation result and message
 */
export function validatePasswordStrength(password: string): {
  isValid: boolean;
  message: string;
  score: number;
} {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  let score = 0;
  if (password.length >= minLength) score++;
  if (hasUpperCase) score++;
  if (hasLowerCase) score++;
  if (hasNumbers) score++;
  if (hasSpecialChar) score++;

  if (password.length < minLength) {
    return {
      isValid: false,
      message: `Password must be at least ${minLength} characters long`,
      score: 0,
    };
  }

  if (score < 3) {
    return {
      isValid: false,
      message: 'Password must contain uppercase, lowercase, and numbers',
      score,
    };
  }

  return {
    isValid: true,
    message: score === 5 ? 'Strong password' : 'Good password',
    score,
  };
}

/**
 * Sanitize user input to prevent XSS
 * @param input - User input string
 * @returns Sanitized string
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

// Export default object with all functions
export default {
  encrypt,
  decrypt,
  hashPassword,
  verifyPassword,
  generateJWT,
  verifyJWT,
  decodeJWT,
  generateToken,
  generateRandomString,
  generateUUID,
  encryptCredential,
  decryptCredential,
  sha256,
  md5,
  validatePasswordStrength,
  sanitizeInput,
};