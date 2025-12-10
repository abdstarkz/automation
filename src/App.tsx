// src/App.tsx
import { useState } from 'react';
import axios from 'axios';
import { Routes, Route, useNavigate } from 'react-router-dom';

import { useAuth } from './contexts/AuthContext';
import { WorkflowsPage } from './pages/WorkflowsPage';
import { HealthPage } from './pages/HealthPage';
import { ExecutionsPage } from './pages/ExecutionsPage';
import { SettingsPage } from './pages/SettingsPage';
import { AuthPage } from './pages/AuthPage';
import { IntegrationsPage } from './pages/IntegrationsPage';

import { DashboardLayout } from './components/Layout/DashboardLayout';
import WorkflowCanvas from './components/Workflow/WorkflowCanvas';
import { AIWorkflowModal } from './components/Workflow/AIWorkflowModal';
import { VoiceCommandModal } from './components/Workflow/VoiceCommandModal';
import { LoadingSpinner } from './components/UI/LoadingSpinner';

import { useWorkflowStore } from './store/workflowStore';
import { generateWorkflowFromText } from './lib/openai.service';

import type { Node, Edge } from 'reactflow';
import type { NodeData } from './types/workflow.types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

function AppContent() {
  const { user, loading } = useAuth();
  const [showAIModal, setShowAIModal] = useState(false);
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [workflowName, setWorkflowName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  const [currentWorkflowId, setCurrentWorkflowId] =
    useState<string | null>(null);

  const { setNodes, setEdges, nodes, edges } = useWorkflowStore();
  const navigate = useNavigate();

  if (loading) {
    return <LoadingSpinner fullScreen text="Loading..." />;
  }

  if (!user) {
    return <AuthPage />;
  }

  const handleSelectTemplate = (template: any) => {
    setNodes(template.nodes);
    setEdges(template.edges);
    navigate('/new-workflow');
  };

  const handleAIGenerate = async (prompt: string) => {
    try {
      const workflow = await generateWorkflowFromText(prompt);
      setNodes(workflow.nodes);
      setEdges(workflow.edges);
      navigate('/new-workflow');
    } catch (error) {
      console.error('Error generating workflow:', error);
      alert(
        'Failed to generate workflow. Please check your OpenAI API key in settings.'
      );
    }
  };

  const handleSaveWorkflow = async (
  canvasNodes?: Node<NodeData>[],
  canvasEdges?: Edge[]
) => {
  if (!user) return;

  // Show dialog if no name set
  if (!workflowName.trim()) {
    setShowSaveDialog(true);
    return;
  }

  const token = localStorage.getItem('token') || '';
  const workflowData = {
    nodes: canvasNodes ?? nodes,
    edges: canvasEdges ?? edges,
  };

  try {
    if (currentWorkflowId) {
      await axios.put(
        `${API_URL}/workflows/${currentWorkflowId}`,
        { name: workflowName, workflowData },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert('✅ Workflow updated successfully!');
    } else {
      const response = await axios.post(
        `${API_URL}/workflows`,
        {
          name: workflowName,
          description: 'Created from canvas',
          workflowData,
          category: 'custom',
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setCurrentWorkflowId(response.data.workflow.id);
      alert('✅ Workflow saved successfully!');
    }
  } catch (error: any) {
    console.error('Error saving workflow:', error);
    alert(`❌ Failed to save: ${error.response?.data?.message || error.message}`);
  }
};

  const handleRunWorkflow = async (
    canvasNodes: Node<NodeData>[],
    canvasEdges: Edge[]
  ) => {
    if (!user) {
      alert('Please sign in first');
      return;
    }

    if (!currentWorkflowId) {
      alert('Please save the workflow first');
      return;
    }

    const token = localStorage.getItem('token') || '';

    try {
      await axios.post(
        `${API_URL}/workflows/${currentWorkflowId}/execute`,
        {
          nodes: canvasNodes,
          edges: canvasEdges,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      alert('Workflow execution started!');
      navigate('/executions');
    } catch (error) {
      console.error('Error running workflow:', error);
      alert('Failed to start workflow execution');
    }
  };

  return (
    <>
      <DashboardLayout>
        <div className="flex-1 overflow-auto">
          <Routes>
            <Route
              path="/workflows"
              element={
                <WorkflowsPage
                  onSelectTemplate={handleSelectTemplate}
                />
              }
            />
            <Route
              path="/new-workflow"
              element={
                <WorkflowCanvas
                  initialNodes={nodes as Node<NodeData>[]}
                  initialEdges={edges}
                  onSave={(n, e) => handleSaveWorkflow(n, e)}
                  onRun={(n, e) => handleRunWorkflow(n, e)}
                  onAIGenerate={() => setShowAIModal(true)}
                  onVoiceCommand={() => setShowVoiceModal(true)}
                />
              }
            />
            <Route path="/executions" element={<ExecutionsPage />} />
            <Route path="/health" element={<HealthPage />} />
            <Route path="/integrations" element={<IntegrationsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route
              path="/"
              element={
                <WorkflowsPage
                  onSelectTemplate={handleSelectTemplate}
                />
              }
            />
          </Routes>
        </div>
      </DashboardLayout>

      <AIWorkflowModal
        isOpen={showAIModal}
        onClose={() => setShowAIModal(false)}
        onGenerate={handleAIGenerate}
      />

      <VoiceCommandModal
        isOpen={showVoiceModal}
        onClose={() => setShowVoiceModal(false)}
        onGenerate={handleAIGenerate}
      />

      {showSaveDialog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Save Workflow</h3>
            <input
              type="text"
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              placeholder="Enter workflow name..."
              className="w-full px-3 py-2 border rounded-lg mb-4"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowSaveDialog(false)}
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowSaveDialog(false);
                  handleSaveWorkflow();
                }}
                disabled={!workflowName.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function App() {
  return <AppContent />;
}
