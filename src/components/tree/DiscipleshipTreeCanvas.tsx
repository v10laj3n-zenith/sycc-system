"use client";

import { useMemo, useState } from "react";
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Flame, GitFork, Users } from "lucide-react";
import { getHierarchyStyle, HIERARCHY_LEGEND } from "@/lib/hierarchy-styles";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { DiscipleshipTreeNode } from "@/types/database.types";

type TreeNodeData = {
  person: DiscipleshipTreeNode;
};

function DiscipleshipPersonNode({ data }: NodeProps<Node<TreeNodeData>>) {
  const person = data.person;
  const style = getHierarchyStyle(person.tier, person.current_leader_id);

  return (
    <div
      className={cn(
        "min-w-[180px] max-w-[210px] rounded-2xl border-2 px-3.5 py-2.5 shadow-xs transition-transform active:scale-95",
        style.borderClass
      )}
      style={{ backgroundColor: style.bgHex, color: style.textHex }}
    >
      <Handle type="target" position={Position.Top} className="!bg-slate-400" />
      <div className="flex items-center justify-between gap-1.5">
        <span className="text-[10px] uppercase tracking-wide opacity-80 font-semibold">
          {style.label}
        </span>
        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold">
          <Flame className="h-3 w-3" />
          {person.consecutive_saturday_streak}w
        </span>
      </div>
      <p
        className={cn(
          "mt-1 truncate text-sm",
          person.tier === "new_invite" && "italic",
          person.tier === "cell_leader" && "font-bold"
        )}
      >
        {person.full_name}
      </p>
      {person.ministry_team && (
        <p className="mt-0.5 truncate text-[10px] opacity-75">
          {person.ministry_team}
        </p>
      )}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-slate-400"
      />
    </div>
  );
}

const nodeTypes = {
  person: DiscipleshipPersonNode,
};

export function DiscipleshipTreeCanvas({
  members,
  scopeTitle,
}: {
  members: DiscipleshipTreeNode[];
  scopeTitle: string;
}) {
  const [selected, setSelected] = useState<DiscipleshipTreeNode | null>(null);

  const memberMap = useMemo(
    () => new Map(members.map((m) => [m.id, m])),
    [members]
  );

  const { nodes, edges } = useMemo(() => {
    const byDepth = new Map<number, DiscipleshipTreeNode[]>();
    for (const m of members) {
      const bucket = byDepth.get(m.depth) ?? [];
      bucket.push(m);
      byDepth.set(m.depth, bucket);
    }

    const builtNodes: Node<TreeNodeData>[] = [];
    const builtEdges: Edge[] = [];
    const horizontalGap = 230;
    const verticalGap = 135;

    for (const [depth, row] of byDepth.entries()) {
      const totalWidth = (row.length - 1) * horizontalGap;
      row.forEach((person, index) => {
        builtNodes.push({
          id: person.id,
          type: "person",
          position: {
            x: index * horizontalGap - totalWidth / 2,
            y: depth * verticalGap,
          },
          data: { person },
        });

        if (person.invited_by_id && memberMap.has(person.invited_by_id)) {
          builtEdges.push({
            id: `${person.invited_by_id}->${person.id}`,
            source: person.invited_by_id,
            target: person.id,
            animated: person.tier === "new_invite",
            style: { stroke: "#64748B", strokeWidth: 2 },
          });
        }
      });
    }

    return { nodes: builtNodes, edges: builtEdges };
  }, [members, memberMap]);

  const selectedStyle = selected
    ? getHierarchyStyle(selected.tier, selected.current_leader_id)
    : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <GitFork className="h-5 w-5 text-[var(--color-primary)]" />
            {scopeTitle}
          </h1>
          <p className="text-xs text-slate-500">
            Permanent spiritual genealogy powered by <code>invited_by_id</code>{" "}
            ({members.length} {members.length === 1 ? "person" : "people"}). Tap
            any node for details.
          </p>
        </div>
      </div>

      {/* Soft Pastel Light Mode Hierarchy Legend */}
      <div className="flex flex-wrap gap-1.5">
        {HIERARCHY_LEGEND.map((item) => {
          const style = getHierarchyStyle(item.tier, item.currentLeaderId);
          return (
            <span
              key={item.key}
              className={cn("rounded-full px-2.5 py-1 text-[11px]", style.badgeClass)}
            >
              {item.caption}
            </span>
          );
        })}
      </div>

      <div className="h-[62dvh] min-h-[420px] w-full rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-xs">
        {nodes.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center p-6 text-center text-slate-500">
            <Users className="h-10 w-10 text-slate-300 mb-2" />
            <p className="font-semibold text-slate-700">
              Your Discipleship Tree is ready to grow!
            </p>
            <p className="text-xs mt-1 max-w-xs">
              Invite a friend to Saturday Youth Service and have Registration
              link you as their inviter.
            </p>
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.25 }}
            onNodeClick={(_, node) => {
              const typed = node as Node<TreeNodeData>;
              setSelected(typed.data.person);
            }}
          >
            <Background color="#CBD5E1" gap={20} />
            <Controls showInteractive={false} />
            <MiniMap
              nodeColor={(n) => {
                const p = (n.data as TreeNodeData).person;
                return getHierarchyStyle(p.tier, p.current_leader_id).bgHex;
              }}
              maskColor="rgba(248,250,252,0.7)"
            />
          </ReactFlow>
        )}
      </div>

      <Sheet
        open={Boolean(selected)}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        <SheetContent side="bottom">
          {selected && selectedStyle && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-xs",
                      selectedStyle.badgeClass
                    )}
                  >
                    {selectedStyle.label}
                  </span>
                </div>
                <SheetTitle>{selected.full_name}</SheetTitle>
                <SheetDescription>
                  Spiritual Generation Level {selected.depth + 1}
                </SheetDescription>
              </SheetHeader>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Saturday Streak</p>
                  <p className="font-bold text-slate-900 mt-0.5">
                    {selected.consecutive_saturday_streak} consecutive weeks
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Ministry Team</p>
                  <p className="font-bold text-slate-900 mt-0.5">
                    {selected.ministry_team || "Not yet joined"}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 col-span-2">
                  <p className="text-xs text-slate-500">Invited By</p>
                  <p className="font-bold text-slate-900 mt-0.5">
                    {selected.invited_by_id
                      ? memberMap.get(selected.invited_by_id)?.full_name ??
                        "SYCC Family"
                      : "Foundational Root"}
                  </p>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
