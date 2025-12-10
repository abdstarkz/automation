import { PassportStatic } from 'passport';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const GoogleStrategy = require('passport-google-oauth20').Strategy;
import { prisma } from '../prisma.js';
import { User } from '@prisma/client';
// import { Profile } from 'passport-google-oauth20'; // Removed unused import

export function setupPassport(passport: PassportStatic) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    callbackURL: process.env.GOOGLE_CALLBACK_URL!,
  },
  async (_accessToken: string, _refreshToken: string | null, profile: { id: string, emails: { value: string }[], displayName: string }, done: (error: any, user?: any) => void) => {
    try {
      let user = await prisma.user.findUnique({ where: { googleId: profile.id } });

      if (!user) {
        user = await prisma.user.create({
          data: {
            googleId: profile.id,
            email: profile.emails![0].value,
            fullName: profile.displayName,
            // Add other fields as necessary, e.g., emailVerified, isActive
          },
        });
      }
      if (user) {
        done(null, user as User);
      } else {
        done(new Error('User not found'), undefined);
      }
    } catch (error) {
      done(error as Error, undefined);
    }
  }
  ));

  passport.serializeUser((user: any, done: (err: Error | null, id?: string) => void) => {
    if (user) {
      done(null, user.id);
    } else {
      done(new Error('User not found for serialization'), undefined);
    }
  });

  passport.deserializeUser(async (id: string, done: (err: Error | null, user?: Express.User) => void) => {
    try {
      const user = await prisma.user.findUnique({ where: { id } });
      if (user) {
        done(null, user);
      }
      else {
        done(new Error('User not found'), undefined);
      }
    } catch (error) {
      done(error as Error, undefined);
    }
  });
}