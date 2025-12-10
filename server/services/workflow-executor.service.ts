// server/services/workflow-executor.service.ts

import { PrismaClient } from '@prisma/client';
import {
  webhookValidationService,
  tokenRefreshService,
  encrypt,
  decrypt,
} from './auth/oauth.service.js';
import { CircuitBreaker, CircuitBreakerState } from '../lib/CircuitBreaker.js';
import { gmail_v1 } from 'googleapis';
import type { Node, Edge } from 'reactflow';

const prisma = new PrismaClient();

interface ExecutionContext {
  variables: Map<string, any>;
  outputs: Map<string, any>;
  workflowId: string;
  executionId: string;
  userId: string;
  metadata: {
    startTime: Date;
    checkpoints: Map<string, Date>;
    errors: Array<{ nodeId: string; error: string; timestamp: Date }>;
    loopStack: Array<{ nodeId: string; iteration: number; maxIterations: number }>;
  };
}

export class WorkflowExecutor {
  private context: ExecutionContext;
  private nodeExecutors: Map<string, Function>;
  private discordWebhookRateLimits: Map<string, number> = new Map();
  private readonly DISCORD_WEBHOOK_RATE_LIMIT_INTERVAL = 2500; // 2.5 seconds per webhook
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();

  constructor() {
    this.context = {
      variables: new Map(),
      outputs: new Map(),
      workflowId: '',
      executionId: '',
      userId: '',
      metadata: {
        startTime: new Date(),
        checkpoints: new Map(),
        errors: [],
        loopStack: [],
      },
    };
    this.nodeExecutors = new Map();
    this.registerNodeExecutors();
  }

  // ============================================
  // NODE REGISTRATION
  // ============================================

  private registerNodeExecutors() {
    // ===== TRIGGERS =====
    this.nodeExecutors.set('trigger_manual', this.executeTriggerManual.bind(this));
    this.nodeExecutors.set('trigger_schedule', this.executeTriggerSchedule.bind(this));
    this.nodeExecutors.set('trigger_webhook', this.executeTriggerWebhook.bind(this));
    this.nodeExecutors.set('trigger_health', this.executeTriggerHealth.bind(this));
    this.nodeExecutors.set('trigger_form', this.executeTriggerForm.bind(this));
    this.nodeExecutors.set('trigger_chat', this.executeTriggerChat.bind(this));
    this.nodeExecutors.set('trigger_error', this.executeTriggerError.bind(this));

    // ===== GOOGLE WORKSPACE =====
    this.nodeExecutors.set('google_sheets_read', this.executeGoogleSheetsRead.bind(this));
    this.nodeExecutors.set('google_sheets_write', this.executeGoogleSheetsWrite.bind(this));
    this.nodeExecutors.set('google_gmail_send', this.executeGmailSend.bind(this));
    this.nodeExecutors.set('google_gmail_read', this.executeGmailRead.bind(this));
    this.nodeExecutors.set('google_calendar_create', this.executeCalendarCreate.bind(this));
    this.nodeExecutors.set('google_calendar_list', this.executeCalendarList.bind(this));
    this.nodeExecutors.set('google_drive_upload', this.executeGoogleDriveUpload.bind(this));
    this.nodeExecutors.set('youtube_upload', this.executeYouTubeUpload.bind(this));

    // ===== SOCIAL MEDIA =====
    this.nodeExecutors.set('meta_post', this.executeMetaPost.bind(this));
    this.nodeExecutors.set('twitter_post', this.executeTwitterPost.bind(this));
    this.nodeExecutors.set('linkedin_post', this.executeLinkedInPost.bind(this));
    this.nodeExecutors.set('instagram_post', this.executeInstagramPost.bind(this));

    // ===== MESSAGING =====
    this.nodeExecutors.set('discord_send', this.executeDiscordSend.bind(this));
    this.nodeExecutors.set('telegram_send', this.executeTelegramSend.bind(this));
    this.nodeExecutors.set('slack_send', this.executeSlackSend.bind(this));
    this.nodeExecutors.set('whatsapp_send', this.executeWhatsAppSend.bind(this));

    // ===== DEVELOPMENT TOOLS =====
    this.nodeExecutors.set('github_create_issue', this.executeGitHubCreateIssue.bind(this));
    this.nodeExecutors.set('github_create_pr', this.executeGitHubCreatePR.bind(this));
    this.nodeExecutors.set('jira_create_ticket', this.executeJiraCreateTicket.bind(this));

    // ===== E-COMMERCE =====
    this.nodeExecutors.set('amazon_search', this.executeAmazonSearch.bind(this));
    this.nodeExecutors.set('flipkart_search', this.executeFlipkartSearch.bind(this));

    // ===== CLOUD SERVICES =====
    this.nodeExecutors.set(
      'spotify_create_playlist',
      this.executeSpotifyCreatePlaylist.bind(this)
    );

    // ===== AI MODELS =====
    this.nodeExecutors.set('ai_chatgpt', this.executeChatGPT.bind(this));
    this.nodeExecutors.set('ai_claude', this.executeClaude.bind(this));
    this.nodeExecutors.set('ai_gemini', this.executeGemini.bind(this));

    // ===== LOGIC & CONTROL FLOW =====
    this.nodeExecutors.set('if_else', this.executeIfElse.bind(this));
    this.nodeExecutors.set('switch', this.executeSwitch.bind(this));
    this.nodeExecutors.set('loop', this.executeLoop.bind(this));
    this.nodeExecutors.set('wait', this.executeWait.bind(this));
    this.nodeExecutors.set('filter', this.executeFilter.bind(this));
    this.nodeExecutors.set('delay', this.executeDelay.bind(this));
    this.nodeExecutors.set('code_merge', this.executeCodeMerge.bind(this));
    this.nodeExecutors.set('code_split', this.executeCodeSplit.bind(this));
    this.nodeExecutors.set('sub_workflow', this.executeSubWorkflow.bind(this));
    this.nodeExecutors.set('error_handler', this.executeErrorHandler.bind(this));

    // ===== DATA OPERATIONS =====
    this.nodeExecutors.set('http_request', this.executeHttpRequest.bind(this));
    this.nodeExecutors.set('json_parse', this.executeJsonParse.bind(this));
    this.nodeExecutors.set('data_transform', this.executeDataTransform.bind(this));

    // ===== NOTION =====
    this.nodeExecutors.set('notion_create_page', this.executeNotionCreatePage.bind(this));
    this.nodeExecutors.set('notion_update_db', this.executeNotionUpdateDB.bind(this));
  }

  // ============================================
  // WORKFLOW EXECUTION
  // ============================================

  async executeWorkflow(
    workflowId: string,
    nodes: Node[],
    edges: Edge[],
    userId: string,
    triggerData?: any
  ) {
    this.context.workflowId = workflowId;
    this.context.userId = userId;
    this.context.metadata.startTime = new Date();

    const execution = await prisma.workflowExecution.create({
      data: {
        workflowId,
        userId,
        status: 'running',
        startedAt: new Date(),
        executionData: triggerData || {},
        errorMessage: null,
      },
    });

    this.context.executionId = execution.id;

    try {
      await this.logExecution('system', 'info', 'Workflow execution started', {
        workflowId,
        nodeCount: nodes.length,
        edgeCount: edges.length,
        triggerData,
      });

      const graph = this.buildExecutionGraph(nodes, edges);
      const startNode = nodes.find((n) => n.data?.type?.includes('trigger'));

      if (!startNode) {
        throw new Error('No trigger node found in workflow');
      }

      await this.validateWorkflowStructure(nodes, edges);

      await this.executeNode(startNode, graph, nodes, triggerData);

      const executionTime = Date.now() - this.context.metadata.startTime.getTime();
      const checkpointCount = this.context.metadata.checkpoints.size;

      await prisma.workflowExecution.update({
        where: { id: execution.id },
        data: {
          status: 'completed',
          completedAt: new Date(),
          executionData: {
            ...Object.fromEntries(this.context.outputs),
            _metadata: {
              startedAt: this.context.metadata.startTime,
              completedAt: new Date(),
              durationMs: executionTime,
            },
          },
        },
      });

      await this.logExecution(
        'system',
        'info',
        `Workflow completed successfully in ${executionTime}ms`,
        {
          nodesExecuted: checkpointCount,
          totalTime: executionTime,
        }
      );

      return {
        success: true,
        executionId: execution.id,
        executionTime,
        nodesExecuted: checkpointCount,
      };
    } catch (error: any) {
      await prisma.workflowExecution.update({
        where: { id: execution.id },
        data: {
          status: 'failed',
          completedAt: new Date(),
          errorMessage: error.message || 'Unknown error occurred',
          executionData: {
            errors: this.context.metadata.errors,
            lastSuccessfulNode: Array.from(this.context.metadata.checkpoints.keys()).pop(),
          },
        },
      });

      await this.logExecution(
        'system',
        'error',
        `Workflow execution failed: ${error.message}`,
        {
          errorStack: error.stack,
          failedAt: this.context.metadata.errors[
            this.context.metadata.errors.length - 1
          ],
        }
      );

      throw error;
    }
  }

  private async validateWorkflowStructure(nodes: Node[], edges: Edge[]): Promise<void> {
    const triggerNodes = nodes.filter((n) => n.data?.type?.includes('trigger'));
    if (triggerNodes.length === 0) {
      throw new Error('Workflow must have at least one trigger node');
    }
    if (triggerNodes.length > 1) {
      await this.logExecution('system', 'warn', 'Multiple trigger nodes detected');
    }

    const connectedNodeIds = new Set<string>();
    edges.forEach((edge) => {
      connectedNodeIds.add(edge.source);
      connectedNodeIds.add(edge.target);
    });

    const orphanedNodes = nodes.filter(
      (n) => !n.data?.type?.includes('trigger') && !connectedNodeIds.has(n.id)
    );

    if (orphanedNodes.length > 0) {
      await this.logExecution(
        'system',
        'warn',
        `Found ${orphanedNodes.length} orphaned nodes`,
        {
          orphanedNodeIds: orphanedNodes.map((n) => n.id),
        }
      );
    }

    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const graph = this.buildExecutionGraph(nodes, edges);

    const hasCycle = (nodeId: string): boolean => {
      visited.add(nodeId);
      recursionStack.add(nodeId);

      const children = graph.get(nodeId) || [];
      for (const childId of children) {
        if (!visited.has(childId)) {
          if (hasCycle(childId)) return true;
        } else if (recursionStack.has(childId)) {
          return true;
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    for (const node of nodes) {
      if (!visited.has(node.id) && hasCycle(node.id)) {
        throw new Error('Workflow contains circular dependency');
      }
    }
  }

  private buildExecutionGraph(nodes: Node[], edges: Edge[]): Map<string, string[]> {
    const graph = new Map<string, string[]>();
    nodes.forEach((node) => graph.set(node.id, []));
    edges.forEach((edge) => {
      const children = graph.get(edge.source) || [];
      children.push(edge.target);
      graph.set(edge.source, children);
    });
    return graph;
  }

  private async executeNode(
    node: Node,
    graph: Map<string, string[]>,
    allNodes: Node[],
    previousOutput?: any
  ) {
    const nodeType = node.data?.type;
    const executor = this.nodeExecutors.get(nodeType);

    this.context.metadata.checkpoints.set(node.id, new Date());

    if (!executor) {
      await this.logExecution(node.id, 'warn', `No executor found for node type: ${nodeType}`);
      return;
    }

    await this.logExecution(
      node.id,
      'info',
      `Executing node: ${node.data?.label || nodeType}`
    );

    try {
      await this.validateNodeConfig(node);

      const result = await executor(node.data?.config || {}, previousOutput);
      this.context.outputs.set(node.id, result);

      await this.logExecution(node.id, 'info', 'Node executed successfully', {
        outputSize: JSON.stringify(result).length,
      });

      const children = graph.get(node.id) || [];

      if (nodeType === 'if_else' && result.conditionMet !== undefined) {
        const targetBranch = result.conditionMet ? 'true' : 'false';
        const targetChild = allNodes.find(
          (n) => children.includes(n.id) && n.data?.branch === targetBranch
        );
        if (targetChild) {
          await this.executeNode(targetChild, graph, allNodes, result);
        }
      } else if (nodeType === 'switch' && result.matched) {
        const targetChild = allNodes.find(
          (n) => children.includes(n.id) && n.data?.case === result.case
        );
        if (targetChild) {
          await this.executeNode(targetChild, graph, allNodes, result);
        }
      } else if (nodeType === 'loop' && result.success) {
        await this.handleLoopExecution(node, children, graph, allNodes, result);
      } else {
        for (const childId of children) {
          const childNode = allNodes.find((n) => n.id === childId);
          if (childNode) {
            await this.executeNode(childNode, graph, allNodes, result);
          }
        }
      }
    } catch (error: any) {
      this.context.metadata.errors.push({
        nodeId: node.id,
        error: error.message,
        timestamp: new Date(),
      });

      await this.logExecution(node.id, 'error', `Node execution failed: ${error.message}`, {
        errorStack: error.stack,
      });

      const errorHandlerNode = allNodes.find(
        (n) => n.data?.type === 'error_handler' && graph.get(node.id)?.includes(n.id)
      );

      if (errorHandlerNode) {
        await this.executeNode(errorHandlerNode, graph, allNodes, {
          error: error.message,
          failedNode: node.id,
        });
      } else {
        throw error;
      }
    }
  }

  private async handleLoopExecution(
    loopNode: Node,
    children: string[],
    graph: Map<string, string[]>,
    allNodes: Node[],
    loopResult: any
  ) {
    const MAX_LOOP_DEPTH = 5;

    if (this.context.metadata.loopStack.length >= MAX_LOOP_DEPTH) {
      throw new Error(`Maximum loop depth of ${MAX_LOOP_DEPTH} exceeded for node ${loopNode.id}`);
    }

    const iterations = loopResult.iterations || 1;

    this.context.metadata.loopStack.push({
      nodeId: loopNode.id,
      iteration: 0,
      maxIterations: iterations,
    });

    for (let i = 0; i < iterations; i++) {
      this.context.metadata.loopStack[this.context.metadata.loopStack.length - 1].iteration =
        i + 1;

      await this.logExecution(loopNode.id, 'info', `Loop iteration ${i + 1} of ${iterations}`);

      for (const childId of children) {
        const childNode = allNodes.find((n) => n.id === childId);
        if (childNode) {
          await this.executeNode(childNode, graph, allNodes, {
            ...loopResult,
            currentIteration: i + 1,
            isLastIteration: i === iterations - 1,
          });
        }
      }
    }

    this.context.metadata.loopStack.pop();
  }

  private async validateNodeConfig(node: Node): Promise<void> {
    const config = node.data?.config || {};
    const nodeType = node.data?.type;

    const validationRules: Record<string, (cfg: any) => void> = {
      google_sheets_read: (cfg) => {
        if (!cfg.spreadsheetId) throw new Error('Spreadsheet ID is required');
        if (!cfg.range) throw new Error('Range is required');
      },
      google_gmail_send: (cfg) => {
        if (!cfg.to) throw new Error('Recipient email is required');
        if (!cfg.subject) throw new Error('Subject is required');
        if (!cfg.body) throw new Error('Email body is required');
      },
      slack_send: (cfg) => {
        if (!cfg.channel) throw new Error('Channel is required');
        if (!cfg.text) throw new Error('Message text is required');
      },
      http_request: (cfg) => {
        if (!cfg.url) throw new Error('URL is required');
        try {
          new URL(cfg.url);
        } catch {
          throw new Error('Invalid URL format');
        }
      },
    };

    const validator = validationRules[nodeType];
    if (validator) {
      validator(config);
    }
  }

  private async logExecution(nodeId: string, level: string, message: string, data?: any) {
    try {
      await prisma.executionLog.create({
        data: {
          id: `log-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          executionId: this.context.executionId,
          nodeId,
          level,
          message,
          data: data ? JSON.stringify(data) : null,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      console.error('Failed to create execution log:', error);
    }
  }

  // ============================================
  // TRIGGER EXECUTORS
  // ============================================

  private async executeTriggerManual(config: any, previousOutput?: any) {
    return {
      triggered: true,
      timestamp: new Date(),
      type: 'manual',
      data: previousOutput || config,
    };
  }

  private async executeTriggerSchedule(config: any) {
    return {
      triggered: true,
      timestamp: new Date(),
      type: 'schedule',
      cronExpression: config.cronExpression,
      timezone: config.timezone || 'UTC',
    };
  }

  private async executeTriggerWebhook(config: any, previousOutput?: any) {
    return {
      triggered: true,
      timestamp: new Date(),
      type: 'webhook',
      payload: previousOutput || config.payload || {},
    };
  }

  private async executeTriggerHealth(config: any) {
    return {
      triggered: true,
      timestamp: new Date(),
      type: 'health_event',
      eventType: config.eventType,
    };
  }

  private async executeTriggerForm(config: any, previousOutput?: any) {
    return {
      triggered: true,
      timestamp: new Date(),
      type: 'form_submission',
      formData: previousOutput || config.formData || {},
      formFields: config.formFields || [],
    };
  }

  private async executeTriggerChat(config: any, previousOutput?: any) {
    return {
      triggered: true,
      timestamp: new Date(),
      type: 'chat_event',
      platform: config.platform || 'unknown',
      chatData: previousOutput || config.chatData || {},
      listenFor: config.listenFor,
    };
  }

  private async executeTriggerError(config: any, previousOutput?: any) {
    return {
      triggered: true,
      timestamp: new Date(),
      type: 'application_error',
      errorType: config.errorType || 'any',
      severity: config.severity || 'error',
      errorDetails: previousOutput || config.errorDetails || {},
    };
  }

  // ============================================
  // HELPER METHODS (INTEGRATIONS / CREDENTIALS)
  // ============================================

  private async getUserApiKey(service: string): Promise<string> {
    const apiKey = await prisma.userApiKey.findFirst({
      where: {
        userId: this.context.userId,
        service,
        isActive: true,
      },
    });

    if (!apiKey) {
      throw new Error(`No active ${service} API key found. Please add one in Settings.`);
    }

    await prisma.userApiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    });

    // use already-imported decrypt to avoid dynamic import loop
    return decrypt(apiKey.encryptedKey);
  }

  private async getIntegrationCredentials(type: string): Promise<any> {
    const integration = await prisma.integration.findFirst({
      where: {
        userId: this.context.userId,
        type,
        isActive: true,
      },
    });

    if (!integration) {
      throw new Error(
        `No active ${type} integration found for user. Please connect your account in settings.`
      );
    }

    let credentials = JSON.parse(decrypt(integration.credentials));

    if (credentials.expiry_date && credentials.refresh_token && credentials.expiry_date < Date.now()) {
      console.log(
        `[WorkflowExecutor] Refreshing expired ${type} token for user ${this.context.userId}`
      );
      try {
        const refreshedCredentials =
          await tokenRefreshService.getValidGoogleCredentials(this.context.userId);
        credentials = {
          ...credentials,
          ...refreshedCredentials,
          last_refreshed: new Date().toISOString(),
        };

        await prisma.integration.update({
          where: { id: integration.id },
          data: {
            credentials: encrypt(JSON.stringify(credentials)),
            updatedAt: new Date(),
          },
        });
      } catch (refreshError: any) {
        await this.logExecution(
          'system',
          'error',
          `Failed to refresh ${type} token: ${refreshError.message}. Invalidating integration.`,
          { error: refreshError.message }
        );
        await prisma.integration.update({
          where: { id: integration.id },
          data: {
            isActive: false,
            updatedAt: new Date(),
          },
        });
        throw new Error(
          `Failed to refresh ${type} token. Please re-authenticate your ${type} integration in settings.`
        );
      }
    }

    return credentials;
  }

  private async getMetaPageId(accessToken: string, pageName: string): Promise<string> {
    try {
      const pagesResponse = await fetch(
        `https://graph.facebook.com/v18.0/me/accounts?access_token=${accessToken}`
      );
      const pagesData = await pagesResponse.json();

      if (!pagesResponse.ok) {
        throw new Error(pagesData.error?.message || 'Failed to fetch Meta pages');
      }

      const page = pagesData.data.find((p: any) => p.name === pageName);

      if (!page) {
        throw new Error(`Meta page '${pageName}' not found for this account.`);
      }

      return page.id;
    } catch (error: any) {
      throw new Error(`Error fetching Meta page ID: ${error.message}`);
    }
  }

  // ============================================
  // GOOGLE WORKSPACE EXECUTORS
  // ============================================

  private async executeGoogleSheetsRead(config: any) {
    const { google } = await import('googleapis');
    const credentials = await this.getIntegrationCredentials('google');
    const auth = new google.auth.OAuth2();
    auth.setCredentials(credentials);
    const sheets = google.sheets({ version: 'v4', auth });

    const circuitBreaker = this.getCircuitBreaker('google_sheets');

    const response = await circuitBreaker.fire(async () => {
      return sheets.spreadsheets.values.get({
        spreadsheetId: config.spreadsheetId,
        range: config.range,
      });
    });

    return {
      success: true,
      data: response.data.values,
      rowCount: response.data.values?.length || 0,
    };
  }

  private async executeGoogleSheetsWrite(config: any, previousOutput?: any) {
    const { google } = await import('googleapis');
    const credentials = await this.getIntegrationCredentials('google');
    const auth = new google.auth.OAuth2();
    auth.setCredentials(credentials);
    const sheets = google.sheets({ version: 'v4', auth });

    const data = previousOutput?.data || JSON.parse(config.data || '[]');

    const circuitBreaker = this.getCircuitBreaker('google_sheets_write');

    if (config.append === 'Append') {
      await circuitBreaker.execute(async () => {
        await sheets.spreadsheets.values.append({
          spreadsheetId: config.spreadsheetId,
          range: config.range,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: data },
        });
      });
    } else {
      await circuitBreaker.execute(async () => {
        await sheets.spreadsheets.values.update({
          spreadsheetId: config.spreadsheetId,
          range: config.range,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: data },
        });
      });
    }

    return {
      success: true,
      method: config.append === 'Append' ? 'append' : 'update',
      rowsAffected: data?.length || 0,
    };
  }

  private async executeGmailSend(config: any, previousOutput?: any) {
    const { google } = await import('googleapis');
    const credentials = await this.getIntegrationCredentials('google');
    const auth = new google.auth.OAuth2();
    auth.setCredentials(credentials);
    const gmail = google.gmail({ version: 'v1', auth });

    const to = config.to || previousOutput?.to;
    const subject = config.subject || previousOutput?.subject;
    const body = config.body || previousOutput?.body;

    const messageParts = [
      `To: ${to}`,
      config.cc ? `Cc: ${config.cc}` : '',
      `Subject: ${subject}`,
      '',
      body,
    ].filter(Boolean);

    const message = messageParts.join('\n');
    const encodedMessage = Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    const circuitBreaker = this.getCircuitBreaker('google_gmail_send');

    const result = await circuitBreaker.execute(async () => {
      return gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw: encodedMessage },
      });
    });

    return {
      success: true,
      messageId: result.data.id,
      to,
    };
  }

  private async executeGmailRead(config: any) {
    const { google } = await import('googleapis');
    const credentials = await this.getIntegrationCredentials('google');
    const auth = new google.auth.OAuth2();
    auth.setCredentials(credentials);
    const gmail = google.gmail({ version: 'v1', auth });

    const circuitBreaker = this.getCircuitBreaker('google_gmail_read_list');

    const response = await circuitBreaker.execute(async () => {
      return gmail.users.messages.list({
        userId: 'me',
        q: config.query || 'is:unread',
        maxResults: config.maxResults || 10,
      });
    });

    const messages = response.data.messages || [];
    const fullMessages = await Promise.all(
      messages.map(async (msg: gmail_v1.Schema$Message) => {
        const circuitBreakerGet = this.getCircuitBreaker('google_gmail_read_get');
        const full = await circuitBreakerGet.execute(async () => {
          return gmail.users.messages.get({
            userId: 'me',
            id: msg.id!,
          });
        });
        return full.data;
      })
    );

    return {
      success: true,
      messages: fullMessages,
      count: fullMessages.length,
    };
  }

  private async executeCalendarCreate(config: any, previousOutput?: any) {
    const { google } = await import('googleapis');
    const credentials = await this.getIntegrationCredentials('google');
    const auth = new google.auth.OAuth2();
    auth.setCredentials(credentials);
    const calendar = google.calendar({ version: 'v3', auth });

    const circuitBreaker = this.getCircuitBreaker('google_calendar_create');

    const event = await circuitBreaker.execute(async () => {
      return calendar.events.insert({
        calendarId: 'primary',
        requestBody: {
          summary: config.summary || previousOutput?.title,
          description: config.description || previousOutput?.description,
          start: { dateTime: config.startTime },
          end: { dateTime: config.endTime },
          attendees: config.attendees?.map((email: string) => ({ email })),
        },
      });
    });

    return {
      success: true,
      eventId: event.data.id,
      eventLink: event.data.htmlLink,
    };
  }

  private async executeCalendarList(config: any) {
    const { google } = await import('googleapis');
    const credentials = await this.getIntegrationCredentials('google');
    const auth = new google.auth.OAuth2();
    auth.setCredentials(credentials);
    const calendar = google.calendar({ version: 'v3', auth });

    const circuitBreaker = this.getCircuitBreaker('google_calendar_list');

    const response = await circuitBreaker.execute(async () => {
      return calendar.events.list({
        calendarId: 'primary',
        timeMin: config.timeMin || new Date().toISOString(),
        timeMax: config.timeMax,
        maxResults: config.maxResults || 10,
        singleEvents: true,
        orderBy: 'startTime',
      });
    });

    return {
      success: true,
      events: response.data.items || [],
      count: response.data.items?.length || 0,
    };
  }

  private async executeGoogleDriveUpload(config: any, previousOutput?: any) {
    const { google } = await import('googleapis');
    const credentials = await this.getIntegrationCredentials('google');
    const auth = new google.auth.OAuth2();
    auth.setCredentials(credentials);
    const drive = google.drive({ version: 'v3', auth });

    const fileContent = previousOutput?.fileContent || config.fileContent;

    let fileBuffer: Buffer;

    if (typeof fileContent === 'string') {
      fileBuffer = Buffer.from(fileContent, 'base64');
    } else if (Buffer.isBuffer(fileContent)) {
      fileBuffer = fileContent;
    } else {
      throw new Error('Invalid file content format');
    }

    const fileName = config.fileName || previousOutput?.fileName || 'upload.bin';
    const mimeType =
      config.mimeType || previousOutput?.mimeType || 'application/octet-stream';
    const folderId = config.folderId || previousOutput?.folderId;

    const fileMetadata: any = {
      name: fileName,
      mimeType,
    };

    if (folderId) {
      fileMetadata.parents = [folderId];
    }

    const media = {
      mimeType,
      body: fileBuffer as any,
    };

    const circuitBreaker = this.getCircuitBreaker('google_drive_upload');

    const response = await circuitBreaker.execute(async () => {
      return drive.files.create({
        requestBody: fileMetadata,
        media,
        fields: 'id,name,webViewLink,webContentLink',
      });
    });

    return {
      success: true,
      fileId: response.data.id,
      fileName: response.data.name,
      viewLink: response.data.webViewLink,
      downloadLink: response.data.webContentLink,
    };
  }

  private async executeYouTubeUpload(config: any, previousOutput?: any) {
    const { google } = await import('googleapis');
    const credentials = await this.getIntegrationCredentials('google');
    const auth = new google.auth.OAuth2();
    auth.setCredentials(credentials);
    const youtube = google.youtube({ version: 'v3', auth });

    const title = config.title || previousOutput?.title;
    const description = config.description || previousOutput?.description;
    const videoUrl = config.videoUrl || previousOutput?.videoUrl;
    const privacyStatus = config.privacy || 'private';

    if (!videoUrl) {
      throw new Error('Video URL is required for YouTube upload.');
    }

    try {
      new URL(videoUrl);
    } catch {
      throw new Error('Invalid video URL provided.');
    }

    const videoResponse = await fetch(videoUrl);
    if (!videoResponse.ok) {
      throw new Error(`Failed to fetch video from URL: ${videoResponse.statusText}`);
    }

    const videoStream = videoResponse.body;

    const requestBody = {
      snippet: {
        title: title || 'Untitled Video',
        description: description || '',
      },
      status: {
        privacyStatus,
      },
    };

    const media = {
      body: videoStream as any,
      mimeType: videoResponse.headers.get('content-type') || 'application/octet-stream',
    };

    const circuitBreaker = this.getCircuitBreaker('google_youtube_upload');

    const response = await circuitBreaker.execute(async () => {
      return youtube.videos.insert({
        part: ['snippet', 'status'],
        requestBody,
        media,
      });
    });

    return {
      success: true,
      videoId: response.data.id,
      videoTitle: response.data.snippet?.title,
      videoUrl: `https://www.youtube.com/watch?v=${response.data.id}`,
      privacyStatus: response.data.status?.privacyStatus,
    };
  }

  // ============================================
  // SOCIAL MEDIA EXECUTORS
  // ============================================

  private async executeMetaPost(config: any, previousOutput?: any) {
    const credentials = await this.getIntegrationCredentials('meta');
    const platform = config.platform || 'facebook';
    const message = config.message || previousOutput?.text;

    if (platform === 'facebook') {
      let pageId = config.pageId;
      if (!pageId && config.pageName) {
        pageId = await this.getMetaPageId(credentials.access_token, config.pageName);
      }

      if (!pageId) {
        throw new Error('Facebook Page ID or Page Name is required.');
      }

      const url = `https://graph.facebook.com/v18.0/${pageId}/feed`;

      const body: any = {
        message,
        access_token: credentials.access_token,
      };

      if (config.imageUrl) {
        body.link = config.imageUrl;
      }

      const circuitBreaker = this.getCircuitBreaker('meta_post_facebook');

      const response = await circuitBreaker.execute(async () => {
        return fetch(url, {
          method: 'POST',
          body: new URLSearchParams(body),
        });
      });

      if (!response.ok) {
        throw new Error(`Facebook post failed: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        success: true,
        platform: 'facebook',
        postId: data.id,
      };
    }

    return { success: false, message: 'Unsupported platform' };
  }

  private async executeInstagramPost(config: any) {
    const credentials = await this.getIntegrationCredentials('meta');

    const circuitBreaker = this.getCircuitBreaker('instagram_post');

    const containerUrl = `https://graph.facebook.com/v18.0/${config.accountId}/media`;
    const containerResponse = await circuitBreaker.execute(async () => {
      return fetch(containerUrl, {
        method: 'POST',
        body: new URLSearchParams({
          image_url: config.imageUrl,
          caption: config.caption || '',
          access_token: credentials.access_token,
        }),
      });
    });

    const containerData = await containerResponse.json();
    const creationId = containerData.id;

    const publishUrl = `https://graph.facebook.com/v18.0/${config.accountId}/media_publish`;
    const publishResponse = await circuitBreaker.execute(async () => {
      return fetch(publishUrl, {
        method: 'POST',
        body: new URLSearchParams({
          creation_id: creationId,
          access_token: credentials.access_token,
        }),
      });
    });

    const data = await publishResponse.json();

    return {
      success: true,
      platform: 'instagram',
      postId: data.id,
    };
  }

  private async executeTwitterPost(config: any, previousOutput?: any) {
    const credentials = await this.getIntegrationCredentials('twitter');

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const OAuth = require('oauth-1.0a');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const crypto = require('crypto');

    const oauth = OAuth({
      consumer: {
        key: credentials.consumer_key,
        secret: credentials.consumer_secret,
      },
      signature_method: 'HMAC-SHA1',
      hash_function(baseString: string, key: string) {
        return crypto.createHmac('sha1', key).update(baseString).digest('base64');
      },
    });

    const requestData = {
      url: 'https://api.twitter.com/2/tweets',
      method: 'POST',
    };

    const token = {
      key: credentials.access_token,
      secret: credentials.access_secret,
    };

    const headers = oauth.toHeader(oauth.authorize(requestData, token));

    const circuitBreaker = this.getCircuitBreaker('twitter_post');

    const response = await circuitBreaker.execute(async () => {
      return fetch(requestData.url, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: config.text || previousOutput?.text,
        }),
      });
    });

    const data = await response.json();

    return {
      success: true,
      platform: 'twitter',
      tweetId: data.data?.id,
    };
  }

  private async executeLinkedInPost(config: any, previousOutput?: any) {
    const credentials = await this.getIntegrationCredentials('linkedin');
    const url = 'https://api.linkedin.com/v2/ugcPosts';

    const body = {
      author: config.personUrn || credentials.person_urn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: {
            text: config.text || previousOutput?.text,
          },
          shareMediaCategory: 'NONE',
        },
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': config.visibility || 'PUBLIC',
      },
    };

    const circuitBreaker = this.getCircuitBreaker('linkedin_post');

    const response = await circuitBreaker.execute(async () => {
      return fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${credentials.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
    });

    const data = await response.json();

    return {
      success: true,
      platform: 'linkedin',
      postId: data.id,
    };
  }

  // ============================================
  // MESSAGING EXECUTORS
  // ============================================

  private async executeDiscordSend(config: any, previousOutput?: any) {
    const webhookUrl = config.webhookUrl;
    const message = config.content || previousOutput?.text;
    const username = config.username || 'Workflow Bot';
    const embeds = config.embeds;

    if (!webhookUrl || !message) {
      throw new Error('Discord Webhook URL and message are required.');
    }

    const isValid = await webhookValidationService.validateDiscordWebhook(webhookUrl);
    if (!isValid) {
      throw new Error('Invalid or inactive Discord webhook URL.');
    }

    const lastSent = this.discordWebhookRateLimits.get(webhookUrl);
    const now = Date.now();
    if (lastSent && now - lastSent < this.DISCORD_WEBHOOK_RATE_LIMIT_INTERVAL) {
      const timeLeft = this.DISCORD_WEBHOOK_RATE_LIMIT_INTERVAL - (now - lastSent);
      await this.logExecution(
        'system',
        'info',
        `Discord webhook rate limit hit for ${webhookUrl}. Waiting ${timeLeft}ms.`
      );
      await new Promise((resolve) => setTimeout(resolve, timeLeft));
    }
    this.discordWebhookRateLimits.set(webhookUrl, now);

    const circuitBreaker = this.getCircuitBreaker(`discord-${webhookUrl}`);
          try {
            await circuitBreaker.execute(async () => {
              const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  content: message,
                  username,
                  embeds,
                }),
              });

              if (!response.ok) {
                const errorText = await response.text();
                throw new Error(
                  `Failed to send Discord message: ${response.status} - ${errorText}`
                );
              }
            });

            return { success: true, message: 'Discord message sent successfully.' };
          } catch (error: any) {
            if (circuitBreaker.getState() === CircuitBreakerState.OPEN) {
              await this.logExecution(
                'system',
                'warn',
                `Circuit breaker open for Discord webhook ${webhookUrl}. Skipping request.`
              );
              return {
                success: false,
                message: `Discord webhook ${webhookUrl} temporarily unavailable.`,
              };
            }
            throw new Error(`Error sending Discord message: ${error.message}`);
          }
  }

  private async executeTelegramSend(config: any, previousOutput?: any) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const url = `https://api.telegram.org/bot${token}/sendMessage`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: config.chatId,
        text: config.message || previousOutput?.text,
        parse_mode: config.parseMode || 'HTML',
      }),
    });

    if (!response.ok) {
      const errorBody = await response.json();
      throw new Error(`Telegram send failed: ${response.statusText}. Details: ${JSON.stringify(errorBody)}`);
    }

    const data = await response.json();
    return {
      success: true,
      platform: 'telegram',
      messageId: data.result?.message_id,
    };
  }

  private async executeSlackSend(config: any, previousOutput?: any) {
    const credentials = await this.getIntegrationCredentials('slack');

    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${credentials.access_token}`,
      },
      body: JSON.stringify({
        channel: config.channel,
        text: config.text || previousOutput?.text,
        blocks: config.blocks,
      }),
    });

    const data = await response.json();

    if (!data.ok) {
      throw new Error(`Slack send failed: ${data.error}`);
    }

    return { success: true, platform: 'slack', timestamp: data.ts };
  }

  private async executeWhatsAppSend(config: any, previousOutput?: any) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_WHATSAPP_NUMBER;

    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
      },
      body: new URLSearchParams({
        From: `whatsapp:${from}`,
        To: `whatsapp:${config.to}`,
        Body: config.message || previousOutput?.text,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`WhatsApp send failed: ${response.statusText}. Details: ${JSON.stringify(data)}`);
    }

    return {
      success: true,
      platform: 'whatsapp',
      messageId: data.sid,
      twilioResponse: data,
    };
  }

  // ============================================
  // DEVELOPMENT TOOLS EXECUTORS
  // ============================================

  private async executeGitHubCreateIssue(config: any, previousOutput?: any) {
    const credentials = await this.getIntegrationCredentials('github');

    const response = await fetch(
      `https://api.github.com/repos/${config.owner}/${config.repo}/issues`,
      {
        method: 'POST',
        headers: {
          Authorization: `token ${credentials.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: config.title || previousOutput?.title,
          body: config.body || previousOutput?.body,
          labels: config.labels
            ? config.labels.split(',').map((l: string) => l.trim())
            : [],
        }),
      }
    );

    const data = await response.json();

    return {
      success: true,
      issueNumber: data.number,
      issueUrl: data.html_url,
    };
  }

  private async executeGitHubCreatePR(config: any) {
    const credentials = await this.getIntegrationCredentials('github');

    const circuitBreaker = this.getCircuitBreaker('github_create_pr');

    const response = await circuitBreaker.execute(async () => {
      return fetch(
        `https://api.github.com/repos/${config.owner}/${config.repo}/pulls`,
        {
          method: 'POST',
          headers: {
            Authorization: `token ${credentials.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: config.title,
            head: config.head,
            base: config.base || 'main',
            body: config.body,
          }),
        }
      );
    });

    const data = await response.json();

    return {
      success: true,
      prNumber: data.number,
      prUrl: data.html_url,
    };
  }

  private async executeJiraCreateTicket(config: any, previousOutput?: any) {
    const credentials = await this.getIntegrationCredentials('jira');

    const circuitBreaker = this.getCircuitBreaker('jira_create_ticket');

    const response = await circuitBreaker.execute(async () => {
      return fetch(`${credentials.domain}/rest/api/3/issue`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${credentials.email}:${credentials.api_token}`
          ).toString('base64')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fields: {
            project: { key: config.projectKey },
            summary: config.summary || previousOutput?.title,
            description: config.description || previousOutput?.body,
            issuetype: { name: config.issueType || 'Task' },
          },
        }),
      });
    });

    const data = await response.json();

    return {
      success: true,
      ticketKey: data.key,
      ticketUrl: `${credentials.domain}/browse/${data.key}`,
    };
  }

  // ============================================
  // LOGIC & CONTROL FLOW EXECUTORS
  // ============================================

  private async executeIfElse(config: any, previousOutput?: any) {
    const condition = config.condition ?? previousOutput;
    const operator = config.operator || 'equals';
    const compareTo = config.compareTo;

    let conditionMet = false;

    switch (operator) {
      case 'equals':
        conditionMet = String(condition) === String(compareTo);
        break;
      case 'not_equals':
        conditionMet = String(condition) !== String(compareTo);
        break;
      case 'greater_than':
        conditionMet = Number(condition) > Number(compareTo);
        break;
      case 'less_than':
        conditionMet = Number(condition) < Number(compareTo);
        break;
      case 'contains':
        conditionMet = String(condition).includes(String(compareTo));
        break;
      case 'is_empty':
        conditionMet = !condition || condition === '' || condition === null;
        break;
      case 'is_not_empty':
        conditionMet = !!condition && condition !== '';
        break;
      default:
        conditionMet = !!condition;
    }

    return {
      success: true,
      conditionMet,
      branch: conditionMet ? 'true' : 'false',
      evaluatedCondition: condition,
      operator,
    };
  }

  private async executeSwitch(config: any, previousOutput?: any) {
    const expression = config.expression ?? previousOutput;
    const cases = JSON.parse(config.cases || '{}');

    let matched = false;
    let matchedCase = 'default';

    for (const [key] of Object.entries(cases)) {
      if (String(expression) === String(key)) {
        matched = true;
        matchedCase = key;
        break;
      }
    }

    return {
      success: true,
      matched,
      case: matchedCase,
      expression,
      output: cases[matchedCase] || cases['default'],
    };
  }

  private async executeLoop(config: any, previousOutput?: any) {
    const iterations = Number(config.iterations) || 1;
    const results: any[] = [];

    for (let i = 0; i < iterations; i++) {
      results.push({
        iteration: i + 1,
        timestamp: new Date(),
        data: previousOutput,
      });
    }

    return {
      success: true,
      iterations,
      results,
    };
  }

  private async executeWait(config: any) {
    const seconds = Number(config.seconds) || 1;
    const untilTime = config.untilTime;

    if (untilTime) {
      const targetTime = new Date(untilTime);
      const now = new Date();
      const waitMs = Math.max(0, targetTime.getTime() - now.getTime());
      await new Promise((resolve) => setTimeout(resolve, waitMs));

      return {
        success: true,
        waitedUntil: targetTime,
        actualWait: waitMs / 1000,
      };
    }

    await new Promise((resolve) => setTimeout(resolve, seconds * 1000));

    return {
      success: true,
      waitedFor: seconds,
      unit: 'seconds',
    };
  }

  private async executeFilter(config: any, previousOutput?: any) {
    const condition = config.condition ?? previousOutput;

    let passes = false;
    try {
      if (condition && typeof condition === 'object') {
        passes = true;
      } else if (String(condition).trim()) {
        passes = true;
      }
    } catch {
      passes = false;
    }

    return {
      success: true,
      filtered: passes,
      condition,
      passed: passes,
    };
  }

  private async executeDelay(config: any) {
    const seconds = Number(config.seconds) || 5;
    await new Promise((resolve) => setTimeout(resolve, seconds * 1000));

    return {
      success: true,
      delayedFor: seconds,
      unit: 'seconds',
    };
  }

  private async executeCodeMerge(config: any, previousOutput?: any) {
    const inputs = config.inputs || [];
    const mergedData: any = {};

    for (const input of inputs) {
      if (typeof input === 'object') {
        Object.assign(mergedData, input);
      }
    }

    if (previousOutput && typeof previousOutput === 'object') {
      Object.assign(mergedData, previousOutput);
    }

    return {
      success: true,
      merged: true,
      data: mergedData,
      inputCount: inputs.length,
    };
  }

  private async executeCodeSplit(config: any, previousOutput?: any) {
    const data = previousOutput ?? config.data;
    const splitType = config.splitType || 'array';
    const splitCount = Number(config.splitCount) || 2;

    if (splitType === 'array' && Array.isArray(data)) {
      return {
        success: true,
        split: true,
        branches: data.map((item, index) => ({
          branch: index,
          data: item,
        })),
      };
    }

    if (splitType === 'parallel') {
      const branches = [];
      for (let i = 0; i < splitCount; i++) {
        branches.push({
          branch: i,
          data,
        });
      }
      return {
        success: true,
        split: true,
        branches,
      };
    }

    return {
      success: true,
      split: true,
      branches: [{ branch: 0, data }],
    };
  }

  private async executeSubWorkflow(config: any, previousOutput?: any) {
    const subWorkflowId = config.subWorkflowId;

    if (!subWorkflowId) {
      throw new Error('Sub-workflow ID is required');
    }

    const subWorkflow = await prisma.workflow.findUnique({
      where: { id: subWorkflowId },
    });

    if (!subWorkflow) {
      throw new Error(`Sub-workflow ${subWorkflowId} not found`);
    }

    const workflowData = subWorkflow.workflowData as any;

    const subExecutor = new WorkflowExecutor();
    const triggerData = config.passData === 'yes' ? previousOutput : undefined;

    const result = await subExecutor.executeWorkflow(
      subWorkflowId,
      workflowData.nodes,
      workflowData.edges,
      this.context.userId,
      triggerData
    );

    return {
      success: true,
      subWorkflowId,
      subWorkflowResult: result,
      waitedForCompletion: config.waitForCompletion !== 'no',
    };
  }

  private async executeErrorHandler(config: any, previousOutput?: any) {
    const onError = config.onError || 'retry';
    const maxRetries = Number(config.maxRetries) || 3;
    const errorDetails = previousOutput || {};

    switch (onError) {
      case 'retry':
        return {
          success: true,
          strategy: 'retry',
          maxRetries,
          errorDetails,
        };
      case 'stop_workflow':
        throw new Error('Workflow stopped by error handler');
      case 'send_notification':
        await this.logExecution(
          'error_handler',
          'warn',
          'Error notification triggered',
          errorDetails
        );
        return {
          success: true,
          strategy: 'send_notification',
          errorDetails,
        };
      case 'branch':
        return {
          success: true,
          strategy: 'branch',
          errorDetails,
          takeBranch: 'error',
        };
      default:
        return {
          success: true,
          strategy: onError,
          errorDetails,
        };
    }
  }

  // ============================================
  // AI MODEL EXECUTORS
  // ============================================

  private async executeChatGPT(config: any, previousOutput?: any) {
    const apiKey = await this.getUserApiKey('openai');
    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({ apiKey });

    const prompt = config.prompt ?? previousOutput?.text ?? previousOutput;

    if (!prompt) {
      throw new Error('No prompt provided to ChatGPT node');
    }

    const circuitBreaker = this.getCircuitBreaker('chatgpt');

    const result = await circuitBreaker.execute(async () => {
      const DEFAULT_MODEL = process.env.OPENAI_DEFAULT_MODEL || 'gpt-4.1-mini';

      const MODEL_ALIASES: Record<string, string> = {
        'gpt-4': 'gpt-4.1',
        'gpt-4-turbo': 'gpt-4.1',
        'gpt-5.0': 'gpt-4.1',
      };

      const requested = (config.model as string | undefined) || DEFAULT_MODEL;
      const model = MODEL_ALIASES[requested] ?? requested;

      const completion = await openai.chat.completions.create({
        model,
        messages: [{ role: 'user', content: String(prompt) }],
        temperature:
          config.temperature !== undefined ? Number(config.temperature) : 0.7,
        max_tokens:
          config.maxTokens !== undefined ? Number(config.maxTokens) : 1000,
      });

      return {
        success: true,
        response: completion.choices[0]?.message?.content ?? '',
        model,
        tokensUsed: completion.usage?.total_tokens,
      };
    });

    return result;
  }

  private async executeClaude(config: any, previousOutput?: any) {
        const circuitBreaker = this.getCircuitBreaker('claude');
        const result = await circuitBreaker.execute(async () => {
            const apiKey = await this.getUserApiKey('anthropic');
            const Anthropic = (await import('@anthropic-ai/sdk')).default;
            const anthropic = new Anthropic({ apiKey });

            const prompt = config.prompt ?? previousOutput?.text ?? previousOutput;

            if (!prompt) {
                throw new Error('No prompt provided to Claude node');
            }

            const model = config.model || 'claude-3-sonnet-20240229';

            const message = await anthropic.messages.create({
                model,
                max_tokens: Number(config.maxTokens) || 1000,
                messages: [{ role: 'user', content: String(prompt) }],
            });

            const textBlock = (message as any).content.find((block: any) => block.type === 'text');

            return {
                success: true,
                response: textBlock?.text ?? '',
                model,
            };
        });
        return result;
    }

  private async executeGemini(config: any, previousOutput?: any) {
        const circuitBreaker = this.getCircuitBreaker('gemini');
        const result = await circuitBreaker.execute(async () => {
            const apiKey = await this.getUserApiKey('gemini');

            const { GoogleGenAI } = await import('@google/genai');
            const genAI = new GoogleGenAI({
                apiKey: apiKey,
                apiVersion: 'v1',
              });

              // You can adjust this to a model your account has access to if needed
              const modelName = (() => {
                  const configuredModel = config.model || process.env.GEMINI_MODEL;
                  if (configuredModel === 'gemini-1.5-pro') return 'gemini-1.5-pro';
                  if (configuredModel === 'gemini-1.5-flash') return 'gemini-1.5-flash';
                  if (configuredModel === 'gemini-1.5-pro-001') return 'gemini-1.5-pro-001';
                  if (configuredModel === 'gemini-1.5-flash-001') return 'gemini-1.5-flash-001';
                  if (configuredModel === 'gemini-pro') return 'gemini-pro';
                  if (configuredModel === 'gemini-pro-vision') return 'gemini-pro-vision';
                  if (configuredModel === 'gemini-2.5-pro') return 'gemini-2.5-pro';
                  if (configuredModel === 'gemini-2.5-flash') return 'gemini-2.5-flash';
                  return configuredModel || 'gemini-1.5-flash-001'; // Default to gemini-1.5-flash-001 if nothing else is specified
              })();

            const prompt = config.prompt ?? previousOutput?.text ?? previousOutput;

            if (!prompt) {
                throw new Error('No prompt provided to Gemini node');
            }

            const textPrompt =
                typeof prompt === 'string' ? prompt : JSON.stringify(prompt, null, 2);

            try {
                const result = await genAI.models.generateContent({ model: modelName, contents: textPrompt });
                const responseText =
                    (result as any)?.response?.text?.() ?? (result as any)?.response ?? '';

                return {
                    success: true,
                    response: responseText,
                    model: modelName,
                };
            } catch (err: any) {
                throw new Error(
                    `Gemini request failed: ${err?.message || 'Unknown error'} (model: ${modelName})`
                );
            }
        });
        return result;
    }

  // ============================================
  // E-COMMERCE EXECUTORS
  // ============================================

  private async executeAmazonSearch(config: any) {
    const accessKey = process.env.AMAZON_ACCESS_KEY;
    const secretKey = process.env.AMAZON_SECRET_KEY;
    const associateTag = process.env.AMAZON_ASSOCIATE_TAG;

    if (!accessKey || !secretKey || !associateTag) {
      throw new Error('Amazon API credentials not configured');
    }

    const circuitBreaker = this.getCircuitBreaker('amazon_search');

    const result = await circuitBreaker.execute(async () => {
      // Placeholder for actual Amazon Product Advertising API call
      return {
        success: true,
        keywords: config.keywords,
        message: 'Amazon search requires full Product Advertising API implementation',
        category: config.category,
        maxResults: config.maxResults || 10,
      };
    });

    return result;
  }

  private async executeFlipkartSearch(config: any) {
    const affiliateId = process.env.FLIPKART_AFFILIATE_ID;
    const affiliateToken = process.env.FLIPKART_AFFILIATE_TOKEN;

    if (!affiliateId || !affiliateToken) {
      throw new Error('Flipkart API credentials not configured');
    }

    const circuitBreaker = this.getCircuitBreaker('flipkart_search');

    const result = await circuitBreaker.execute(async () => {
      const url = `https://affiliate-api.flipkart.net/affiliate/api/${affiliateId}.json`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Fk-Affiliate-Id': affiliateId,
          'Fk-Affiliate-Token': affiliateToken,
        },
      });

      if (!response.ok) {
        throw new Error(`Flipkart API failed: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        success: true,
        query: config.query,
        results: (data as any).products || [],
        count: (data as any).products?.length || 0,
      };
    });

    return result;
  }

  private getCircuitBreaker(serviceName: string): CircuitBreaker {
    if (!this.circuitBreakers.has(serviceName)) {
      this.circuitBreakers.set(serviceName, new CircuitBreaker());
    }
    return this.circuitBreakers.get(serviceName)!;
  }

  // ============================================
  // CLOUD SERVICES EXECUTORS
  // ============================================

  private async executeSpotifyCreatePlaylist(config: any) {
    const credentials = await this.getIntegrationCredentials('spotify');

    const circuitBreaker = this.getCircuitBreaker('spotify_create_playlist');

    const result = await circuitBreaker.execute(async () => {
      const response = await fetch(
        `https://api.spotify.com/v1/users/${credentials.id}/playlists`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${credentials.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: config.name,
            public: config.public || false,
            collaborative: config.collaborative || false,
            description: config.description || '',
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Spotify API failed: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        success: true,
        playlistId: data.id,
        playlistUrl: data.external_urls.spotify,
      };
    });

    return result;
  }

  // ============================================
  // DATA OPERATION EXECUTORS
  // ============================================

  private async executeHttpRequest(config: any, previousOutput?: any) {
    const options: any = {
      method: config.method || 'GET',
      headers: config.headers ? JSON.parse(config.headers) : {},
    };

    if (config.body && config.method !== 'GET') {
      const body = previousOutput?.body || JSON.parse(config.body || '{}');
      options.body = JSON.stringify(body);
      options.headers['Content-Type'] = 'application/json';
    }

    const circuitBreaker = this.getCircuitBreaker(new URL(config.url).hostname);

    const { response, data, headersObj } = await circuitBreaker.fire(async () => {
      const response = await fetch(config.url, options);
      const contentType = response.headers.get('content-type');

      let data: any;
      if (contentType?.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      const headersObj: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headersObj[key] = value;
      });
      return { response, data, headersObj };
    });

    return {
      success: response.ok,
      statusCode: response.status,
      headers: headersObj,
      data,
    };
  }

  private async executeJsonParse(config: any, previousOutput?: any) {
    try {
      const jsonString = config.jsonString ?? previousOutput;
      const parsed = JSON.parse(String(jsonString));

      return {
        success: true,
        data: parsed,
      };
    } catch (error: any) {
      throw new Error(`JSON parse failed: ${error.message}`);
    }
  }

  private async executeDataTransform(config: any, previousOutput?: any) {
    const input = previousOutput ?? config.input;
    const transformation = config.transformation;

    let output = input;

    try {
      if (transformation.includes('uppercase')) {
        output = String(input).toUpperCase();
      } else if (transformation.includes('lowercase')) {
        output = String(input).toLowerCase();
      } else if (transformation.includes('reverse')) {
        output = String(input).split('').reverse().join('');
      }
    } catch (error: any) {
      throw new Error(`Transformation failed: ${error.message}`);
    }

    return {
      success: true,
      input,
      output,
      transformation,
    };
  }

  // ============================================
  // NOTION EXECUTORS
  // ============================================

  private async executeNotionCreatePage(config: any, previousOutput?: any) {
        const circuitBreaker = this.getCircuitBreaker('notion_create_page');
        const result = await circuitBreaker.execute(async () => {
            const credentials = await this.getIntegrationCredentials('notion');
            const { Client } = await import('@notionhq/client');
            const notion = new Client({ auth: credentials.access_token });

            const title = config.title || previousOutput?.title;
            const properties = config.properties ? JSON.parse(config.properties) : {};

            const page = await notion.pages.create({
                parent: { database_id: config.databaseId },
                properties: {
                    title: {
                        title: [{ text: { content: title } }],
                    },
                    ...properties,
                },
            });

            return {
                success: true,
                pageId: page.id,
                url: (page as any).url,
            };
        });
        return result;
    }

  private async executeNotionUpdateDB(config: any) {
        const circuitBreaker = this.getCircuitBreaker('notion_update_db');
        const result = await circuitBreaker.execute(async () => {
            const credentials = await this.getIntegrationCredentials('notion');
            const { Client } = await import('@notionhq/client');
            const notion = new Client({ auth: credentials.access_token });

            const properties = JSON.parse(config.properties);

            await notion.pages.update({
                page_id: config.pageId,
                properties,
            });

            return {
                success: true,
                pageId: config.pageId,
            };
        });
        return result;
    }
}

export default WorkflowExecutor;
