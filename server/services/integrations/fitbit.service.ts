import axios from 'axios';

const FITBIT_CLIENT_ID = import.meta.env.VITE_FITBIT_CLIENT_ID;
const FITBIT_REDIRECT_URI = import.meta.env.VITE_FITBIT_CALLBACK_URL || 'http://localhost:5173/auth/fitbit/callback';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export interface FitbitAuthUrl {
  authUrl: string;
  state: string;
}

export interface FitbitActivity {
  id: string;
  activityName: string;
  duration: number;
  calories: number;
  distance?: number;
  steps?: number;
  startTime: string;
  metadata?: any;
}

export interface FitbitFood {
  id: string;
  foodName: string;
  mealType: string;
  calories: number;
  carbs: number;
  fat: number;
  protein: number;
  loggedAt: string;
}

/** 
 * Get Fitbit activities for date range 
 */ 
export async function getFitbitActivities(startDate: string, endDate: string): Promise<FitbitActivity[]> { 
  const token = localStorage.getItem('token'); 
  if (!token) throw new Error('No authentication token found'); 

  try { 
    console.log('[FitbitService] Fetching activities from', startDate, 'to', endDate);
    
    const response = await axios.get( 
      `${API_URL}/health/fitbit/activities?startDate=${startDate}&endDate=${endDate}`, 
      { 
        headers: { 
          Authorization: `Bearer ${token}`,
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        } 
      } 
    ); 
    
    console.log('[FitbitService] Activities response:', response.data);
    
    const payload = response.data; 
    
    // Handle different response formats
    if (Array.isArray(payload)) {
      console.log('[FitbitService] Received array of', payload.length, 'activities');
      return payload;
    }
    
    if (payload.activities && Array.isArray(payload.activities)) {
      console.log('[FitbitService] Received activities object with', payload.activities.length, 'items');
      return payload.activities;
    }
    
    console.warn('[FitbitService] Unexpected activities response format:', payload);
    return [];
  } catch (error: any) { 
    console.error('[FitbitService] Error fetching activities:', error.response?.data || error.message); 
    
    if (error.response?.status === 404) {
      console.log('[FitbitService] No activities found for date range');
      return [];
    }
    
    throw new Error('Failed to fetch activities'); 
  } 
} 

/** 
 * Get Fitbit food logs for date range 
 */ 
export async function getFitbitFoods(startDate: string, endDate: string): Promise<Record<string, FitbitFood[]>> { 
  const token = localStorage.getItem('token'); 
  if (!token) throw new Error('No authentication token found'); 

  try { 
    console.log('[FitbitService] Fetching food logs from', startDate, 'to', endDate);
    
    const response = await axios.get( 
      `${API_URL}/health/fitbit/foods?startDate=${startDate}&endDate=${endDate}`, 
      { 
        headers: { 
          Authorization: `Bearer ${token}`,
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        } 
      } 
    ); 

    console.log('[FitbitService] Food logs response:', response.data);
    
    const payload = response.data; 

    // If it's already an object grouped by meal type, return it
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) { 
      console.log('[FitbitService] Received grouped foods:', Object.keys(payload));
      return payload;
    }

    // If it's an array, group by meal type
    if (Array.isArray(payload)) { 
      console.log('[FitbitService] Received array of', payload.length, 'food logs, grouping...');
      const grouped: Record<string, FitbitFood[]> = {}; 
      payload.forEach((f: any) => { 
        const meal = f.mealType || 'Anytime'; 
        if (!grouped[meal]) grouped[meal] = []; 
        grouped[meal].push(f); 
      }); 
      console.log('[FitbitService] Grouped into meals:', Object.keys(grouped));
      return grouped; 
    } 

    console.warn('[FitbitService] Unexpected food logs response format:', payload);
    return {}; 
  } catch (error: any) { 
    console.error('[FitbitService] Error fetching food logs:', error.response?.data || error.message); 
    
    if (error.response?.status === 404) {
      console.log('[FitbitService] No food logs found for date range');
      return {};
    }
    
    throw new Error('Failed to fetch food logs'); 
  } 
}

export interface FitbitHealthData {
  date: string;
  steps: number;
  calories: number;
  distance: number;
  activeMinutes: number;
  heartRate?: number;
  sleep?: {
    totalMinutes: number;
    hours: number;
    stages?: any;
    efficiency?: number;
  } | null;
  water: number;
}

/**
 * Generate Fitbit OAuth authorization URL
 */
export function generateFitbitAuthUrl(): FitbitAuthUrl {
  const state = Math.random().toString(36).substring(7);

  const scopes = [
    'activity',
    'heartrate',
    'sleep',
    'nutrition',
    'weight',
    'profile',
  ].join(' ');

  const authUrl = `https://www.fitbit.com/oauth2/authorize?${new URLSearchParams({
    response_type: 'code',
    client_id: FITBIT_CLIENT_ID,
    redirect_uri: FITBIT_REDIRECT_URI,
    scope: scopes,
    state: state,
  })}`;

  return { authUrl, state };
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeFitbitCode(code: string, token: string): Promise<any> {
  try {
    console.log('[FitbitService] Exchanging code for token');
    const response = await axios.post(
      `${API_URL}/health/fitbit/callback`,
      { code },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    console.log('[FitbitService] Token exchange successful');
    return response.data;
  } catch (error: any) {
    console.error('[FitbitService] Error exchanging Fitbit code:', error.response?.data || error.message);
    throw new Error(error.response?.data?.message || 'Failed to connect Fitbit');
  }
}

/**
 * Check if user has connected Fitbit
 */
export async function checkFitbitConnection(): Promise<boolean> {
  try {
    const token = localStorage.getItem('token');
    if (!token) return false;
    
    const response = await axios.get(`${API_URL}/health/fitbit/status`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data.connected;
  } catch (error) {
    console.error('[FitbitService] Error checking connection:', error);
    return false;
  }
}

/**
 * Disconnect Fitbit account
 */
export async function disconnectFitbit(): Promise<void> {
  try {
    const token = localStorage.getItem('token');
    await axios.delete(`${API_URL}/health/fitbit/disconnect`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (error: any) {
    console.error('[FitbitService] Error disconnecting Fitbit:', error);
    throw new Error('Failed to disconnect Fitbit');
  }
}

/**
 * Sync Fitbit data for a specific date
 */
export async function syncFitbitData(date?: string): Promise<void> {
  const token = localStorage.getItem('token');
  const targetDate = date || new Date().toISOString().split('T')[0];
  
  try {
    console.log('[FitbitService] Syncing data for date:', targetDate);
    
    await axios.post(
      `${API_URL}/health/fitbit/sync`,
      { date: targetDate },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    console.log('[FitbitService] Sync completed for', targetDate);
  } catch (error: any) {
    console.error('[FitbitService] Error syncing Fitbit data:', error.response?.data || error.message);
    
    if (error.response?.data?.error === 'RATE_LIMIT') {
      throw new Error('Rate limit exceeded. Please wait before syncing again.');
    }
    
    throw new Error(error.response?.data?.message || `Failed to sync data for ${targetDate}`);
  }
}

/**
 * Get health data from API for specific date range
 */
export async function getHealthData(startDate: string, endDate: string): Promise<FitbitHealthData[] | null> {
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('No authentication token found');
  }
  
  try {
    console.log('[FitbitService] Fetching health data from', startDate, 'to', endDate);
    
    const response = await axios.get(
      `${API_URL}/health/data/summary?startDate=${startDate}&endDate=${endDate}`,
      {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
      }
    );
    
    console.log('[FitbitService] Received', response.data?.length || 0, 'days of data');
    return response.data;
  } catch (error: any) {
    console.error('[FitbitService] Error fetching health data:', error.response?.data || error.message);
    throw new Error('Failed to fetch health data');
  }
}

/**
 * Analyze health data with AI
 */
export async function analyzeHealthData(prompt: string, data: FitbitHealthData[]): Promise<string> {
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('No authentication token found');
  }
  
  try {
    console.log('[FitbitService] Requesting AI analysis');
    const response = await axios.post(
      `${API_URL}/health/ai-analyze`,
      { prompt, data },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    return response.data.analysis;
  } catch (error: any) {
    console.error('[FitbitService] Error analyzing health data:', error);
    throw new Error('Failed to generate AI analysis');
  }
}