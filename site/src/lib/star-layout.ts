import * as THREE from 'three';
import type { GraphData } from './types';

export const STAR_CENTERS: Record<string, [number, number, number]> = {
  AI: [-2.45, 1.85, .2], BIZ: [2.5, 1.65, -.3],
  PRO: [-2.85, -1.85, .35], SOC: [2.35, -2.05, 0],
};
const seeded = (n:number) => { const x=Math.sin(n*12.9898+78.233)*43758.5453;return x-Math.floor(x); };

// Relax the real edges within an authored four-domain composition. Sorting by ID
// keeps the same scene when the input JSON is reordered. No new edges are added.
export function starLayout(data:GraphData):Map<string,THREE.Vector3> {
  const nodes=[...data.nodes].sort((a,b)=>a.id.localeCompare(b.id));
  const positions=new Map<string,THREE.Vector3>();
  const nodeById=new Map(nodes.map(node=>[node.id,node]));
  const edges=[...data.edges].sort((a,b)=>a.id.localeCompare(b.id));
  for(const domain of data.domains) {
    const members=nodes.filter(n=>n.domain_id===domain.id);
    const center=new THREE.Vector3(...STAR_CENTERS[domain.id]);
    const subdomains=[...new Set(members.map(n=>n.subdomain_id))].sort();
    const turn=seeded(domain.id.charCodeAt(0))*1.4-.7;
    members.forEach(node=>{
      const group=subdomains.indexOf(node.subdomain_id);
      const siblings=members.filter(n=>n.subdomain_id===node.subdomain_id);
      const i=siblings.indexOf(node),angle=i*2.399963+group*.72+turn;
      // Three local pockets make membership lines short. Their sizes and depth
      // differ, so the domain does not read as another uniform radial fan.
      const pocketAngle=group*2.094+turn;
      const pocket=new THREE.Vector3(Math.cos(pocketAngle)*1.05,Math.sin(pocketAngle)*.95,0);
      const radius=.70+Math.sqrt((i+.5)/siblings.length)*.90;
      const position=new THREE.Vector3(center.x+pocket.x+Math.cos(angle)*radius,
        center.y+pocket.y+Math.sin(angle)*radius*.85,
        center.z+(seeded(i*9+group*31+domain.id.charCodeAt(0))-.5)*3.8);
      const otherDomains=new Set<string>();
      for(const edge of edges) {
        const other=edge.source===node.id?nodeById.get(edge.target):edge.target===node.id?nodeById.get(edge.source):null;
        if(other && other.domain_id!==domain.id) otherDomains.add(other.domain_id);
      }
      if(otherDomains.size) {
        const bridgeCenter=new THREE.Vector3();
        for(const id of [...otherDomains].sort()) bridgeCenter.add(new THREE.Vector3(...STAR_CENTERS[id]));
        bridgeCenter.multiplyScalar(1/otherDomains.size);
        const inward=bridgeCenter.sub(center);inward.z=0;inward.setLength(.75);
        position.add(inward);
      }
      positions.set(node.id,position);
    });
  }
  const anchors=new Map([...positions].map(([id,p])=>[id,p.clone()]));
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
