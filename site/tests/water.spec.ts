import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { terrainSite } from '../src/lib/landscape';
import { WATER_LEVEL, MAX_WAVE_HEIGHT, waterFloorAt } from '../src/lib/water';
import type { GraphData } from '../src/lib/types';
const data:GraphData=JSON.parse(readFileSync(new URL('../public/data/graph.json',import.meta.url),'utf8'));
test('water leaves every competency landing dry while filling the valley',()=>{
  for(const domain of data.domains) data.nodes.filter(n=>n.domain_id===domain.id).forEach((node,i)=>{
    expect(terrainSite(domain.id,i,node.terrain_position).y).toBeGreaterThan(WATER_LEVEL+MAX_WAVE_HEIGHT+.1);
  });
  expect(waterFloorAt(0,0)).toBeLessThan(WATER_LEVEL-.2);
  expect(waterFloorAt(11,0)).toBeLessThan(waterFloorAt(0,0));
});
