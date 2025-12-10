// server/routes/integration-tests.routes.ts
import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { integrationTester } from '../services/auth/integration-tester.service.js';

const router = Router();

// ============================================
// TEST ALL INTEGRATIONS
// ============================================

router.get('/test/all', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const results = await integrationTester.testAllIntegrations(user.id);

    res.json({
      success: true,
      results,
    });
  } catch (error: any) {
    console.error('Test all integrations error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test integrations',
      message: error.message,
    });
  }
});

// ============================================
// TEST GOOGLE SHEETS
// ============================================

router.post('/test/google/sheets', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const { spreadsheetId } = req.body;

    if (!spreadsheetId) {
      return res.status(400).json({
        success: false,
        error: 'Spreadsheet ID is required',
      });
    }

    const result = await integrationTester.testGoogleSheets(user.id, spreadsheetId);

    res.json(result);
  } catch (error: any) {
    console.error('Test Google Sheets error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test Google Sheets',
      message: error.message,
    });
  }
});

// ============================================
// TEST GMAIL
// ============================================

router.post('/test/google/gmail', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const { testEmail } = req.body;

    const result = await integrationTester.testGmail(user.id, testEmail);

    res.json(result);
  } catch (error: any) {
    console.error('Test Gmail error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test Gmail',
      message: error.message,
    });
  }
});

// ============================================
// TEST GOOGLE CALENDAR
// ============================================

router.get('/test/google/calendar', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const result = await integrationTester.testGoogleCalendar(user.id);

    res.json(result);
  } catch (error: any) {
    console.error('Test Google Calendar error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test Google Calendar',
      message: error.message,
    });
  }
});

// ============================================
// TEST SLACK
// ============================================

router.post('/test/slack', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const { channelId } = req.body;

    const result = await integrationTester.testSlack(user.id, channelId);

    res.json(result);
  } catch (error: any) {
    console.error('Test Slack error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test Slack',
      message: error.message,
    });
  }
});

// ============================================
// TEST NOTION
// ============================================

router.get('/test/notion', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const result = await integrationTester.testNotion(user.id);

    res.json(result);
  } catch (error: any) {
    console.error('Test Notion error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test Notion',
      message: error.message,
    });
  }
});

// ============================================
// QUICK CONNECTION CHECK
// ============================================

router.get('/check/:type', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const { type } = req.params;

    let result;

    switch (type) {
      case 'google':
        result = await integrationTester.testGmail(user.id);
        break;
      case 'slack':
        result = await integrationTester.testSlack(user.id);
        break;
      case 'notion':
        result = await integrationTester.testNotion(user.id);
        break;
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid integration type',
        });
    }

    res.json(result);
  } catch (error: any) {
    console.error(`Check ${req.params.type} error:`, error);
    res.status(500).json({
      success: false,
      error: `Failed to check ${req.params.type} integration`,
      message: error.message,
    });
  }
});

export default router;