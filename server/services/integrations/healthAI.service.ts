// src/services/integrations/healthAI.service.ts
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export interface AnalysisSession {
  id: string;
  title: string;
  dateRange: string;
  startDate: string;
  endDate: string;
  createdAt: string;
  messages?: AnalysisMessage[];
}

export interface AnalysisMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  metadata: any;
  mediaUrls?: string[];
  createdAt: string;
}

export interface AnalysisResponse {
  analysis: string;
  message: AnalysisMessage;
  dataInsights: any;
}

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  if (!token) throw new Error('No authentication token found');
  return { Authorization: `Bearer ${token}` };
};

// API Key Management
export async function saveApiKey(
  apiKey: string,
  service: string = 'gemini'
): Promise<void> {
  try {
    await axios.post(
      `${API_URL}/health-ai/api-key`,
      { apiKey, service },
      { headers: getAuthHeaders() }
    );
  } catch (error: any) {
    console.error('[HealthAI] Error saving API key:', error);
    throw new Error(error.response?.data?.message || 'Failed to save API key');
  }
}

export async function checkApiKeyStatus(
  service: string = 'gemini'
): Promise<{ hasKey: boolean; lastUsed?: string }> {
  try {
    const response = await axios.get(
      `${API_URL}/health-ai/api-key/status?service=${service}`,
      { headers: getAuthHeaders() }
    );
    return response.data;
  } catch (error) {
    console.error('[HealthAI] Error checking API key:', error);
    return { hasKey: false };
  }
}

export async function deleteApiKey(service: string = 'gemini'): Promise<void> {
  try {
    await axios.delete(`${API_URL}/health-ai/api-key?service=${service}`, {
      headers: getAuthHeaders(),
    });
  } catch (error: any) {
    console.error('[HealthAI] Error deleting API key:', error);
    throw new Error(error.response?.data?.message || 'Failed to delete API key');
  }
}

// Session Management
export async function createAnalysisSession(
  dateRange: string,
  startDate: string,
  endDate: string,
  title?: string
): Promise<AnalysisSession> {
  try {
    const response = await axios.post(
      `${API_URL}/health-ai/sessions`,
      { dateRange, startDate, endDate, title },
      { headers: getAuthHeaders() }
    );
    return response.data;
  } catch (error: any) {
    console.error('[HealthAI] Error creating session:', error);
    throw new Error(error.response?.data?.message || 'Failed to create session');
  }
}

export async function getAnalysisSessions(): Promise<AnalysisSession[]> {
  try {
    const response = await axios.get(`${API_URL}/health-ai/sessions`, {
      headers: getAuthHeaders(),
    });
    return response.data;
  } catch (error: any) {
    console.error('[HealthAI] Error fetching sessions:', error);
    throw new Error(error.response?.data?.message || 'Failed to fetch sessions');
  }
}

export async function getSessionDetails(
  sessionId: string
): Promise<AnalysisSession> {
  try {
    const response = await axios.get(
      `${API_URL}/health-ai/sessions/${sessionId}`,
      { headers: getAuthHeaders() }
    );
    return response.data;
  } catch (error: any) {
    console.error('[HealthAI] Error fetching session:', error);
    throw new Error(error.response?.data?.message || 'Failed to fetch session');
  }
}

export async function deleteSession(sessionId: string): Promise<void> {
  try {
    await axios.delete(`${API_URL}/health-ai/sessions/${sessionId}`, {
      headers: getAuthHeaders(),
    });
  } catch (error: any) {
    console.error('[HealthAI] Error deleting session:', error);
    throw new Error(error.response?.data?.message || 'Failed to delete session');
  }
}

// AI Analysis
export async function analyzeHealthData(
  sessionId: string,
  message: string,
  startDate: string,
  endDate: string
): Promise<AnalysisResponse> {
  try {
    const response = await axios.post(
      `${API_URL}/health-ai/analyze`,
      { sessionId, message, startDate, endDate },
      { headers: getAuthHeaders() }
    );
    return response.data;
  } catch (error: any) {
    console.error('[HealthAI] Error analyzing data:', error);
    throw new Error(
      error.response?.data?.message || 'Failed to analyze health data'
    );
  }
}
