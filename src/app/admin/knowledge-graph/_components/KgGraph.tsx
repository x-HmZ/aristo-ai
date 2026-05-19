"use client";

import { useMemo, useCallback, useEffect } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeProps,
  type Connection,
  ConnectionMode,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import type { Concept } from "./types";

// ─── Visual encoding ──────────────────────────────────────────────────────────

const BLOOM_BG: Record<string, string> = {
  remember:   "#E2E8F0",  // slate-200
  understand: "#DBEAFE",  // blue-100
  apply:      "#DCFCE7",  // green-100
  analyze:    "#FEF3C7",  // amber-100
  evaluate:   "#FFEDD5",  // orange-100
  create:     "#EDE9FE",  // violet-100
};

const BLOOM_BORDER: Record<string, string> = {
  remember:   "#94A3B8",
  understand: "#60A5FA",
  apply:      "#22C55E",
  analyze:    "#F59E0B",
  evaluate:   "#F97316",
  create:     "#8B5CF6",
};

interface ConceptNodeData extends Record<string, unknown> {
  label:       string;
  bloom:       string;
  difficulty:  number;
  minutes:     number;
  chunkCount:  number;
  conceptId:   string;
}

// ─── Custom node ──────────────────────────────────────────────────────────────

function ConceptNode({ data, selected }: NodeProps<Node<ConceptNodeData>>) {
  const bloom = data.bloom ?? "understand";
  const bg    = BLOOM_BG[bloom]     ?? "#FFFFFF";
  const bd    = BLOOM_BORDER[bloom] ?? "#94A3B8";
  return (
    <div
      className={`rounded-xl px-3 py-2 text-[11px] shadow-md transition-all ${
        selected ? "ring-2 ring-aristo-orange ring-offset-1" : ""
      }`}
      style={{
        background: bg,
        borderColor: bd,
        borderWidth: 1.5,
        borderStyle: "solid",
        minWidth: 140,
        maxWidth: 200,
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: "#F97B2F", width: 8, height: 8 }}
      />
      <div className="font-bold text-aristo-brown leading-snug line-clamp-2">
        {data.label}
      </div>
      <div className="flex items-center gap-1 mt-1 flex-wrap">
        <span
          className="text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white"
          style={{ background: bd }}
        >
          L{data.difficulty}
        </span>
        <span className="text-[9px] text-aristo-brown/60 capitalize">{bloom}</span>
        <span className="text-[9px] text-aristo-brown/40 tabular-nums">
          {data.minutes}m
        </span>
        {data.chunkCount > 0 && (
          <span className="text-[9px] font-bold text-green-700">
            📚 {data.chunkCount}
          </span>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: "#F97B2F", width: 8, height: 8 }}
      />
    </div>
  );
}

const NODE_TYPES = { concept: ConceptNode };

// ─── Layout ───────────────────────────────────────────────────────────────────

/**
 * Lightweight layered layout: assign each concept a layer based on its
 * longest prerequisite chain depth, then space horizontally within each
 * layer. Good enough for ≤200 concepts without pulling in dagre.
 */
function layoutConcepts(
  concepts: Concept[]
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const layer     = new Map<string, number>();
  const byId      = new Map(concepts.map((c) => [c.id, c]));

  function depthOf(id: string, seen = new Set<string>()): number {
    if (layer.has(id))    return layer.get(id)!;
    if (seen.has(id))     return 0; // cycle protection
    seen.add(id);
    const c = byId.get(id);
    if (!c || c.prerequisites.length === 0) {
      layer.set(id, 0);
      return 0;
    }
    let max = 0;
    for (const p of c.prerequisites) {
      const d = depthOf(p, seen) + 1;
      if (d > max) max = d;
    }
    layer.set(id, max);
    return max;
  }
  for (const c of concepts) depthOf(c.id);

  // Group by layer
  const layers = new Map<number, string[]>();
  for (const [id, l] of layer) {
    if (!layers.has(l)) layers.set(l, []);
    layers.get(l)!.push(id);
  }

  const X_GAP = 230;
  const Y_GAP = 130;
  for (const [l, ids] of layers) {
    ids.sort((a, b) => (byId.get(a)?.name ?? a).localeCompare(byId.get(b)?.name ?? b));
    const totalWidth = (ids.length - 1) * X_GAP;
    ids.forEach((id, i) => {
      positions.set(id, {
        x: i * X_GAP - totalWidth / 2,
        y: l * Y_GAP,
      });
    });
  }
  return positions;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  concepts:       Concept[];
  coverage:       Record<string, { chunkCount: number; lastIngestedAt: string | null }>;
  onNodeClick?:   (c: Concept) => void;
  onCreatePrereq?: (concept_id: string, prerequisite_id: string) => void;
}

export function KgGraph({ concepts, coverage, onNodeClick, onCreatePrereq }: Props) {
  return (
    <ReactFlowProvider>
      <KgGraphInner
        concepts={concepts}
        coverage={coverage}
        onNodeClick={onNodeClick}
        onCreatePrereq={onCreatePrereq}
      />
    </ReactFlowProvider>
  );
}

function KgGraphInner({ concepts, coverage, onNodeClick, onCreatePrereq }: Props) {
  const initial = useMemo(() => {
    const positions = layoutConcepts(concepts);
    const nodes: Node<ConceptNodeData>[] = concepts.map((c) => ({
      id:       c.id,
      type:     "concept",
      position: positions.get(c.id) ?? { x: 0, y: 0 },
      data: {
        label:      c.name,
        bloom:      c.bloom_level,
        difficulty: c.difficulty,
        minutes:    c.estimated_minutes,
        chunkCount: coverage[c.id]?.chunkCount ?? 0,
        conceptId:  c.id,
      },
    }));

    const edges: Edge[] = [];
    for (const c of concepts) {
      for (const p of c.prerequisites ?? []) {
        edges.push({
          id:     `${p}->${c.id}`,
          source: p,           // prerequisite is the source
          target: c.id,        // concept depending on it is the target
          markerEnd: { type: MarkerType.ArrowClosed, color: "#F97B2F" },
          style:  { stroke: "#F97B2F", strokeWidth: 1.5 },
          animated: false,
        });
      }
    }
    return { nodes, edges };
  }, [concepts, coverage]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<ConceptNodeData>>(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initial.edges);

  // When concepts change (after a save), re-seed
  useEffect(() => {
    setNodes(initial.nodes);
    setEdges(initial.edges);
  }, [initial, setNodes, setEdges]);

  const onConnect = useCallback(
    (params: Connection) => {
      if (!params.source || !params.target) return;
      // The dragged edge goes source(prereq) → target(concept)
      onCreatePrereq?.(params.target, params.source);
    },
    [onCreatePrereq]
  );

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node<ConceptNodeData>) => {
      const c = concepts.find((x) => x.id === node.data.conceptId);
      if (c) onNodeClick?.(c);
    },
    [concepts, onNodeClick]
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={NODE_TYPES}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onNodeClick={handleNodeClick}
      connectionMode={ConnectionMode.Loose}
      fitView
      proOptions={{ hideAttribution: true }}
    >
      <Background gap={24} color="#F97B2F" style={{ opacity: 0.2 }} />
      <MiniMap
        nodeColor={(n) => BLOOM_BORDER[(n.data as ConceptNodeData)?.bloom] ?? "#94A3B8"}
        maskColor="rgba(253, 248, 239, 0.7)"
        pannable
        zoomable
      />
      <Controls position="bottom-right" />
    </ReactFlow>
  );
}
