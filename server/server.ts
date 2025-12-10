// server/server.ts - Updated with AI Health routes
import express from 'express';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const passport = require('passport');
const session = require('express-session');
import { PrismaClient } from '@prisma/client';

// Import routes
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';
import { setupPassport } from './auth/passport.js';
import { authenticateToken } from './middleware/auth.middleware.js';

// VERIFY all route imports exist:
import authRouter from './routes/auth.routes.js';
import workflowRouter from './routes/workflow.routes.js';
import healthRouter from './routes/health.routes.js';
import fitbitRouter from './routes/fitbit.routes.js';
import personalTimeRouter from './routes/personalTime.routes.js';
import healthAIRouter from './routes/healthAI.routes.js';
import integrationRouter from './routes/integrations.routes.js';
import oauthRouter from './routes/oauth.routes.js';
import scheduleRouter from './routes/schedule.routes.js';
import userApiKeysRouter from './routes/user-api-keys.routes.js';
import webhookRouter from './routes/webhook.routes.js';
import aiRouter from './routes/ai.routes.js';
import executionsRouter from './routes/executions.routes.js';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

// Middleware
const allowedOrigins = [
  'http://localhost:5173',
  'https://yourdomain.com'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
app.use(express.json());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);

// Session Middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'supersecret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24,
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  },
}));

// Passport Middleware
app.use(passport.initialize());
app.use(passport.session());
setupPassport(passport);

// Routes
app.use('/api/auth', authRouter);
app.use('/api/workflows', workflowRouter);
app.use('/api/health', healthRouter);
app.use('/api/health/fitbit', fitbitRouter);
app.use('/api/personal-time', personalTimeRouter);
app.use('/api/health-ai', healthAIRouter);
app.use('/api/integrations', authenticateToken, integrationRouter);
app.use('/api/oauth', oauthRouter);
app.use('/api/schedules', authenticateToken, scheduleRouter);
app.use('/api/user/api-keys', authenticateToken, userApiKeysRouter);
app.use('/api/webhooks', express.raw({ type: '*/' }), webhookRouter);
app.use('/api/ai', aiRouter);
app.use('/api/executions', authenticateToken, executionsRouter);

// ADD error handlers LAST (after all routes)
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`✓ Server running on port ${PORT}`);
  console.log(`✓ Health AI routes enabled at /api/health-ai`);
});

export { prisma };