import type { DiagramDef, PartDef, PipeDef, Pt } from '../model/types';

/** A point where pipes join, bend or end, or where a part sits on a pipe. */
export interface NetNode {
  id: string;
  at: Pt;
  /** The part sitting here: a valve, joint, gauge, manifold connection, pump or filter. */
  part?: string;
  /** The tank this pipe end goes into. */
  tank?: string;
  edges: NetEdge[];
}

/** A straight piece of one pipe between two nodes. */
export interface NetEdge {
  id: string;
  pipe: PipeDef;
  a: NetNode;
  b: NetNode;
  len: number;
}

/**
 * The drawing's pipes as a network that flow can be traced through. A pipe end landing on another
 * pipe is a junction; pipes that only cross are not joined, as on the drawing.
 */
export interface Network {
  nodes: Map<string, NetNode>;
  edges: NetEdge[];
  /** The node each part (not tanks) sits on. */
  nodeOf: Map<string, NetNode>;
  /** The pipe ends going into each tank. */
  tankNodes: Map<string, NetNode[]>;
  parts: Map<string, PartDef>;
}

const EPS = 0.5;
/** How close to a tank's centre a pipe end must be to go into it: a cylinder's radius, or half a box tank's diagonal, plus a margin. */
const TANK_REACH = { cylinder: 50, box: 66 };

const key = (p: Pt) => `${Math.round(p[0])},${Math.round(p[1])}`;
const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function onSegment(p: Pt, a: Pt, b: Pt): boolean {
  const len = dist(a, b);
  if (len < EPS) return dist(p, a) < EPS;
  const t = ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / (len * len);
  if (t < -EPS / len || t > 1 + EPS / len) return false;
  return Math.abs((p[1] - a[1]) * (b[0] - a[0]) - (p[0] - a[0]) * (b[1] - a[1])) / len < EPS;
}

export function buildNetwork(def: DiagramDef): Network {
  const nodes = new Map<string, NetNode>();
  const edges: NetEdge[] = [];
  const node = (p: Pt): NetNode => {
    const k = key(p);
    let n = nodes.get(k);
    if (!n) {
      n = { id: k, at: [Math.round(p[0]), Math.round(p[1])], edges: [] };
      nodes.set(k, n);
    }
    return n;
  };

  const ends = def.pipes.flatMap((p) => [p.pts[0], p.pts[p.pts.length - 1]]);
  const onPipe = def.parts.filter((p) => p.kind !== 'TK');

  for (const pipe of def.pipes) {
    for (let i = 0; i < pipe.pts.length - 1; i++) {
      const [a, b] = [pipe.pts[i], pipe.pts[i + 1]];
      const cuts = [a, b, ...ends.filter((e) => onSegment(e, a, b)), ...onPipe.map((p) => p.at).filter((q) => onSegment(q, a, b))];
      cuts.sort((p, q) => dist(p, a) - dist(q, a));
      for (let j = 0; j < cuts.length - 1; j++) {
        const [na, nb] = [node(cuts[j]), node(cuts[j + 1])];
        if (na === nb) continue;
        const edge: NetEdge = { id: `${pipe.id}:${i}.${j}`, pipe, a: na, b: nb, len: dist(na.at, nb.at) };
        edges.push(edge);
        na.edges.push(edge);
        nb.edges.push(edge);
      }
    }
  }

  const nodeOf = new Map<string, NetNode>();
  for (const p of onPipe) {
    const n = nodes.get(key(p.at));
    if (!n) continue;
    n.part = p.tag;
    nodeOf.set(p.tag, n);
  }

  const tankNodes = new Map<string, NetNode[]>();
  for (const tank of def.parts.filter((p) => p.kind === 'TK')) {
    const reach = tank.tankShape === 'box' ? TANK_REACH.box : TANK_REACH.cylinder;
    const list = [...new Set(ends.filter((e) => dist(e, tank.at) < reach).map((e) => nodes.get(key(e))!))];
    for (const n of list) n.tank = tank.tag;
    tankNodes.set(tank.tag, list);
  }

  return { nodes, edges, nodeOf, tankNodes, parts: new Map(def.parts.map((p) => [p.tag, p])) };
}

export const otherEnd = (e: NetEdge, n: NetNode) => (e.a === n ? e.b : e.a);

/**
 * Shortest way through the network from one node to any node that `isGoal` accepts, passing only
 * nodes that `passes` lets through (the goal itself needn't be). Returns the edges in order, or null.
 */
export function shortestPath(from: NetNode, isGoal: (n: NetNode) => boolean, passes: (n: NetNode) => boolean = () => true): NetEdge[] | null {
  const best = new Map<NetNode, number>([[from, 0]]);
  const via = new Map<NetNode, NetEdge>();
  const open = [from];
  while (open.length) {
    open.sort((p, q) => best.get(p)! - best.get(q)!);
    const n = open.shift()!;
    if (n !== from && isGoal(n)) {
      const path: NetEdge[] = [];
      for (let at = n; at !== from; ) {
        const e = via.get(at)!;
        path.unshift(e);
        at = otherEnd(e, at);
      }
      return path;
    }
    if (n !== from && (n.tank || !passes(n))) continue;
    for (const e of n.edges) {
      const m = otherEnd(e, n);
      const d = best.get(n)! + e.len;
      if (d < (best.get(m) ?? Infinity)) {
        if (!best.has(m)) open.push(m);
        best.set(m, d);
        via.set(m, e);
      }
    }
  }
  return null;
}
