import * as THREE from 'three';
import type { GraphData } from './types';

export const STAR_CENTERS: Record<string, [number, number, number]> = {
  AI: [-2.8, 2.0, .2], BIZ: [2.75, 1.9, -.3],
  PRO: [-3.0, -1.85, .35], SOC: [2.85, -2.1, 0],
};
const seeded = (n:number) => { const x=Math.sin(n*12.9898+78.233)*43758.5453;return x-Math.floor(x); };

// Relax the real edges within an authored four-domain composition. Sorting by ID
// keeps the same scene when the input JSON is reordered. No new edges are added.
export function starLayout(data:GraphData):Map<string,THREE.Vector3> {
  const nodes=[...data.nodes].sort((a,b)=>a.id.localeCompare(b.id));
  const positions=new Map<string,THREE.Vector3>();
  for(const domain of data.domains) {
    const members=nodes.filter(n=>n.domain_id===domain.id);
    const center=new THREE.Vector3(...STAR_CENTERS[domain.id]);
    members.forEach((node,i)=>{
      const angle=i*2.399963+seeded(domain.id.charCodeAt(0))*.9;
      const radius=Math.sqrt((i+1.8)/(members.length+1))*2.45;
      positions.set(node.id,new THREE.Vector3(center.x+Math.cos(angle)*radius,center.y+Math.sin(angle)*radius*.95,center.z+(seeded(i*9+domain.id.charCodeAt(0))-.5)*3.8));
    });
  }
  const anchors=new Map([...positions].map(([id,p])=>[id,p.clone()]));
  const edges=[...data.edges].sort((a,b)=>a.id.localeCompare(b.id));
  for(let iteration=0;iteration<110;iteration++) {
    const forces=new Map(nodes.map(n=>[n.id,new THREE.Vector3()]));
    for(let a=0;a<nodes.length;a++) for(let b=a+1;b<nodes.length;b++) {
      const pa=positions.get(nodes[a].id)!,pb=positions.get(nodes[b].id)!;
      const delta=new THREE.Vector3(pa.x-pb.x,pa.y-pb.y,0),distance=Math.max(.35,delta.length());
      delta.multiplyScalar(.035/(distance*distance*distance));
      forces.get(nodes[a].id)!.add(delta);forces.get(nodes[b].id)!.sub(delta);
    }
    for(const edge of edges) {
      const a=positions.get(edge.source),b=positions.get(edge.target);if(!a||!b) continue;
      const delta=new THREE.Vector3(b.x-a.x,b.y-a.y,0),distance=delta.length();
      if(distance<.001) continue;
      delta.multiplyScalar(Math.max(0,distance-2.25)/distance*.025);
      forces.get(edge.source)!.add(delta);forces.get(edge.target)!.sub(delta);
    }
    for(const node of nodes) {
      const position=positions.get(node.id)!,anchor=anchors.get(node.id)!;
      const force=forces.get(node.id)!.add(anchor.clone().sub(position).multiplyScalar(.14));
      position.add(force.clampLength(0,.10));
      const displacement=position.clone().sub(anchor).clampLength(0,.8);
      position.copy(anchor).add(displacement);
    }
  }
  for(const point of positions.values()) {point.x*=1.23;point.y*=1.16;}
  return positions;
}
