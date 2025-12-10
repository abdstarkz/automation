// src/services/integrations/personalTime.service.ts
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export async function logPersonalTimeActivity(data: {
  activityType: string;
  duration: number | null;
  date: string;
  notes?: string;
}): Promise<any> {
  const token = localStorage.getItem('token');
  if (!token) throw new Error('No authentication token found');

  try {
    const response = await axios.post(
      `${API_URL}/personal-time/activities`,
      data,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  } catch (error: any) {
    console.error('[PersonalTime] Error logging activity:', error);
    // pass server message if available
    throw new Error(error?.response?.data?.message || 'Failed to log activity');
  }
}

export async function getPersonalTimeActivities(startDate: string, endDate: string): Promise<any[]> {
  const token = localStorage.getItem('token');
  if (!token) throw new Error('No authentication token found');

  try {
    const response = await axios.get(
      `${API_URL}/personal-time/activities?startDate=${startDate}&endDate=${endDate}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  } catch (error: any) {
    console.error('[PersonalTime] Error fetching activities:', error);
    throw new Error(error?.response?.data?.message || 'Failed to fetch activities');
  }
}

/**
 * weeklyGoal: number | null
 * - If null => clear/deactivate goal
 * - If number => set/update goal
 */
export async function setPersonalTimeGoal(activityType: string, weeklyGoal: number | null): Promise<any> {
  const token = localStorage.getItem('token');
  if (!token) throw new Error('No authentication token found');

  try {
    const body = { activityType, weeklyGoal };
    const response = await axios.post(
      `${API_URL}/personal-time/goals`,
      body,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  } catch (error: any) {
    console.error('[PersonalTime] Error setting goal:', error);
    throw new Error(error?.response?.data?.message || 'Failed to set goal');
  }
}

export async function getPersonalTimeGoals(): Promise<any[]> {
  const token = localStorage.getItem('token');
  if (!token) throw new Error('No authentication token found');

  try {
    const response = await axios.get(
      `${API_URL}/personal-time/goals`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  } catch (error: any) {
    console.error('[PersonalTime] Error fetching goals:', error);
    throw new Error(error?.response?.data?.message || 'Failed to fetch goals');
  }
}
