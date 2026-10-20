import * as THREE from 'three';
import { random } from './landscape';
import { reefClearanceAt } from './seabed';

/** Independent steering with delayed following, local separation and bounded acceleration. */
export class FishMotion {
  readonly positions:THREE.Vector3[]=[];
  readonly velocities:THREE.Vector3[]=[];
  readonly beats:number[]=[];
  constructor(readonly count=48) {
    for(let i=0;i<count;i++) {
      this.positions.push(this.target(i,0));
      this.velocities.push(new THREE.Vector3(.2,0,0));this.beats.push(random(i+43)*Math.PI*2);
    }
  }
  private target(i:number,time:number) {
    const school=i<18?0:i<36?1:2,member=i-(school===0?0:school===1?18:36);
    const t=time-member*.32,phase=school*2.1;
    const loose=.7+.25*Math.sin(t*.19+phase);
    // Silver schools occupy different depths. Gold fish forage in loose pairs
    // across the front shelf, leaving visible water between individual animals.
    if(school===2) return this.clearTarget(new THREE.Vector3(-6+(member%6)*2.25+(random(i+99)-.5)*.7+Math.sin(t*.21+member)*.32,
      -2.5-Math.floor(member/6)*.65+Math.sin(t*.26+member)*.16,
      8.9+Math.floor(member/6)*.55+Math.sin(t*.18+member)*.18));
    return this.clearTarget(new THREE.Vector3((school?3.8:-4.3)+Math.sin(t*.19+phase)*1.1+(random(i+71)-.5)*loose*2.8,
      -1.35-school*.65+Math.sin(t*.31+random(i+9)*6)*.18+(random(i+31)-.5)*.45,
      (school?7.9:8.3)+Math.cos(t*.19+phase)*.30+(random(i+21)-.5)*loose*.9));
  }

  private clearTarget(target:THREE.Vector3) {
    target.y=Math.max(target.y,reefClearanceAt(target.x,target.z));return target;
  }

  step(time:number,delta:number) {
    const dt=Math.min(.05,Math.max(0,delta));if(!dt)return;
    const next=this.velocities.map((velocity,i)=>{
      const p=this.positions[i],desired=this.target(i,time).sub(p).multiplyScalar(1.2);
      const separation=new THREE.Vector3(),alignment=new THREE.Vector3();let neighbours=0;
      for(let j=0;j<this.count;j++) {
        if(j===i || (j<18?0:j<36?1:2)!==(i<18?0:i<36?1:2))continue;
        const offset=p.clone().sub(this.positions[j]),distance=offset.length();
        if(distance<.85){alignment.add(this.velocities[j]);neighbours++;}
        if(distance<.48 && distance>.0001)separation.addScaledVector(offset,(.48-distance)/(distance*distance));
      }
      if(neighbours)desired.addScaledVector(alignment.divideScalar(neighbours),.35);
      desired.addScaledVector(separation,.4);
      const ahead=p.clone().addScaledVector(velocity,1.1);
      const clearance=reefClearanceAt(ahead.x,ahead.z);
      if(ahead.y<clearance+.12)desired.y+=Math.max(0,clearance+.12-ahead.y)*2.;
      // Brief, smooth changes in pace are independent of the rest of the school.
      const burst=Math.pow(Math.max(0,Math.sin(time*.65+i*1.83)),8);
      desired.clampLength(.12,.34+burst*.22);
      const acceleration=desired.sub(velocity).clampLength(0,.65);
      return velocity.clone().addScaledVector(acceleration,dt).clampLength(.06,.56);
    });
    next.forEach((velocity,i)=>{
      this.velocities[i].copy(velocity);this.positions[i].addScaledVector(velocity,dt);
      // Open foreground water is deliberately clear of the rock foundations.
      const p=this.positions[i];p.x=THREE.MathUtils.clamp(p.x,-7.1,7.1);p.y=THREE.MathUtils.clamp(p.y,-3.6,-.65);p.z=THREE.MathUtils.clamp(p.z,7.2,9.8);
      this.beats[i]+=dt*(4+velocity.length()*13);
    });
  }
}
