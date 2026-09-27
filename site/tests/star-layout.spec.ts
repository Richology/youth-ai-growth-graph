import { expect, test } from '@playwright/test';
import { starLayout } from '../src/lib/star-layout';
import type { GraphData } from '../src/lib/types';
import { readFileSync } from 'node:fs';
const graph = JSON.parse(readFileSync(new URL('../public/data/graph.json', import.meta.url), 'utf8'));

test('star composition remains stable when graph JSON ordering changes', () => {
  const data = graph as GraphData;
  const original = starLayout(data);
  const reordered = starLayout({
    ...data,
    nodes: [...data.nodes].reverse(),
    edges: [...data.edges].reverse(),
    domains: [...data.domains].reverse(),
  });
  expect(original.size).toBe(data.nodes.length);
  for (const node of data.nodes) {
    const point = original.get(node.id)!;
    expect(point.toArray().every(Number.isFinite)).toBe(true);
    // The camera composition reserves this extent for the graph, outside the UI.
    expect(Math.abs(point.x)).toBeLessThan(7.2);
    expect(Math.abs(point.y)).toBeLessThan(5.8);
    expect(reordered.get(node.id)!.toArray()).toEqual(point.toArray());
  }
});
