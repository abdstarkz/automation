// auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { verifyJWT } from '../utils/encryption.js';       
import { prisma } from '../prisma.js';

export async function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  const decoded = verifyJWT(token);

  if (!decoded) {
    return res.status(403).json({ message: 'Invalid or expired token' });
  }

  const user = await prisma.user.findUnique({ where: { id: decoded.userId } });

  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  req.user = user;

  next();
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    const decoded = verifyJWT(token);
    if (decoded) {
      const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
      if (user) {
        req.user = user;
      }
    }
  }

  next();
}