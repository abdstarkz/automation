// server/lib/healthAnalytics.ts

export interface RiskFlag {
  type: 'sleep_chronic_low' | 'sleep_recent_drop' | 'resting_hr_rising' | 'steps_chronic_low' | 'inconsistent_routine';
  severity: 'low' | 'medium' | 'high';
  message: string;
}

export interface MetricForecast {
  predicted: number;
  lower: number;
  upper: number;
  trend: 'up' | 'down' | 'flat';
}

export function computeRiskFlags(
  weeklyData: any[],
  monthlyData: any[],
  goals: any
): RiskFlag[] {
  const flags: RiskFlag[] = [];
  
  if (weeklyData.length > 0 && monthlyData.length > 0) {
    // Sleep chronic low
    const avgSleep30 = monthlyData.reduce((sum, d) => sum + (d.sleep || 0), 0) / monthlyData.length;
    if (avgSleep30 < goals.sleep * 0.8) {
      flags.push({
        type: 'sleep_chronic_low',
        severity: 'high',
        message: `Average sleep (${avgSleep30.toFixed(1)}h) is ${((1 - avgSleep30/goals.sleep) * 100).toFixed(0)}% below goal`
      });
    }
    
    // Recent sleep drop
    const avgSleep7 = weeklyData.reduce((sum, d) => sum + (d.sleep || 0), 0) / weeklyData.length;
    if (avgSleep7 < avgSleep30 * 0.8) {
      flags.push({
        type: 'sleep_recent_drop',
        severity: 'medium',
        message: `Sleep dropped ${((1 - avgSleep7/avgSleep30) * 100).toFixed(0)}% this week`
      });
    }
    
    // Rising heart rate
    const hrData7 = weeklyData.filter(d => d.heartRate > 0);
    const hrData14 = monthlyData.slice(0, 14).filter(d => d.heartRate > 0);
    if (hrData7.length > 3 && hrData14.length > 7) {
      const avgHR7 = hrData7.reduce((sum, d) => sum + d.heartRate, 0) / hrData7.length;
      const avgHR14 = hrData14.reduce((sum, d) => sum + d.heartRate, 0) / hrData14.length;
      if (avgHR7 > avgHR14 + 5) {
        flags.push({
          type: 'resting_hr_rising',
          severity: 'medium',
          message: `Resting HR increased by ${(avgHR7 - avgHR14).toFixed(0)} bpm`
        });
      }
    }
    
    // Steps chronic low
    const avgSteps30 = monthlyData.reduce((sum, d) => sum + (d.steps || 0), 0) / monthlyData.length;
    if (avgSteps30 < goals.steps * 0.7) {
      flags.push({
        type: 'steps_chronic_low',
        severity: 'medium',
        message: `Activity ${((1 - avgSteps30/goals.steps) * 100).toFixed(0)}% below goal`
      });
    }
  }
  
  return flags;
}

export function getForecast(data: any[], metric: string): MetricForecast {
  if (data.length < 7) {
    return { predicted: 0, lower: 0, upper: 0, trend: 'flat' };
  }
  
  const recent = data.slice(-14); const values = recent.map(d => d[metric] || 0);
const n = values.length;
// Linear regression
const xVals = Array.from({ length: n }, (_, i) => i + 1);
const sumX = xVals.reduce((a, b) => a + b, 0);
const sumY = values.reduce((a, b) => a + b, 0);
const sumXY = xVals.reduce((sum, x, i) => sum + x * values[i], 0);
const sumX2 = xVals.reduce((sum, x) => sum + x * x, 0);
const m = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
const b = (sumY - m * sumX) / n;
const predicted = m * (n + 1) + b;
const avg = sumY / n;
const margin = avg * 0.15;
return {
predicted: Math.max(0, predicted),
lower: Math.max(0, predicted - margin),
upper: predicted + margin,
trend: m > 0.5 ? 'up' : m < -0.5 ? 'down' : 'flat'
};
}