import { Activity, Clock, Flame, MapPin, Heart, TrendingUp } from 'lucide-react';
import { Card, CardHeader, CardContent } from '../UI/Card';
import { useState } from 'react';

interface FitbitActivity {
  id: string;
  activityName: string;
  duration: number;
  calories: number;
  distance?: number;
  steps?: number;
  startTime: string;
  metadata?: any;
}

interface ActivitiesDisplayProps {
  activities: FitbitActivity[];
  totalActiveMinutes: number;
  goal: number;
}

const getActivityGradient = (name: string): string => {
  const lowerName = name.toLowerCase();
  if (lowerName.includes('run')) return 'from-red-500 via-orange-500 to-red-600';
  if (lowerName.includes('walk')) return 'from-green-500 via-teal-500 to-emerald-600';
  if (lowerName.includes('bike') || lowerName.includes('cycle')) return 'from-blue-500 via-cyan-500 to-blue-600';
  if (lowerName.includes('swim')) return 'from-cyan-500 via-blue-500 to-blue-700';
  if (lowerName.includes('yoga') || lowerName.includes('stretch')) return 'from-purple-500 via-pink-500 to-purple-600';
  if (lowerName.includes('weight') || lowerName.includes('strength')) return 'from-orange-600 via-red-600 to-orange-700';
  if (lowerName.includes('sport') || lowerName.includes('badminton')) return 'from-indigo-500 via-purple-500 to-indigo-600';
  return 'from-gray-500 via-gray-600 to-gray-700';
};

const getActivityIcon = (name: string): string => {
  const lowerName = name.toLowerCase();
  if (lowerName.includes('run')) return '🏃';
  if (lowerName.includes('walk')) return '🚶';
  if (lowerName.includes('bike') || lowerName.includes('cycle')) return '🚴';
  if (lowerName.includes('swim')) return '🏊';
  if (lowerName.includes('yoga')) return '🧘';
  if (lowerName.includes('weight') || lowerName.includes('strength')) return '🏋️';
  if (lowerName.includes('sport') || lowerName.includes('badminton')) return '🏸';
  if (lowerName.includes('dance')) return '💃';
  return '🏃';
};

export function ActivitiesDisplay({ activities, totalActiveMinutes, goal }: ActivitiesDisplayProps) {
  const [selectedActivity, setSelectedActivity] = useState<string | null>(null);
  
  const progress = Math.min((totalActiveMinutes / goal) * 100, 100);
  const sortedActivities = [...activities].sort((a, b) => 
    new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
  );

  return (
    <Card className="shadow-xl hover:shadow-2xl transition-all duration-300 border-0 overflow-hidden">
      <div className="bg-gradient-to-r from-green-500 via-teal-500 to-emerald-500 p-1">
        <div className="bg-white rounded-t-lg">
          <CardHeader 
            title="Active Minutes & Activities" 
            icon={<Activity className="w-6 h-6 text-green-600" />}
          />
        </div>
      </div>
      
      <CardContent className="bg-gradient-to-br from-green-50 via-white to-teal-50">
        {/* Enhanced Summary Card */}
        <div className="mb-6 p-6 bg-white rounded-2xl shadow-lg border border-green-100">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg shadow-lg">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="text-3xl font-semibold text-gray-900">
                  {totalActiveMinutes}
                </div>
                <div className="text-gray-600">Active Minutes</div>
              </div>
            </div>
            
            <div className="text-right">
              <div className="text-2xl font-semibold text-gray-700">{goal} min</div>
              <div className="text-xs font-semibold text-gray-500 uppercase">Daily Goal</div>
            </div>
          </div>
          
          <div className="relative w-full bg-gray-200 rounded-full h-4 overflow-hidden shadow-inner mb-3">
            <div
              className="absolute h-4 bg-gradient-to-r from-green-500 via-teal-500 to-emerald-500 rounded-full transition-all duration-700 ease-out shadow-lg"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute inset-0 bg-white opacity-20 animate-pulse"></div>
            </div>
          </div>
          
          <div className="text-center">
            <div className={`text-sm font-bold ${progress >= 100 ? 'text-green-600' : 'text-gray-600'}`}>
              {progress >= 100 ? '🎉 Goal achieved! Keep it up!' : `${Math.round(progress)}% of daily goal`}
            </div>
          </div>
        </div>

        {/* Enhanced Activities List */}
        {sortedActivities.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-4">
              <div className="text-lg font-semibold text-gray-900">
                Activities ({sortedActivities.length})
              </div>
              <div className="px-4 py-2 bg-gradient-to-r from-green-100 to-teal-100 rounded-full">
                <span className="text-sm font-bold text-green-700">Total: {sortedActivities.reduce((sum, a) => sum + a.duration, 0)} min</span>
              </div>
            </div>
            
            {sortedActivities.map((activity) => {
              const gradient = getActivityGradient(activity.activityName);
              const icon = getActivityIcon(activity.activityName);
              const isSelected = selectedActivity === activity.id;
              
              return (
                <div key={activity.id} className="group">
                  <button 
                    onClick={() => setSelectedActivity(isSelected ? null : activity.id)}
                    className={`w-full p-4 bg-white rounded-xl border-2 hover:shadow-xl transition-all duration-300 text-left ${
                      isSelected ? 'border-green-400 shadow-lg scale-[1.02]' : 'border-gray-200 hover:border-green-300'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`flex-shrink-0 w-16 h-16 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center text-3xl shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                        {icon}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-lg text-gray-900 mb-2">{activity.activityName}</div>
                        <div className="flex flex-wrap items-center gap-4 text-sm">
                          <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-100 rounded-full">
                            <Clock className="w-4 h-4 text-blue-600" />
                            <span className="font-semibold text-blue-700">{activity.duration} min</span>
                          </div>
                          <div className="flex items-center gap-1.5 px-3 py-1 bg-orange-100 rounded-full">
                            <Flame className="w-4 h-4 text-orange-600" />
                            <span className="font-semibold text-orange-700">{Math.round(activity.calories)} kcal</span>
                          </div>
                          {activity.distance && (
                            <div className="flex items-center gap-1.5 px-3 py-1 bg-green-100 rounded-full">
                              <MapPin className="w-4 h-4 text-green-600" />
                              <span className="font-semibold text-green-700">{activity.distance.toFixed(2)} km</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex-shrink-0 text-right">
                        <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Started</div>
                        <div className="text-sm font-semibold text-gray-700">
                          {new Date(activity.startTime).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </div>
                    </div>
                  </button>

                  {/* Expanded Details with smooth animation */}
                  {isSelected && (
                    <div className="mt-2 p-5 bg-gradient-to-br from-gray-50 to-white rounded-xl border-2 border-green-200 shadow-lg animate-slideDown">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="p-4 bg-gradient-to-br from-blue-100 to-blue-50 rounded-xl shadow-sm border border-blue-200">
                          <div className="flex items-center gap-2 mb-2">
                            <Clock className="w-5 h-5 text-blue-600" />
                            <span className="text-xs font-bold text-blue-600 uppercase">Duration</span>
                          </div>
                          <div className="text-2xl font-semibold text-blue-700">{activity.duration} min</div>
                        </div>

                        <div className="p-4 bg-gradient-to-br from-orange-100 to-orange-50 rounded-xl shadow-sm border border-orange-200">
                          <div className="flex items-center gap-2 mb-2">
                            <Flame className="w-5 h-5 text-orange-600" />
                            <span className="text-xs font-bold text-orange-600 uppercase">Calories</span>
                          </div>
                          <div className="text-2xl font-semibold text-orange-700">{Math.round(activity.calories)}</div>
                        </div>

                        {activity.distance && (
                          <div className="p-4 bg-gradient-to-br from-green-100 to-green-50 rounded-xl shadow-sm border border-green-200">
                            <div className="flex items-center gap-2 mb-2">
                              <MapPin className="w-5 h-5 text-green-600" />
                              <span className="text-xs font-bold text-green-600 uppercase">Distance</span>
                            </div>
                            <div className="text-2xl font-semibold text-green-700">{activity.distance.toFixed(2)} km</div>
                          </div>
                        )}

                        {activity.steps && (
                          <div className="p-4 bg-gradient-to-br from-purple-100 to-purple-50 rounded-xl shadow-sm border border-purple-200">
                            <div className="flex items-center gap-2 mb-2">
                              <Activity className="w-5 h-5 text-purple-600" />
                              <span className="text-xs font-bold text-purple-600 uppercase">Steps</span>
                            </div>
                            <div className="text-2xl font-semibold text-purple-700">{activity.steps.toLocaleString()}</div>
                          </div>
                        )}

                        {activity.metadata?.averageHeartRate && (
                          <div className="p-4 bg-gradient-to-br from-red-100 to-red-50 rounded-xl shadow-sm border border-red-200">
                            <div className="flex items-center gap-2 mb-2">
                              <Heart className="w-5 h-5 text-red-600" />
                              <span className="text-xs font-bold text-red-600 uppercase">Avg HR</span>
                            </div>
                            <div className="text-2xl font-semibold text-red-700">{activity.metadata.averageHeartRate} bpm</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="inline-block p-3 bg-gradient-to-br from-green-100 to-teal-100 rounded-lg mb-4">
              <Activity className="w-6 h-6 text-green-400" />
            </div>
            <p className="text-gray-600 text-lg font-semibold mb-2">No activities recorded</p>
            <p className="text-sm text-gray-500">Log workouts in the Fitbit app</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}