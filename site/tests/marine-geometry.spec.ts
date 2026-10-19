import { test, expect } from '@playwright/test';
import { fishGeometry, starfishGeometry, shellGeometry, seagrassGeometry } from '../src/lib/marine-geometry';

test('marine meshes have finite surface data and upward-facing seabed details',()=>{
  const fish=fishGeometry(),star=starfishGeometry(),shell=shellGeometry();
  for(const geometry of [fish.body,fish.tail,star,shell,seagrassGeometry(7)]) {
    for(const name of ['position','normal','color']) {
      const attribute=geometry.getAttribute(name);
      expect(attribute.count).toBe(geometry.getAttribute('position').count);
      expect(Array.from(attribute.array).every(Number.isFinite)).toBe(true);
    }
  }
  // These surfaces sit on rocks: reversed winding makes them disappear from above.
  for(const geometry of [star,shell]) {
    const normal=geometry.getAttribute('normal');
    let up=0;for(let i=0;i<normal.count;i++)if(normal.getY(i)>.1)up++;
    expect(up/normal.count).toBeGreaterThan(.9);
  }
});
