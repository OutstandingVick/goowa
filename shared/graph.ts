// Claim dependency graph built from `dependsOn` (child → parents).

export type Node = { id: string; dependsOn: string[] };

/** Claims that depend on each claim (parent → children). */
export function dependents(nodes: readonly Node[]): Map<string, string[]> {
  const out = new Map<string, string[]>(nodes.map((n) => [n.id, []]));
  for (const n of nodes) {
    for (const parent of n.dependsOn) out.get(parent)?.push(n.id);
  }
  return out;
}

/** Breadth-first downstream walk from `start`, nearest first, up to `maxDepth`. */
export function downstream(
  nodes: readonly Node[],
  start: string,
  maxDepth = 5,
): { id: string; depth: number; via: string }[] {
  const children = dependents(nodes);
  const seen = new Set([start]);
  const out: { id: string; depth: number; via: string }[] = [];
  let frontier = [{ id: start, depth: 0 }];
  while (frontier.length > 0) {
    const next: { id: string; depth: number }[] = [];
    for (const { id, depth } of frontier) {
      if (depth >= maxDepth) continue;
      for (const child of children.get(id) ?? []) {
        if (seen.has(child)) continue;
        seen.add(child);
        out.push({ id: child, depth: depth + 1, via: id });
        next.push({ id: child, depth: depth + 1 });
      }
    }
    frontier = next;
  }
  return out;
}

/**
 * The cycle `claimId` would join if its parents became `newDependsOn`, as a
 * path of ids starting and ending at `claimId`; null when it stays acyclic.
 */
export function cycleIfDepends(
  nodes: readonly Node[],
  claimId: string,
  newDependsOn: readonly string[],
): string[] | null {
  const parents = new Map(nodes.map((n) => [n.id, n.dependsOn]));
  parents.set(claimId, [...newDependsOn]);
  // A cycle exists if claimId is reachable from one of its new parents.
  const stack: { id: string; path: string[] }[] = newDependsOn.map((p) => ({
    id: p,
    path: [claimId, p],
  }));
  const seen = new Set<string>();
  while (stack.length > 0) {
    const { id, path } = stack.pop()!;
    if (id === claimId) return path;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const p of parents.get(id) ?? [])
      stack.push({ id: p, path: [...path, p] });
  }
  return null;
}
