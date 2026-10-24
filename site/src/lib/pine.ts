import * as THREE from 'three';

// A real, open needle spray. Each needle has two faces and a tapered tip;
// branch instances retain depth when the camera rotates around the island.
export function pineSprayGeometry(): THREE.BufferGeometry {
  const positions:number[]=[], colors:number[]=[];
  const seeded=(n:number)=>{const x=Math.sin(n*127.1+91.7)*43758.54;return x-Math.floor(x)};
  const axis=new THREE.Vector3(1,0,0), color=new THREE.Color();
  const triangle=(a:THREE.Vector3,b:THREE.Vector3,c:THREE.Vector3,tint:THREE.Color)=>{
    for(const p of [a,b,c]){positions.push(p.x,p.y,p.z);colors.push(tint.r,tint.g,tint.b)}
  };
  for(let tuft=0;tuft<13;tuft++) {
    const angle=tuft*2.399,spread=.12+seeded(tuft)*.22;
    const center=new THREE.Vector3((tuft/12-.5)*.9,Math.sin(angle)*.12,Math.cos(angle)*spread);
    for(let n=0;n<24;n++) {
      const phi=n*2.399+tuft, lift=seeded(n+tuft*33);
      const direction=new THREE.Vector3(Math.cos(phi)*.65+.38,.15+lift*.65,Math.sin(phi)*.7).normalize();
      const length=.10+seeded(n+tuft*71)*.19;
      const tip=center.clone().addScaledVector(direction,length);
      const side=new THREE.Vector3().crossVectors(direction,axis).normalize().multiplyScalar(.008+seeded(n+4)*.004);
      const mid=center.clone().addScaledVector(direction,length*.3);
      color.setHSL(.21+seeded(tuft+n)*.035,.31+lift*.17,.20+lift*.16);
      triangle(center,mid.clone().add(side),tip,color);
      triangle(center,tip,mid.clone().sub(side),color.clone().multiplyScalar(.78));
    }
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();return geometry;
}
