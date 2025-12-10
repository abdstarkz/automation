// src/components/Workflow/WorkflowCanvas.tsx
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useEdgesState,
  useNodesState,
  Connection,
  Edge,
  Node,
  ReactFlowInstance,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { Play, Save, Info, Wand2, Mic } from 'lucide-react';

import { CustomNode } from './CustomNode';
import { NodePalette } from './NodePalette';
import NodeConfigPanel from './NodeConfigPanel';
import type { NodeType, NodeData } from '@/types/workflow.types';
import toast from 'react-hot-toast';

const nodeTypes = { custom: CustomNode };

const API_BASE_URL: string =
  import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const handleOpenIntegrations = () => {
  // direct navigation to integrations page
  window.location.href = '/integrations';
};

type IntegrationSummary = {
  id: string;
  type: string;
  name: string;
  isActive: boolean;
};

type WorkflowCanvasProps = {
  onSave?:
    | ((nodes: Node<NodeData>[], edges: Edge[], options?: { status?: 'draft' | 'active' }) => Promise<void> | void)
    | undefined;
  onRun?: ((nodes: Node<NodeData>[], edges: Edge[]) => Promise<void> | void) | undefined;
  onAIGenerate?: () => void;
  onVoiceCommand?: () => void;

  // NEW: when opening from template or AI, pass in graph
  initialNodes?: Node<NodeData>[];
  initialEdges?: Edge[];
};

type PaletteDragData = {
  label: string;
  type: NodeType;
  color?: string;
};

export default function WorkflowCanvas({
  onSave,
  onRun,
  onAIGenerate,
  onVoiceCommand,
  initialNodes,
  initialEdges,
}: WorkflowCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<NodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [reactFlowInstance, setReactFlowInstance] =
    useState<ReactFlowInstance | null>(null);

  const [selectedNode, setSelectedNode] = useState<Node<NodeData> | null>(
    null
  );
  const [showConfig, setShowConfig] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [loadingIntegrations, setLoadingIntegrations] = useState(false);
  const [integrations, setIntegrations] = useState<IntegrationSummary[]>([]);

  // ---------- hydrate from template / AI ----------

  useEffect(() => {
    if (initialNodes && initialNodes.length) {
      setNodes(initialNodes);
    }
    if (initialEdges) {
      setEdges(initialEdges);
    }
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  // ------- integrations summary -------

  const loadIntegrations = useCallback(async () => {
    try {
      setLoadingIntegrations(true);
      const res = await fetch(`${API_BASE_URL}/oauth/integrations`, {
        credentials: 'include',
        headers: {
          ...getAuthHeaders(),
        },
      });
      const ct = res.headers.get('content-type') || '';
      if (!res.ok || !ct.includes('application/json')) {
        return;
      }
      const data = await res.json();
      setIntegrations(data.integrations || []);
    } catch (e) {
      console.error('Failed to load integration data', e);
      toast.error('Failed to load integrations.');
    } finally {
      setLoadingIntegrations(false);
    }
  }, []);

  useEffect(() => {
    loadIntegrations();
  }, [loadIntegrations]);

  const integrationSummary = useMemo(() => {
    if (integrations.length === 0) return 'No integrations connected';
    const active = integrations.filter((i) => i.isActive);
    if (active.length === 0) return 'All integrations are disabled';
    const types = Array.from(new Set(active.map((i) => i.type)));
    return `Connected: ${types.join(', ')}`;
  }, [integrations]);

  // ------- drag & drop -------

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      if (!reactFlowInstance) return;

      const raw = event.dataTransfer.getData('application/reactflow');
      if (!raw) return;

      let data: PaletteDragData;
      try {
        data = JSON.parse(raw);
      } catch {
        console.warn('Invalid drag payload:', raw);
        return;
      }

      const type: NodeType = data.type;
      const position = reactFlowInstance.project({
        x: event.clientX,
        y: event.clientY,
      });

      const variant: NodeData['variant'] =
        type === 'trigger_schedule'
          ? 'schedule'
          : type === 'loop'
          ? 'loop'
          : 'default';

      const newNode: Node<NodeData> = {
        id: `node-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 7)}`,
        type: 'custom',
        position,
        data: {
          label: data.label,
          type,
          color: data.color,
          variant,
          config: {},
        },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes]
  );

  // ------- edges -------

  const onConnect = useCallback(
  (connection: Connection) =>
    setEdges((eds) =>
      addEdge(
        {
          ...connection,
          type: 'smoothstep',
        },
        eds
      )
    ),
  [setEdges]
);


  // ------- node config -------

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node<NodeData>) => {
      setSelectedNode(node);
      setShowConfig(true);
    },
    []
  );

  const handleSaveConfig = (updatedNode: Node<NodeData>) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === updatedNode.id ? updatedNode : n))
    );
    setShowConfig(false);
    setSelectedNode(null);
  };

  const handleDeleteNode = () => {
    if (!selectedNode) return;
    const id = selectedNode.id;
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
    setShowConfig(false);
    setSelectedNode(null);
  };

  // ------- top buttons (Save / Run / AI / Voice) -------

  const handleSaveWorkflow = async (status: 'draft' | 'active') => {
    if (!onSave) return;
    setSaving(true);
    try {
      await onSave(nodes, edges, { status });
    } finally {
      setSaving(false);
    }
  };

  const handleRunWorkflow = async () => {
    if (!onRun) return;
    setRunning(true);
    try {
      await onRun(nodes, edges);
    } finally {
      setRunning(false);
    }
  };

  // ------- render -------

  return (
    <div className="flex flex-col h-full w-full bg-slate-950/5">
      {/* top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-white" > 
<div className="flex items-center gap-3">
            <button
              onClick={() => handleSaveWorkflow('draft')}
              disabled={saving || !onSave}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors duration-150"
            >
              <Save className="w-4 h-4" /> Save draft
            </button>
            <button
              onClick={() => handleSaveWorkflow('active')}
              disabled={saving || !onSave}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 transition-colors duration-150"
            >
              <Save className="w-4 h-4" /> Save & activate
            </button>
            <button
              onClick={handleRunWorkflow}
              disabled={running || !onRun}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-500 transition-colors duration-150"
            >
              <Play className="w-4 h-4" /> Run
            </button>
          </div>
    
        <div className="flex items-center gap-4" > 
          {/* integration status */} 
          <div className="hidden md:flex flex-col items-end max-w-xs" > 
            <span className="text-[11px] font-medium text-slate-500" > 
              Integrations 
            </span > 
            <span className="text-[11px] text-slate-400 truncate" > 
              {loadingIntegrations 
                ? 'Loading integrations…' 
                : integrationSummary || 'No integrations connected yet'} 
            </span > 
          </div > 
    
          <button 
            type="button" 
            onClick={handleOpenIntegrations} 
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors duration-150"
          > 
            Manage 
          </button > 
    
          <div className="flex items-center gap-2" > 
            <button 
              onClick={onAIGenerate} 
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors duration-150"
            > 
              <Wand2 className="w-4 h-4"  /> 
              AI Builder 
            </button > 
            <button 
              onClick={onVoiceCommand} 
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors duration-150"
            > 
              <Mic className="w-4 h-4"  /> 
              Voice 
            </button > 
            <button 
              onClick={()  => setShowGuide(true)} 
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] text-slate-500 hover:bg-slate-100 transition-colors duration-150"
            > 
              <Info className="w-3 h-3"  /> 
              Guide 
            </button > 
          </div > 
        </div > 
      </div>

      {/* main area */}
      <div className="flex flex-1 min-h-0">
        {/* canvas */}
        <div className="flex-1 relative">
          <ReactFlow
            style={{ width: '100%', height: '100%' }}
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={setReactFlowInstance}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            onDrop={onDrop}
            onDragOver={onDragOver}
            fitView
          >
            <Background gap={18} size={1} color="#e2e8f0" />
            <MiniMap
              nodeColor={(node) => (node.data as NodeData)?.color || '#6366f1'}
              className="!bg-white/80 !shadow-md !rounded-xl"
            />
            <Controls className="!bg-white/90 !rounded-xl !shadow-md" />
          </ReactFlow>
        </div>

        {/* node palette */}
        <div className="w-80 border-l border-slate-200 bg-white/95 backdrop-blur-sm p-4 overflow-y-auto">
          <NodePalette />
        </div>
      </div>

      {/* node configuration panel */}
      {showConfig && selectedNode && (
        <NodeConfigPanel
          node={selectedNode}
          onClose={() => setShowConfig(false)}
          onSave={handleSaveConfig}
          onDelete={handleDeleteNode}
        />
      )}

      {/* tutorial guide overlay */}
      {showGuide && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  How the Workflow Builder works
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Quick overview of triggers, actions and connections.
                </p>
              </div>
              <button
                onClick={() => setShowGuide(false)}
                className="rounded-full p-1 hover:bg-slate-100"
              >
                <Info className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            <ol className="space-y-3 text-sm text-slate-700">
              <li>
                <span className="font-semibold">1. Start with a trigger.</span>{' '}
                Drag <b>Manual</b>, <b>Schedule</b> or <b>Webhook</b> trigger
                onto the canvas.
              </li>
              <li>
                <span className="font-semibold">2. Add actions & logic.</span>{' '}
                Drag Google, messaging, AI and logic nodes (like{' '}
                <b>Loop</b> or <b>If / Else</b>) next in the chain.
              </li>
              <li>
                <span className="font-semibold">3. Connect the dots.</span>{' '}
                Drag from a node handle to another node to define the execution
                path.
              </li>
              <li>
                <span className="font-semibold">
                  4. Click a node to configure it.
                </span>{' '}
                Set integrations, parameters and test the connection.
              </li>
              <li>
                <span className="font-semibold">5. Save & run.</span> Use{' '}
                <b>Save</b> to persist the workflow and <b>Run</b> to execute it
                (App handles the actual API call).
              </li>
              <li>
                <span className="font-semibold">
                  6. Schedule & loop behaviour.
                </span>{' '}
                <b>Schedule</b> nodes run on a cron timer; <b>Loop</b> repeats
                its branch a fixed number of times, similar to Make.com
                iterators.
              </li>
            </ol>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowGuide(false)}
                className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm hover:bg-slate-800 transition-colors duration-150"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
