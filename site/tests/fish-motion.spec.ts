import { test,expect } from '@playwright/test';
import { FishMotion } from '../src/lib/fish-motion';

test('fish change formation independently while staying submerged and limiting acceleration',()=>{
  const motion=new FishMotion(),initial=motion.positions[0].clone().sub(motion.positions[1]);
  let maxAcceleration=0,minDepth=Infinity,minZ=Infinity,maxZ=-Infinity;
  for(let frame=1;frame<=1800;frame++) {
    const previous=motion.velocities.map(v=>v.clone());motion.step(frame/60,1/60);
    motion.positions.forEach((p,i)=>{
      minDepth=Math.min(minDepth,-p.y);minZ=Math.min(minZ,p.z);maxZ=Math.max(maxZ,p.z);
      maxAcceleration=Math.max(maxAcceleration,motion.velocities[i].distanceTo(previous[i])*60);
    });
  }
  expect(minDepth).toBeGreaterThan(.6);expect(minZ).toBeGreaterThanOrEqual(8);expect(maxZ).toBeLessThanOrEqual(9.1);
  expect(maxAcceleration).toBeLessThan(.66);
  expect(motion.positions[0].clone().sub(motion.positions[1]).distanceTo(initial)).toBeGreaterThan(.1);
  const frozen=motion.positions.map(p=>p.toArray());motion.step(31,0);
  expect(motion.positions.map(p=>p.toArray())).toEqual(frozen);
});
