import { test, expect } from '@playwright/test';
import * as THREE from 'three';
import { buildWaterfall } from '../src/lib/waterfall';
import { heightAt } from '../src/lib/landscape';

test('cascade clears its rock bed, reaches sea level, and shares the water clock', () => {
  const time={value:0}, cascade=buildWaterfall(time);
  const sheet=cascade.children[0] as THREE.Mesh<THREE.BufferGeometry,THREE.ShaderMaterial>;
  const positions=sheet.geometry.getAttribute('position');
  for(let i=0;i<positions.count;i++) {
    const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);
    expect([x,y,z].every(Number.isFinite)).toBe(true);
    expect(y).toBeGreaterThanOrEqual(heightAt(x,z)+.045);
  }
  expect(positions.getY(0)).toBeGreaterThan(2);
  expect(positions.getY(positions.count-1)).toBeLessThan(.1);
  for(const object of cascade.children as (THREE.Mesh | THREE.Points)[]) {
    const material=object.material as THREE.ShaderMaterial;
    if(material instanceof THREE.ShaderMaterial) expect(material.uniforms.time).toBe(time);
  }
});

test('spring channel joins the waterfall and all impact effects use the water clock', () => {
  const clock={value:1},cascade=buildWaterfall(clock);
  const creek=cascade.getObjectByName('spring-channel') as THREE.Mesh<THREE.BufferGeometry>;
  const sheet=cascade.children[0] as THREE.Mesh<THREE.BufferGeometry>;
  const source=new THREE.Vector3().fromBufferAttribute(sheet.geometry.getAttribute('position'),8);
  const positions=creek.geometry.getAttribute('position');
  const left=new THREE.Vector3().fromBufferAttribute(positions,positions.count-2);
  const right=new THREE.Vector3().fromBufferAttribute(positions,positions.count-1);
  expect(left.lerp(right,.5).distanceTo(source)).toBeLessThan(.2);
  for(let i=0;i<3;i++) {
    for(const name of ['cascade-impact-','cascade-spray-']) {
      const object=cascade.getObjectByName(name+i) as THREE.Mesh<THREE.BufferGeometry,THREE.ShaderMaterial>;
      expect(object.material.uniforms.time).toBe(clock);
      for(const value of object.geometry.getAttribute('position').array)expect(Number.isFinite(value)).toBe(true);
    }
  }
});
