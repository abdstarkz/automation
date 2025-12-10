// src/pages/HealthPage.tsx - COMPLETE ENHANCED VERSION

import { useEffect, useState } from 'react';
import {
  Activity,
  Heart,
  Moon,
  Flame,
  TrendingUp,
  Droplet,
  LinkIcon,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Ruler,
  Calendar as CalendarIcon,
  Award,
  BarChart3,
  User,
  Edit2,
  Save,
  X,
  AlertTriangle,
  Target,
} from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { Button } from '../components/UI/Button';
import { Card, CardHeader, CardContent } from '../components/UI/Card';
import { LoadingSpinner } from '../components/UI/LoadingSpinner';
import { Calendar } from '../components/UI/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../components/UI/popover';
import {
  generateFitbitAuthUrl,
  checkFitbitConnection,
  disconnectFitbit,
  syncFitbitData,
  getHealthData,
  exchangeFitbitCode,
  getFitbitActivities,
  getFitbitFoods,
} from '../../server/services/integrations/fitbit.service';
import {
  logPersonalTimeActivity,
  getPersonalTimeActivities,
  setPersonalTimeGoal,
  getPersonalTimeGoals,
} from '../../server/services/integrations/personalTime.service';
import {
  format,
  subDays,
  addDays,
  startOfDay,
  subWeeks,
  subMonths,
} from 'date-fns';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import { FoodLogDisplay } from '../components/Health/FoodLogDisplay';
import PersonalTimeTracker from '../components/Health/PersonalTimeTracker';
import { ActivitiesDisplay } from '../components/Health/ActivitiesDisplay';
import AIHealthInsights from '../components/Health/AIHealthInsights';

// Helper functions
const METRIC_COLOR_MAP: Record<
  string,
  { tintFrom: string; tintTo: string; accent: string }
> = {
  steps: { tintFrom: '#e6f0ff', tintTo: '#f8fbff', accent: '#2563eb' },
  heart: { tintFrom: '#fff0f0', tintTo: '#fff8f8', accent: '#ef4444' },
  sleep: { tintFrom: '#f3f0ff', tintTo: '#fbf8ff', accent: '#7c3aed' },
  calories: { tintFrom: '#fff6ed', tintTo: '#fffbf5', accent: '#f97316' },
  activeMinutes: { tintFrom: '#f0fff5', tintTo: '#fbfffb', accent: '#16a34a' },
  distance: { tintFrom: '#f6f5ff', tintTo: '#fcfbff', accent: '#7c3aed' },
  water: { tintFrom: '#ecfeff', tintTo: '#f8ffff', accent: '#06b6d4' },
};

const formatSleepTime = (hours: number): string => {
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const min = totalMinutes % 60;
  return `${h}h ${min}min`;
};

// Risk Analysis Helper
interface RiskFlag {
  type:
    | 'sleep_chronic_low'
    | 'sleep_recent_drop'
    | 'resting_hr_rising'
    | 'steps_chronic_low'
    | 'inconsistent_routine';
  severity: 'low' | 'medium' | 'high';
  message: string;
}

function computeRiskFlags(
  weeklyData: any[],
  monthlyData: any[],
  goals: any
): RiskFlag[] {
  const flags: RiskFlag[] = [];

  if (weeklyData.length > 0 && monthlyData.length > 0) {
    // Sleep analysis
    const avgSleep30 =
      monthlyData.reduce((sum, d) => sum + (d.sleep || 0), 0) /
      monthlyData.length;
    const avgSleep7 =
      weeklyData.reduce((sum, d) => sum + (d.sleep || 0), 0) /
      weeklyData.length;

    if (goals.sleep && avgSleep30 < goals.sleep * 0.8) {
      flags.push({
        type: 'sleep_chronic_low',
        severity: 'high',
        message: `Average sleep (${avgSleep30.toFixed(
          1
        )}h) is ${((1 - avgSleep30 / goals.sleep) * 100).toFixed(
          0
        )}% below your goal. This affects recovery and energy.`,
      });
    }

    if (avgSleep7 < avgSleep30 * 0.8) {
      flags.push({
        type: 'sleep_recent_drop',
        severity: 'medium',
        message: `Sleep dropped ${(
          (1 - avgSleep7 / avgSleep30) *
          100
        ).toFixed(0)}% this week. Consider stress management or sleep hygiene.`,
      });
    }

    // Heart rate analysis
    const hrData7 = weeklyData.filter((d) => d.heartRate > 0);
    const hrData14 = monthlyData.slice(0, 14).filter((d) => d.heartRate > 0);
    if (hrData7.length > 3 && hrData14.length > 7) {
      const avgHR7 =
        hrData7.reduce((sum, d) => sum + d.heartRate, 0) / hrData7.length;
      const avgHR14 =
        hrData14.reduce((sum, d) => sum + d.heartRate, 0) / hrData14.length;
      if (avgHR7 > avgHR14 + 5) {
        flags.push({
          type: 'resting_hr_rising',
          severity: 'medium',
          message: `Resting heart rate increased by ${(avgHR7 - avgHR14).toFixed(
            0
          )} bpm. Could indicate stress or overtraining.`,
        });
      }
    }

    // Steps analysis
    const avgSteps30 =
      monthlyData.reduce((sum, d) => sum + (d.steps || 0), 0) /
      monthlyData.length;
    if (goals.steps && avgSteps30 < goals.steps * 0.7) {
      flags.push({
        type: 'steps_chronic_low',
        severity: 'medium',
        message: `Activity is ${((1 - avgSteps30 / goals.steps) * 100).toFixed(
          0
        )}% below goal. Try adding 10-min walks.`,
      });
    }

    // Consistency check
    const sleepVariance =
      monthlyData.reduce((sum, d) => {
        const diff = (d.sleep || 0) - avgSleep30;
        return sum + diff * diff;
      }, 0) / monthlyData.length;

    if (Math.sqrt(sleepVariance) > 1.5) {
      flags.push({
        type: 'inconsistent_routine',
        severity: 'low',
        message:
          'Sleep schedule varies significantly. Consistent timing improves quality.',
      });
    }
  }

  return flags;
}

// Forecasting Helper
interface MetricForecast {
  predicted: number;
  lower: number;
  upper: number;
  trend: 'up' | 'down' | 'flat';
}

function getForecast(data: any[], metric: string): MetricForecast {
  if (data.length < 7) {
    return { predicted: 0, lower: 0, upper: 0, trend: 'flat' };
  }

  const recent = data.slice(-14);
  const values = recent.map((d) => d[metric] || 0);
  const n = values.length;

  const xVals = Array.from({ length: n }, (_, i) => i + 1);
  const sumX = xVals.reduce((a, b) => a + b, 0);
  const sumY = values.reduce((a, b) => a + b, 0);
  const sumXY = xVals.reduce((sum, x, i) => sum + x * values[i], 0);
  const sumX2 = xVals.reduce((sum, x) => sum + x * x, 0);

  const denom = n * sumX2 - sumX * sumX;
  const m =
    denom === 0 ? 0 : (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const b = (sumY - m * sumX) / n;

  const predicted = m * (n + 1) + b;
  const avg = sumY / n;
  const margin = avg * 0.15;

  return {
    predicted: Math.max(0, predicted),
    lower: Math.max(0, predicted - margin),
    upper: predicted + margin,
    trend: m > 0.5 ? 'up' : m < -0.5 ? 'down' : 'flat',
  };
}

export function HealthPage() {
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [healthData, setHealthData] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const [showInsights, setShowInsights] = useState(false);
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const toast = useToast();

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [userProfile, setUserProfile] = useState({
    height: 0,
    weight: 0,
    age: 0,
    gender: 'male',
    bmi: 0,
  });

  const [goals, setGoals] = useState({
    steps: 8000,
    sleep: 8,
    calories: 2000,
    activeMinutes: 30,
    water: 4000,
    distance: 8,
  });

  const [fitbitActivities, setFitbitActivities] = useState<any[]>([]);
  const [fitbitFoods, setFitbitFoods] = useState<any>({});
  const [personalTimeData, setPersonalTimeData] = useState<any[]>([]);
  const [personalTimeGoals, setPersonalTimeGoals] = useState<any[]>([]);
  const [streak, setStreak] = useState(0);
  const [riskFlags, setRiskFlags] = useState<RiskFlag[]>([]);
  const [forecast, setForecast] = useState<Record<string, MetricForecast>>({});

  const [editingGoals, setEditingGoals] = useState(false);
  const [tempGoals, setTempGoals] = useState(goals);

  // Cache helpers
  const getCacheKey = (date: Date) => `fitbit_data_${format(date, 'yyyy-MM-dd')}`;

  const getCachedData = (date: Date): any | null => {
    try {
      const cached = localStorage.getItem(getCacheKey(date));
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.timestamp < 1800000) return parsed.data;
      }
    } catch (error) {
      console.error('[Cache] Error reading cache:', error);
    }
    return null;
  };

  const setCachedData = (date: Date, data: any) => {
    try {
      localStorage.setItem(
        getCacheKey(date),
        JSON.stringify({ timestamp: Date.now(), data })
      );
    } catch (error) {
      console.error('[Cache] Error writing cache:', error);
    }
  };

  // Load profile and goals
  useEffect(() => {
    const savedProfile = localStorage.getItem('user_profile');
    if (savedProfile) setUserProfile(JSON.parse(savedProfile));
    const savedGoals = localStorage.getItem('health_goals');
    if (savedGoals) setGoals(JSON.parse(savedGoals));
  }, []);

  useEffect(() => {
    setTempGoals(goals);
  }, [goals]);

  // Compute risk and forecast when data changes
  useEffect(() => {
    if (weeklyData.length > 0 && monthlyData.length > 0) {
      const flags = computeRiskFlags(weeklyData, monthlyData, goals);
      setRiskFlags(flags);

      const forecasts: Record<string, MetricForecast> = {
        steps: getForecast(monthlyData, 'steps'),
        sleep: getForecast(monthlyData, 'sleep'),
        calories: getForecast(monthlyData, 'calories'),
        activeMinutes: getForecast(monthlyData, 'activeMinutes'),
      };
      setForecast(forecasts);
    }
  }, [weeklyData, monthlyData, goals]);

  const fetchHealthDataForDate = async (
    date: Date,
    forceSync: boolean = false
  ) => {
    setLoading(true);
    try {
      const dateString = format(date, 'yyyy-MM-dd');

      if (!forceSync) {
        const cached = getCachedData(date);
        if (cached) setHealthData([cached]);
      }

      const data = await getHealthData(dateString, dateString);
      if (data && data.length > 0) {
        setHealthData(data);
        setCachedData(date, data[0]);
      } else {
        setHealthData([
          {
            date: dateString,
            steps: 0,
            calories: 0,
            activeMinutes: 0,
            heartRate: 0,
            sleep: 0,
            water: 0,
            distance: 0,
          },
        ]);
      }

      try {
        const activitiesResp = await getFitbitActivities(dateString, dateString);
        setFitbitActivities(Array.isArray(activitiesResp) ? activitiesResp : []);
      } catch {
        setFitbitActivities([]);
      }

      try {
        const foodsResp = await getFitbitFoods(dateString, dateString);
        setFitbitFoods(foodsResp || {});
      } catch {
        setFitbitFoods({});
      }

      try {
        const personalTime = await getPersonalTimeActivities(
          dateString,
          dateString
        );
        setPersonalTimeData(personalTime || []);
      } catch {
        setPersonalTimeData([]);
      }

      try {
        const goalsResp = await getPersonalTimeGoals();
        setPersonalTimeGoals(goalsResp || []);
      } catch {
        setPersonalTimeGoals([]);
      }
    } catch (error: any) {
      console.error('[Health] Error fetching data:', error);
      toast.error(error.message || 'Failed to fetch health data');
    } finally {
      setLoading(false);
    }
  };

  const fetchInsightsData = async () => {
    try {
      const today = new Date();
      const weekAgo = subWeeks(today, 1);
      const monthAgo = subMonths(today, 1);
      const weekData = await getHealthData(
        format(weekAgo, 'yyyy-MM-dd'),
        format(today, 'yyyy-MM-dd')
      );
      const monthData = await getHealthData(
        format(monthAgo, 'yyyy-MM-dd'),
        format(today, 'yyyy-MM-dd')
      );
      const safeWeek = weekData || [];
      const safeMonth = monthData || [];
      setWeeklyData(safeWeek);
      setMonthlyData(safeMonth);
      calculateStreak(safeWeek);
    } catch (error) {
      console.error('[Insights] Error fetching insights data:', error);
    }
  };

  const calculateStreak = (data: any[]) => {
    let currentStreak = 0;
    const sortedData = [...data].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    for (const day of sortedData) {
      const meetsGoals =
        day.steps >= goals.steps &&
        day.sleep >= goals.sleep &&
        day.activeMinutes >= goals.activeMinutes;
      if (meetsGoals) currentStreak++;
      else break;
    }
    setStreak(currentStreak);
  };

  // Initial load
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const connected = await checkFitbitConnection();
        setIsConnected(connected);
        if (connected) {
          await fetchHealthDataForDate(new Date());
          await fetchInsightsData();
        }
      } catch (error) {
        toast.error('Failed to initialize health dashboard');
      } finally {
        setLoading(false);
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle Fitbit OAuth callback
  useEffect(() => {
    const handleFitbitCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');
      const storedState = localStorage.getItem('fitbit_oauth_state');
      const token = localStorage.getItem('token');
      if (code && state && storedState === state && token) {
        setLoading(true);
        try {
          await exchangeFitbitCode(code, token);
          toast.success('Fitbit connected successfully!');
          const connected = await checkFitbitConnection();
          setIsConnected(connected);
          if (connected) {
            await fetchHealthDataForDate(new Date(), true);
            await fetchInsightsData();
          }
        } catch (error: any) {
          toast.error(error.message || 'Failed to connect Fitbit');
        } finally {
          setLoading(false);
          localStorage.removeItem('fitbit_oauth_state');
          window.history.replaceState(
            {},
            document.title,
            window.location.pathname
          );
        }
      }
    };
    handleFitbitCallback();
  }, [toast]);

  const handlePreviousDay = async () => {
    const previousDay = subDays(selectedDate, 1);
    setSelectedDate(previousDay);
    await fetchHealthDataForDate(previousDay);
  };

  const handleNextDay = async () => {
    const nextDay = addDays(selectedDate, 1);
    const today = startOfDay(new Date());
    const nextDayStart = startOfDay(nextDay);
    if (nextDayStart <= today) {
      setSelectedDate(nextDay);
      await fetchHealthDataForDate(nextDay);
    } else {
      toast.error('Cannot view future dates');
    }
  };

  const handleToday = async () => {
    const today = new Date();
    setSelectedDate(today);
    await fetchHealthDataForDate(today);
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const dateString = format(selectedDate, 'yyyy-MM-dd');
      await syncFitbitData(dateString);
      localStorage.removeItem(getCacheKey(selectedDate));
      await fetchHealthDataForDate(selectedDate, true);
      await fetchInsightsData();
      toast.success('Data synced successfully!');
    } catch (error: any) {
      if (error.message && error.message.includes('Rate limit')) {
        toast.error('Rate limit exceeded. Please wait before syncing again.');
      } else {
        toast.error('Failed to sync data');
      }
    } finally {
      setSyncing(false);
    }
  };

  const handleDateSelect = async (date: Date | undefined) => {
    if (date) {
      const today = startOfDay(new Date());
      const selected = startOfDay(date);
      if (selected <= today) {
        setSelectedDate(date);
        setCalendarOpen(false);
        await fetchHealthDataForDate(date);
      } else {
        toast.error('Cannot select future dates');
      }
    }
  };

  const handleConnectFitbit = () => {
    const { authUrl, state } = generateFitbitAuthUrl();
    localStorage.setItem('fitbit_oauth_state', state);
    window.location.href = authUrl;
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Fitbit?')) return;
    try {
      await disconnectFitbit();
      setIsConnected(false);
      setHealthData([]);
      setFitbitActivities([]);
      setFitbitFoods({});
      setPersonalTimeData([]);
      toast.success('Fitbit disconnected successfully');
    } catch (error: any) {
      toast.error(error.message || String(error));
    }
  };

  const handleSaveGoals = () => {
    setGoals(tempGoals);
    localStorage.setItem('health_goals', JSON.stringify(tempGoals));
    setEditingGoals(false);
    toast.success('Goals updated successfully!');
  };

  const handleLogPersonalTime = async (
    activityType: string,
    duration: number | null
  ) => {
    try {
      await logPersonalTimeActivity({
        activityType,
        duration,
        date: format(selectedDate, 'yyyy-MM-dd'),
      });
      await fetchHealthDataForDate(selectedDate);
      toast.success(duration === null ? 'Activity cleared' : 'Activity logged!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to log activity');
    }
  };

  const handleSetPersonalTimeGoal = async (
    activityType: string,
    weeklyGoal: number | null
  ) => {
    try {
      await setPersonalTimeGoal(activityType, weeklyGoal);
      const goalsResp = await getPersonalTimeGoals();
      setPersonalTimeGoals(goalsResp || []);
      toast.success(weeklyGoal === null ? 'Goal cleared' : 'Goal updated!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to set goal');
    }
  };

  if (loading && !isConnected) {
    return <LoadingSpinner fullScreen text="Loading health data..." />;
  }

  if (!isConnected) {
    return (
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-gray-900 mb-2">
            Health Dashboard
          </h1>
          <p className="text-gray-600">
            Connect your Fitbit to track health metrics
          </p>
        </div>
        <Card className="shadow-lg">
          <CardContent className="py-12">
            <div className="text-center max-w-md mx-auto">
              <div className="p-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg mx-auto mb-6 shadow-lg w-12 h-12 flex items-center justify-center">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                Connect Fitbit
              </h2>
              <p className="text-gray-600 mb-8">
                Track your steps, heart rate, sleep, calories, and more by
                connecting your Fitbit account.
              </p>
              <Button
                onClick={handleConnectFitbit}
                size="lg"
                className="shadow-lg hover:shadow-xl transition-all"
              >
                <LinkIcon className="w-5 h-5 mr-2" />
                Connect with Fitbit
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentDayData = healthData.length > 0 ? healthData[0] : null;
  const today = startOfDay(new Date());
  const selectedDateStart = startOfDay(selectedDate);
  const canGoNext = selectedDateStart < today;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="w-full max-w-[1800px] mx-auto px-4 md:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-4 gap-4">
            <div>
              <h1 className="text-3xl font-semibold text-gray-900 mb-1">
                Health Dashboard
              </h1>
              <p className="text-gray-600">Your health metrics from Fitbit</p>
              {userProfile.bmi > 0 && (
                <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/80 shadow-sm border border-gray-200 text-xs">
                  <span className="font-semibold text-purple-600">
                    BMI {userProfile.bmi.toFixed(1)}
                  </span>
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2 md:gap-3">
              <Button
                onClick={() => setShowProfileModal(true)}
                variant="outline"
                size="sm"
              >
                <User className="w-4 h-4 mr-1" />
                Profile
              </Button>
              <Button
                onClick={() => {
                  setShowInsights(!showInsights);
                  if (!showInsights) fetchInsightsData();
                }}
                variant="outline"
                size="sm"
              >
                <BarChart3 className="w-4 h-4 mr-1" />
                Insights
              </Button>
              <Button
                onClick={handleSync}
                loading={syncing}
                variant="secondary"
                size="sm"
              >
                <RefreshCw className="w-4 h-4 mr-1" />
                Sync
              </Button>
              <Button
                onClick={handleDisconnect}
                variant="destructive"
                size="sm"
              >
                Disconnect
              </Button>
            </div>
          </div>

          {/* Date controls */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 bg-white p-3 sm:p-4 rounded-xl shadow-md">
            <Button onClick={handlePreviousDay} variant="outline" size="sm">
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div className="text-center min-w-[180px] sm:min-w-[250px]">
              <div className="text-lg sm:text-2xl font-semibold text-gray-900">
                {format(selectedDate, 'EEEE, MMMM d, yyyy')}
              </div>
              <div className="text-xs sm:text-sm text-blue-600 font-medium">
                {format(selectedDate, 'yyyy-MM-dd') ===
                format(new Date(), 'yyyy-MM-dd')
                  ? '● Today'
                  : ''}
              </div>
            </div>
            <Button
              onClick={handleNextDay}
              variant="outline"
              size="sm"
              disabled={!canGoNext}
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
            <Button onClick={handleToday} variant="outline" size="sm">
              Today
            </Button>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <CalendarIcon className="w-4 h-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 shadow-xl" align="end">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={handleDateSelect}
                  disabled={(date) => date > new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Streak banner */}
          {streak > 0 && (
            <div className="mt-4 bg-gradient-to-r from-orange-500 to-pink-500 p-4 rounded-xl shadow-2xl text-white text-center">
              <div className="flex items-center justify-center gap-2">
                <Award className="w-6 h-6" />
                <span className="text-lg font-bold">{streak} Day Streak! 🔥</span>
              </div>
              <p className="text-sm opacity-90 mt-1">
                Keep hitting your daily goals!
              </p>
            </div>
          )}

          {/* Risk alerts (compact) */}
          {riskFlags.length > 0 && !showInsights && (
            <div className="mt-4 space-y-2">
              {riskFlags.slice(0, 2).map((flag, idx) => (
                <div
                  key={idx}
                  className={`flex items-start gap-3 p-3 rounded-lg border ${
                    flag.severity === 'high'
                      ? 'bg-red-50 border-red-200'
                      : flag.severity === 'medium'
                      ? 'bg-yellow-50 border-yellow-200'
                      : 'bg-blue-50 border-blue-200'
                  }`}
                >
                  <AlertTriangle
                    className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                      flag.severity === 'high'
                        ? 'text-red-600'
                        : flag.severity === 'medium'
                        ? 'text-yellow-600'
                        : 'text-blue-600'
                    }`}
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {flag.message}
                    </p>
                  </div>
                </div>
              ))}
              {riskFlags.length > 2 && (
                <button
                  onClick={() => setShowInsights(true)}
                  className="text-xs text-purple-600 hover:underline"
                >
                  View all {riskFlags.length} insights →
                </button>
              )}
            </div>
          )}

          {/* Tomorrow forecast (compact) */}
          {forecast.steps && !showInsights && (
            <div className="mt-4 bg-gradient-to-r from-purple-50 to-blue-50 p-4 rounded-xl border border-purple-200">
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-5 h-5 text-purple-600" />
                <h3 className="text-sm font-semibold text-gray-900">
                  Tomorrow&apos;s Forecast
                </h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                {[
                  {
                    key: 'steps',
                    label: 'Steps',
                    format: (v: number) => Math.round(v).toLocaleString(),
                  },
                  {
                    key: 'sleep',
                    label: 'Sleep',
                    format: (v: number) => formatSleepTime(v),
                  },
                  {
                    key: 'calories',
                    label: 'Calories',
                    format: (v: number) => Math.round(v).toLocaleString(),
                  },
                  {
                    key: 'activeMinutes',
                    label: 'Active',
                    format: (v: number) => `${Math.round(v)} min`,
                  },
                ].map(({ key, label, format }) => {
                  const f = forecast[key];
                  if (!f) return null;
                  return (
                    <div
                      key={key}
                      className="bg-white rounded-lg p-2 shadow-sm"
                    >
                      <div className="text-gray-600 text-[10px]">{label}</div>
                      <div className="font-bold text-purple-700">
                        {format(f.predicted)}
                      </div>
                      <div className="text-[9px] text-gray-500">
                        {f.trend === 'up'
                          ? '↗ Improving'
                          : f.trend === 'down'
                          ? '↘ Declining'
                          : '→ Stable'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Main content area */}
        {showInsights ? (
          <div className="space-y-6">
            {/* Insights view */}
            <Card className="shadow-lg">
              <CardHeader title="Health Insights & Analysis" />
              <CardContent>
                {/* Risk section */}
                {riskFlags.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-orange-600" />
                      Health Status & Risks
                    </h3>
                    <div className="space-y-2">
                      {riskFlags.map((flag, idx) => (
                        <div
                          key={idx}
                          className={`p-4 rounded-lg border ${
                            flag.severity === 'high'
                              ? 'bg-red-50 border-red-200'
                              : flag.severity === 'medium'
                              ? 'bg-yellow-50 border-yellow-200'
                              : 'bg-blue-50 border-blue-200'
                          }`}
                        >
                          <p className="text-sm text-gray-900">
                            {flag.message}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Forecast section */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-green-600" />
                    7-Day Forecast
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {Object.entries(forecast).map(([key, f]) => (
                      <div
                        key={key}
                        className="p-4 bg-white rounded-lg shadow-sm border border-gray-200"
                      >
                        <div className="text-xs text-gray-600 capitalize">
                          {key.replace(/([A-Z])/g, ' $1')}
                        </div>
                        <div className="text-xl font-bold text-gray-900 mt-1">
                          {key === 'sleep'
                            ? formatSleepTime(f.predicted)
                            : Math.round(f.predicted).toLocaleString()}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Range:{' '}
                          {key === 'sleep'
                            ? formatSleepTime(f.lower)
                            : Math.round(f.lower).toLocaleString()}{' '}
                          -{' '}
                          {key === 'sleep'
                            ? formatSleepTime(f.upper)
                            : Math.round(f.upper).toLocaleString()}
                        </div>
                        <div
                          className={`text-xs mt-2 font-medium ${
                            f.trend === 'up'
                              ? 'text-green-600'
                              : f.trend === 'down'
                              ? 'text-red-600'
                              : 'text-gray-600'
                          }`}
                        >
                          {f.trend === 'up'
                            ? '↗ Improving'
                            : f.trend === 'down'
                            ? '↘ Declining'
                            : '→ Stable'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Goals management */}
                <div className="border-t pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Health Goals
                    </h3>
                    {!editingGoals ? (
                      <Button
                        onClick={() => setEditingGoals(true)}
                        variant="outline"
                        size="sm"
                      >
                        <Edit2 className="w-4 h-4 mr-2" />
                        Edit
                      </Button>
                    ) : (
                      <div className="flex gap-2">
                        <Button onClick={handleSaveGoals} size="sm">
                          <Save className="w-4 h-4 mr-2" />
                          Save
                        </Button>
                        <Button
                          onClick={() => setEditingGoals(false)}
                          variant="outline"
                          size="sm"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {[
                      { key: 'steps', label: 'Steps', unit: 'steps' },
                      { key: 'sleep', label: 'Sleep', unit: 'hours' },
                      { key: 'activeMinutes', label: 'Active Min', unit: 'min' },
                      { key: 'calories', label: 'Calories', unit: 'kcal' },
                      { key: 'water', label: 'Water', unit: 'ml' },
                      { key: 'distance', label: 'Distance', unit: 'km' },
                    ].map(({ key, label, unit }) => (
                      <div key={key} className="p-4 bg-gray-50 rounded-lg">
                        <div className="text-sm font-medium text-gray-700 mb-2">
                          {label}
                        </div>
                        {editingGoals ? (
                          <input
                            type="number"
                            value={tempGoals[key as keyof typeof tempGoals]}
                            onChange={(e) =>
                              setTempGoals({
                                ...tempGoals,
                                [key]: parseInt(e.target.value) || 0,
                              })
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          />
                        ) : (
                          <div className="text-2xl font-bold text-purple-600">
                            {goals[key as keyof typeof goals]}{' '}
                            <span className="text-sm text-gray-500">
                              {unit}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Charts */}
                <div className="mt-6 space-y-6">
                  {weeklyData.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">
                        7-Day Comparison
                      </h4>
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={weeklyData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="date"
                            tickFormatter={(date) =>
                              format(new Date(date), 'EEE')
                            }
                          />
                          <YAxis yAxisId="left" />
                          <YAxis yAxisId="right" orientation="right" />
                          <Tooltip />
                          <Legend />
                          <Bar
                            yAxisId="left"
                            dataKey="steps"
                            fill="#2563eb"
                            name="Steps"
                          />
                          <Bar
                            yAxisId="right"
                            dataKey="activeMinutes"
                            fill="#16a34a"
                            name="Active Min"
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {monthlyData.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">
                        30-Day Trends
                      </h4>
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={monthlyData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="date"
                            tickFormatter={(date) =>
                              format(new Date(date), 'MMM d')
                            }
                          />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Line
                            type="monotone"
                            dataKey="steps"
                            stroke="#2563eb"
                            strokeWidth={2}
                          />
                          <Line
                            type="monotone"
                            dataKey="calories"
                            stroke="#f97316"
                            strokeWidth={2}
                          />
                          <Line
                            type="monotone"
                            dataKey="activeMinutes"
                            stroke="#16a34a"
                            strokeWidth={2}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          // Split layout with scrolling + right AI panel
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left column - scrollable main content */}
            <div className="flex-1 min-w-0 lg:max-h-[calc(100vh-200px)] lg:overflow-y-auto lg:pr-2">
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <LoadingSpinner text="Loading health data..." />
                </div>
              ) : currentDayData ? (
                <div className="space-y-6">
                  {/* Metrics grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                    {[
                      {
                        key: 'steps',
                        label: 'Steps',
                        value:
                          currentDayData?.steps?.toLocaleString() || '0',
                        unit: 'steps',
                        goal: goals.steps.toLocaleString(),
                        progress: Math.min(
                          ((currentDayData?.steps || 0) / goals.steps) * 100,
                          100
                        ),
                        icon: Activity,
                      },
                      {
                        key: 'heart',
                        label: 'Heart Rate',
                        value: currentDayData?.heartRate
                          ? `${currentDayData.heartRate}`
                          : '0',
                        unit: 'BPM',
                        goal: 'Avg',
                        progress: currentDayData?.heartRate ? 75 : 0,
                        icon: Heart,
                      },
                      {
                        key: 'sleep',
                        label: 'Sleep',
                        value: currentDayData?.sleep
                          ? formatSleepTime(currentDayData.sleep)
                          : '0',
                        unit: 'hours',
                        goal: `${goals.sleep}h`,
                        progress: Math.min(
                          ((currentDayData?.sleep || 0) / goals.sleep) * 100,
                          100
                        ),
                        icon: Moon,
                      },
                      {
                        key: 'calories',
                        label: 'Calories',
                        value:
                          currentDayData?.calories?.toLocaleString() ||
                          '0',
                        unit: 'kcal',
                        goal: goals.calories.toLocaleString(),
                        progress: Math.min(
                          ((currentDayData?.calories || 0) /
                            goals.calories) *
                            100,
                          100
                        ),
                        icon: Flame,
                      },
                      {
                        key: 'activeMinutes',
                        label: 'Active Minutes',
                        value:
                          currentDayData?.activeMinutes?.toString() ||
                          '0',
                        unit: 'min',
                        goal: goals.activeMinutes.toString(),
                        progress: Math.min(
                          ((currentDayData?.activeMinutes || 0) /
                            goals.activeMinutes) *
                            100,
                          100
                        ),
                        icon: TrendingUp,
                      },
                      {
                        key: 'distance',
                        label: 'Distance',
                        value:
                          currentDayData?.distance?.toFixed(2) || '0',
                        unit: 'km',
                        goal: goals.distance.toString(),
                        progress: Math.min(
                          ((currentDayData?.distance || 0) /
                            goals.distance) *
                            100,
                          100
                        ),
                        icon: Ruler,
                      },
                      {
                        key: 'water',
                        label: 'Water',
                        value: currentDayData?.water
                          ? `${(currentDayData.water / 1000).toFixed(1)}`
                          : '0',
                        unit: 'liters',
                        goal: `${goals.water / 1000}L`,
                        progress: Math.min(
                          ((currentDayData?.water || 0) /
                            goals.water) *
                            100,
                          100
                        ),
                        icon: Droplet,
                      },
                    ].map((metric) => {
                      const Icon = metric.icon;
                      const colors =
                        METRIC_COLOR_MAP[metric.key] || {
                          tintFrom: '#f3f4f6',
                          tintTo: '#ffffff',
                          accent: '#6b7280',
                        };

                      return (
                        <div key={metric.key} className="relative group">
                          <div
                            className="transform transition-all duration-300 hover:-translate-y-1 hover:scale-[1.01] rounded-xl"
                            style={{
                              background: `linear-gradient(180deg, ${colors.tintFrom}, ${colors.tintTo})`,
                              boxShadow: `0 4px 12px rgba(0,0,0,0.08)`,
                            }}
                          >
                            <Card className="bg-transparent shadow-none">
                              <CardContent className="py-4 px-5">
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-4">
                                    <div
                                      style={{
                                        width: 48,
                                        height: 48,
                                        borderRadius: 12,
                                        display: 'grid',
                                        placeItems: 'center',
                                        background: colors.accent,
                                        color: 'white',
                                      }}
                                    >
                                      <Icon className="w-5 h-5 text-white" />
                                    </div>
                                    <div>
                                      <div className="text-base font-bold text-gray-900">
                                        {metric.label}
                                      </div>
                                      <div className="text-xs text-gray-600">
                                        Goal:{' '}
                                        <span className="font-semibold">
                                          {metric.goal}
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="text-right">
                                    <div className="text-2xl font-bold text-gray-900">
                                      {metric.value}
                                      <span className="text-sm text-gray-500 ml-1">
                                        {metric.unit}
                                      </span>
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">
                                      {Math.round(metric.progress)}%
                                    </div>
                                  </div>
                                </div>

                                <div className="w-full bg-white/70 rounded-full h-2 overflow-hidden">
                                  <div
                                    className="h-2 rounded-full transition-all duration-500"
                                    style={{
                                      width: `${metric.progress}%`,
                                      background: colors.accent,
                                    }}
                                  />
                                </div>
                              </CardContent>
                            </Card>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Food, Activities, Personal Time */}
                  <FoodLogDisplay
                    foodsByMeal={fitbitFoods}
                    totalCalories={Object.values(fitbitFoods || {})
                      .flat()
                      .reduce(
                        (sum: number, food: any) =>
                          sum + (food.calories || 0),
                        0
                      )}
                    caloriesBurned={currentDayData?.calories || 0}
                    calorieGoal={goals.calories}
                  />

                  <ActivitiesDisplay
                    activities={fitbitActivities}
                    totalActiveMinutes={fitbitActivities.reduce(
                      (sum, act) => sum + (act.duration || 0),
                      0
                    )}
                    goal={goals.activeMinutes}
                  />

                  <PersonalTimeTracker
                    activities={personalTimeData.map((act: any) => ({
                      activityType: act.activityType,
                      totalMinutes: act.duration ?? 0,
                      weeklyGoal: act.weeklyGoal ?? null,
                    }))}
                    personalTimeGoals={personalTimeGoals}
                    onLogActivity={handleLogPersonalTime}
                    onSetGoal={handleSetPersonalTimeGoal}
                  />
                </div>
              ) : (
                <div className="bg-white p-12 rounded-xl shadow-lg text-center">
                  <p className="text-gray-500 text-lg">
                    No health data available for{' '}
                    {format(selectedDate, 'MMMM d, yyyy')}.
                  </p>
                  <Button onClick={handleSync} className="mt-4">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Sync Data
                  </Button>
                </div>
              )}
            </div>

            {/* Right column - sticky AI panel */}
            <div className="lg:w-[420px] flex-shrink-0 lg:sticky lg:top-6 lg:self-start lg:max-h-[calc(100vh-80px)]">
              <AIHealthInsights />
            </div>
          </div>
        )}
      </div>

      {/* Profile Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                User Profile
              </h2>
              <button
                onClick={() => setShowProfileModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Height (cm)
                </label>
                <input
                  type="number"
                  value={userProfile.height || ''}
                  onChange={(e) =>
                    setUserProfile({
                      ...userProfile,
                      height: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  placeholder="170"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Weight (kg)
                </label>
                <input
                  type="number"
                  value={userProfile.weight || ''}
                  onChange={(e) =>
                    setUserProfile({
                      ...userProfile,
                      weight: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  placeholder="70"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Age
                </label>
                <input
                  type="number"
                  value={userProfile.age || ''}
                  onChange={(e) =>
                    setUserProfile({
                      ...userProfile,
                      age: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  placeholder="25"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Gender
                </label>
                <select
                  value={userProfile.gender}
                  onChange={(e) =>
                    setUserProfile({
                      ...userProfile,
                      gender: e.target.value,
                    })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {userProfile.height > 0 && userProfile.weight > 0 && (
                <div className="p-4 bg-purple-50 rounded-lg">
                  <p className="text-sm text-gray-600">BMI</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {(
                      userProfile.weight /
                      Math.pow(userProfile.height / 100, 2)
                    ).toFixed(1)}
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <Button
                  onClick={() => {
                    let updatedProfile = { ...userProfile };
                    if (
                      userProfile.height > 0 &&
                      userProfile.weight > 0
                    ) {
                      const bmi =
                        userProfile.weight /
                        Math.pow(userProfile.height / 100, 2);
                      updatedProfile = {
                        ...userProfile,
                        bmi: parseFloat(bmi.toFixed(1)),
                      };
                      setUserProfile(updatedProfile);
                    }
                    localStorage.setItem(
                      'user_profile',
                      JSON.stringify(updatedProfile)
                    );
                    setShowProfileModal(false);
                    toast.success('Profile saved!');
                  }}
                  className="flex-1"
                >
                  Save Profile
                </Button>
                <Button
                  onClick={() => setShowProfileModal(false)}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default HealthPage;
