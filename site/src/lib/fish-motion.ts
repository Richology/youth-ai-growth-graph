import * as THREE from 'three';
import { random } from './landscape';

/** Independent steering with delayed following, local separation and bounded acceleration. */
export class FishMotion {
  readonly positions:THREE.Vector3[]=[];
  readonly velocities:THREE.Vector3[]=[];
  readonly beats:number[]=[];
  constructor(readonly count=24) {
    for(let i=0;i<count;i++) {
      this.positions.push(this.target(i,0));
      this.velocities.push(new THREE.Vector3(.2,0,0));this.beats.push(random(i+43)*Math.PI*2);
    }
  }
  private target(i:number,time:number) {
    const school=i<12?0:1,lag=(i%12)*.38,t=time-lag,phase=school*Math.PI;
    const loose=.55+.2*Math.sin(t*.19+phase);
    return new THREE.Vector3((school?3:-3)+Math.sin(t*.19+phase)*1.25+(random(i+71)-.5)*loose*1.7,
      -1.25-school*.55+Math.sin(t*.31+random(i+9)*6)*.18+(random(i+31)-.5)*.3,
      8.5+Math.cos(t*.19+phase)*.24+(random(i+21)-.5)*loose*.5);
  }
  step(time:number,delta:number) {
    const dt=Math.min(.05,Math.max(0,delta));if(!dt)return;
    const next=this.velocities.map((velocity,i)=>{
      const p=this.positions[i],desired=this.target(i,time).sub(p).multiplyScalar(1.2);
      const separation=new THREE.Vector3(),alignment=new THREE.Vector3();let neighbours=0;
      for(let j=0;j<this.count;j++) {
        if(j===i || Math.floor(j/12)!==Math.floor(i/12))continue;
        const offset=p.clone().sub(this.positions[j]),distance=offset.length();
        if(distance<.85){alignment.add(this.velocities[j]);neighbours++;}
        if(distance<.34 && distance>.0001)separation.addScaledVector(offset,(.34-distance)/(distance*distance));
      }
      if(neighbours)desired.addScaledVector(alignment.divideScalar(neighbours),.35);
      desired.addScaledVector(separation,.4);
      // Brief, smooth changes in pace are independent of the rest of the school.
      const burst=Math.pow(Math.max(0,Math.sin(time*.65+i*1.83)),8);
      desired.clampLength(.12,.34+burst*.22);
      const acceleration=desired.sub(velocity).clampLength(0,.65);
      return velocity.clone().addScaledVector(acceleration,dt).clampLength(.06,.56);
    });
    next.forEach((velocity,i)=>{
      this.velocities[i].copy(velocity);this.positions[i].addScaledVector(velocity,dt);
      // Open foreground water is deliberately clear of the rock foundations.
      const p=this.positions[i];p.x=THREE.MathUtils.clamp(p.x,-6.1,6.1);p.y=THREE.MathUtils.clamp(p.y,-2.8,-.65);p.z=THREE.MathUtils.clamp(p.z,8,9.1);
      this.beats[i]+=dt*(4+velocity.length()*13);
    });
  }
}
