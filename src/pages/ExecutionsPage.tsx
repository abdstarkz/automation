// src/pages/ExecutionsPage.tsx
import { useEffect, useState } from 'react';
import { Clock, Activity, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

type Execution = {
  id: string;
  workflowId: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  errorMessage: string | null;
  workflow: { id: string; name: string };
};

export function ExecutionsPage() {
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);

  const loadExecutions = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/executions?limit=10`, {
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to fetch executions');
      }
      const data = await res.json();
      setExecutions(data.executions || []);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to load executions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExecutions();
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-1">
        Workflow Executions
      </h1>
      <p className="text-gray-600 text-sm mb-6">
        Monitor your recent workflow runs (showing latest 10).
      </p>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        {loading ? (
          <p className="text-gray-500 text-sm">Loading executions…</p>
        ) : executions.length === 0 ? (
          <p className="text-gray-500 text-sm">
            No executions yet. Run a workflow to see history here.
          </p>
        ) : (
          <div className="space-y-3">
            {executions.map((ex) => {
              const duration =
                ex.completedAt &&
                `${Math.max(
                  0,
                  Math.round(
                    (new Date(ex.completedAt).getTime() -
                      new Date(ex.startedAt).getTime()) /
                      1000
                  )
                )}s`;

              const statusIcon =
                ex.status === 'completed' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                ) : ex.status === 'failed' ? (
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                ) : (
                  <Activity className="w-4 h-4 text-blue-500" />
                );

              return (
                <div
                  key={ex.id}
                  className="flex items-center justify-between border border-gray-100 rounded-lg px-3 py-2"
                >
                  <div className="flex items-center gap-3">
                    {statusIcon}
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {ex.workflow?.name || 'Untitled workflow'}
                      </div>
                      <div className="text-xs text-gray-500 flex gap-3">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(ex.startedAt).toLocaleString()}
                        </span>
                        {duration && (
                          <span className="text-gray-400">
                            Duration: {duration}
                          </span>
                        )}
                        <span className="uppercase text-[10px] tracking-wide text-gray-400">
                          {ex.status}
                        </span>
                      </div>
                      {ex.errorMessage && (
                        <div className="mt-1 text-xs text-red-500">
                          {ex.errorMessage}
                        </div>
                      )}
                    </div>
                  </div>
                  {/* you can later add a "View logs" button here that opens a side panel */}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
