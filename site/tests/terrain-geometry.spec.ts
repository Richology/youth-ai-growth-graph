import { expect, test } from '@playwright/test';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { landscapeGeometry, terrainSite, terrainOccludes } from '../src/lib/landscape';
import type { GraphData } from '../src/lib/types';

const graph: GraphData=JSON.parse(readFileSync(new URL('../public/data/graph.json',import.meta.url),'utf8'));

test('terrain visibility keeps overhead nodes visible and blocks views through rock',()=>{
  const target=terrainSite('AI',0,[0,0,0]).add(new THREE.Vector3(0,.18,0));
  expect(terrainOccludes(target.clone().add(new THREE.Vector3(0,12,0)),target)).toBe(false);
  expect(terrainOccludes(new THREE.Vector3(target.x,-3,target.z),target)).toBe(true);
});

test('every node landing agrees with the rendered terrain triangles',()=>{
  const geometry=landscapeGeometry();
  const material=new THREE.MeshBasicMaterial();
  const terrain=new THREE.Mesh(geometry,material);
  terrain.updateMatrixWorld(true);
  const ray=new THREE.Raycaster();
  try {
    for(const domain of graph.domains) {
      const members=graph.nodes.filter(node=>node.domain_id===domain.id);
      members.forEach((node,index)=>{
        const site=terrainSite(domain.id,index,node.terrain_position);
        ray.set(site.clone().add(new THREE.Vector3(0,20,0)),new THREE.Vector3(0,-1,0));
        const hit=ray.intersectObject(terrain,false)[0];
        expect(hit,`${node.id} needs solid terrain below its platform`).toBeDefined();
        expect(Math.abs(hit.point.y-site.y),`${node.id} landing must not float or sink`).toBeLessThan(.08);
      });
    }
  } finally {geometry.dispose();material.dispose();}
});
