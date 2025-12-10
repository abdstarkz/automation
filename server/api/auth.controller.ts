// auth.controller.ts
import { Request, Response } from 'express';
import prisma from '../prisma.js';
import { hashPassword, verifyPassword, generateJWT } from '../utils/encryption.js';
import { User } from '@prisma/client';

/**
 * Register a new user
 * POST /api/auth/register
 */
export async function register(req: Request, res: Response) {
  try {
    console.log('Register function started');
    const { email, password, fullName } = req.body;

    // Validate input
    if (!email || !password) {
      console.log('Validation failed: Email and password required');
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.log('Validation failed: Invalid email format');
      return res.status(400).json({ message: 'Invalid email format' });
    }

    // Validate password length
    if (password.length < 6) {
      console.log('Validation failed: Password too short');
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    // Check if user already exists
    console.log('Checking for existing user...');
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      console.log('Validation failed: User already exists');
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    // Hash password
    console.log('Hashing password...');
    const passwordHash = await hashPassword(password);

    // Create user
    console.log('Creating user...');
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        fullName: fullName || null,
        emailVerified: false,
        isActive: true,
      },
    });
    console.log('User created:', user.id);

    // Create default preferences for the user
    console.log('Creating user preferences...');
    await prisma.userPreference.create({
      data: {
        userId: user.id,
        theme: 'light',
        language: 'en',
        timezone: 'UTC',
        notificationSettings: {
          email: true,
          workflowExecutions: true,
          healthAlerts: true,
        },
        uiPreferences: {
          compactMode: false,
          showTips: true,
        },
      },
    });
    console.log('User preferences created');

    // Generate JWT token
    console.log('Generating JWT token...');
    const token = generateJWT({
      userId: user.id,
      email: user.email,
    });
    console.log('JWT token generated');

    // Create session
    console.log('Creating session...');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

    await prisma.session.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    });
    console.log('Session created');

    // Return user data (excluding password)
    const { passwordHash: _, ...userData } = user;

    console.log('Registration successful, returning response');
    return res.status(201).json({
      message: 'User created successfully',
      token,
      user: userData,
    });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ 
      message: 'Registration failed. Please try again.',
      error: process.env.NODE_ENV === 'development' ? String(error) : undefined,
    });
  }
}

/**
 * Login user
 * POST /api/auth/login
 */
export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user || user.passwordHash === null) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Verify password
    const isPasswordValid = await verifyPassword(password, user.passwordHash);

    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Check if user account is active
    if (!user.isActive) {
      return res.status(403).json({ message: 'Your account has been deactivated. Please contact support.' });
    }

    // Generate new JWT token
    const token = generateJWT({
      userId: user.id,
      email: user.email,
    });

    // Create new session
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

    await prisma.session.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    });

    // Return user data (excluding password)
    const { passwordHash: _, ...userData } = user;

    return res.json({
      message: 'Login successful',
      token,
      user: userData,
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ 
      message: 'Login failed. Please try again.',
      error: process.env.NODE_ENV === 'development' ? String(error) : undefined,
    });
  }
}

/**
 * Get current user
 * GET /api/auth/me
 */
export async function getMe(req: Request, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const user = req.user as User;

    // Fetch user with related data
    const fetchedUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        fullName: true,
        avatarUrl: true,
        isActive: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
        preferences: {
          select: {
            theme: true,
            language: true,
            timezone: true,
            notificationSettings: true,
            uiPreferences: true,
          },
        },
      },
    });

    if (!fetchedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.json({ user: fetchedUser });
  } catch (error) {
    console.error('Get me error:', error);
    return res.status(500).json({ 
      message: 'Failed to fetch user data',
      error: process.env.NODE_ENV === 'development' ? String(error) : undefined,
    });
  }
}

/**
 * Update user profile
 * PUT /api/auth/profile
 */
export async function updateProfile(req: Request, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const user = req.user as User;

    const { fullName, avatarUrl } = req.body;

    // Validate input
    if (fullName !== undefined && typeof fullName !== 'string') {
      return res.status(400).json({ message: 'Invalid fullName format' });
    }

    if (avatarUrl !== undefined && typeof avatarUrl !== 'string') {
      return res.status(400).json({ message: 'Invalid avatarUrl format' });
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(fullName !== undefined && { fullName }),
        ...(avatarUrl !== undefined && { avatarUrl }),
        updatedAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        avatarUrl: true,
        isActive: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.json({
      message: 'Profile updated successfully',
      user: updatedUser,
    });
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({ 
      message: 'Failed to update profile',
      error: process.env.NODE_ENV === 'development' ? String(error) : undefined,
    });
  }
}

/**
 * Logout user (invalidate session)
 * POST /api/auth/logout
 */
export async function logout(req: Request, res: Response) {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      // Delete the session
      await prisma.session.deleteMany({
        where: { token },
      });
    }

    return res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({ 
      message: 'Logout failed',
      error: process.env.NODE_ENV === 'development' ? String(error) : undefined,
    });
  }
}

/**
 * Change password
 * PUT /api/auth/password
 */
export async function changePassword(req: Request, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const user = req.user as User;

    const { currentPassword, newPassword } = req.body;

    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    // Get user with password hash
    const userWithPassword = await prisma.user.findUnique({
      where: { id: user.id },
    });

    if (!userWithPassword || userWithPassword.passwordHash === null) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify current password
    const isPasswordValid = await verifyPassword(currentPassword, userWithPassword.passwordHash);

    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);

    // Update password
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newPasswordHash,
        updatedAt: new Date(),
      },
    });

    // Invalidate all existing sessions except current
    const authHeader = req.headers['authorization'];
    const currentToken = authHeader && authHeader.split(' ')[1];

    await prisma.session.deleteMany({
      where: {
        userId: user.id,
        token: { not: currentToken || '' },
      },
    });

    return res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({ 
      message: 'Failed to change password',
      error: process.env.NODE_ENV === 'development' ? String(error) : undefined,
    });
  }
}
