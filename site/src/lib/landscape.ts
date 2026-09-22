import * as THREE from 'three';

// All landscape assets are generated locally. The seed keeps landmarks stable.
export const random = (n: number) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453123; return v - Math.floor(v); };
function noise(x: number, z: number): number {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = random(ix + iz * 157), b = random(ix + 1 + iz * 157);
  const c = random(ix + (iz + 1) * 157), d = random(ix + 1 + (iz + 1) * 157);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}
const centers = [[-4.5,-3.25],[4.4,-3.1],[-4.25,3.35],[4.35,3.35]];
export function coast(a: number) { return .94 / Math.pow(Math.pow(Math.abs(Math.cos(a)),5)+Math.pow(Math.abs(Math.sin(a)),5),.2) + .04 * Math.sin(3*a+.4) + .03 * Math.cos(7*a) + .018 * Math.sin(13*a); }
export function heightAt(x: number, z: number): number {
  const r = Math.hypot(x/10.8,z/8.5);
  if (r > coast(Math.atan2(z/8.5,x/10.8))) return -1.05;
  const n = noise(x*.65,z*.65);
  let mass = 0;
  for (const [cx,cz] of centers) {
    const distance = Math.hypot((x-cx)/3.6,(z-cz)/3.15);
    const ridge = Math.max(0,1-distance + (n-.5)*.38);
    mass = Math.max(mass, Math.min(1,ridge*3.8) * (1.35 + ridge*1.4));
  }
  for (const [cx,cz] of [[-7.8,-.5],[.6,-5.8],[.3,.9],[8.7,.4],[-1.5,6.5]]) {
    const distance=Math.hypot(x-cx,z-cz);
    mass=Math.max(mass,Math.min(1,Math.max(0,.7-distance)*5)*1.15);
  }
  let peak = Math.pow(noise(x*.47+5,z*.47),3)*2.7;
  for (const [cx,cz] of centers) {
    const ridgeDistance=Math.hypot((x-cx+.8)/.9,(z-cz+1.1)/1.3);
    peak += Math.min(1,Math.max(0,1-ridgeDistance+(noise(x*3,z*3)-.5)*.30)*5.5)*(2.1+noise(x*4,z*4)*.65);
  }
  const rock = (noise(x*3,z*3)-.5)*.24 + (noise(x*9,z*9)-.5)*.085;
  return -.66 + mass + (mass > .7 ? peak + rock : rock*.2);
}
export function landscapeGeometry() {
  const rings=120, segments=256;
  const positions:number[]=[], colors:number[]=[], indices:number[]=[];
  const color = new THREE.Color();
  for(let ring=0;ring<=rings;ring++) for(let s=0;s<segments;s++) {
    const a=s/segments*Math.PI*2, t=Math.max(.0001,ring/rings), radius=coast(a);
    const x=Math.cos(a)*10.8*t*radius,z=Math.sin(a)*8.5*t*radius,y=heightAt(x*.999,z*.999);
    positions.push(x,y,z);
    const grain=noise(x*17,z*17), wet=y<.05;
    color.set(wet?'#252a29':'#77776a');
    color.multiplyScalar(.65+grain*.48);
    if(!wet && noise(x*1.8,z*1.8)>.56) color.lerp(new THREE.Color('#596340'),.26);
    colors.push(color.r,color.g,color.b);
    if(ring<rings){const i=ring*segments+s,j=ring*segments+(s+1)%segments;indices.push(i,j,i+segments,j,j+segments,i+segments);}
  }
  // A separate, jagged stratified edge gives the world physical thickness.
  for(let layer=1;layer<=8;layer++) for(let s=0;s<segments;s++) {
    const a=s/segments*Math.PI*2, radius=coast(a)+(random(s+layer*811)-.5)*.016;
    const x=Math.cos(a)*10.8*radius,z=Math.sin(a)*8.5*radius;
    positions.push(x,-.66-layer*.115-random(s)*.08,z);
    color.set(layer%3===0?'#58594f':'#343833').multiplyScalar(.7+random(s*13+layer)*.4);
    colors.push(color.r,color.g,color.b);
    const i=(rings+layer-1)*segments+s,j=(rings+layer-1)*segments+(s+1)%segments;
    indices.push(i,j,i+segments,j,j+segments,i+segments);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();return g;
}

export function populateLandscape(group:THREE.Group, anchors:THREE.Vector3[]) {
  const rockGeo=new THREE.IcosahedronGeometry(1,1);
  const rockPositions=rockGeo.getAttribute('position');
  for(let i=0;i<rockPositions.count;i++) {const s=.8+random(i)*.35;rockPositions.setXYZ(i,rockPositions.getX(i)*s,rockPositions.getY(i)*s,rockPositions.getZ(i)*s);}
  rockGeo.computeVertexNormals();
  const rocks=new THREE.InstancedMesh(rockGeo,new THREE.MeshStandardMaterial({color:'#858478',roughness:1,flatShading:true}),1800);
  const leaves=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,1),new THREE.MeshStandardMaterial({roughness:1,flatShading:true}),9000);
  const wood=new THREE.InstancedMesh(new THREE.CylinderGeometry(.017,.028,1,5),new THREE.MeshStandardMaterial({color:'#665640',roughness:1}),650);
  const o=new THREE.Object3D(),c=new THREE.Color();let ri=0,li=0,ti=0;
  for(let i=0;i<2300;i++) {
    const x=(random(i*7)-.5)*21,z=(random(i*7+1)-.5)*16,y=heightAt(x,z);
    if(y<.35 || anchors.some(a=>Math.hypot(a.x-x,a.z-z)<.35)) continue;
    const scale=.04+random(i*7+2)*.15;
    if(ri<1800){o.position.set(x,y-.05,z);o.rotation.set(random(i),random(i+2)*6,random(i+3));o.scale.set(scale*.9,scale*(1+random(i+9)*2.5),scale);o.updateMatrix();rocks.setMatrixAt(ri++,o.matrix);}
    if(noise(x*.8+3,z*.8)>.48 && ti<650) {
      const h=.16+random(i+44)*.42;
      o.position.set(x,y+h*.5,z);o.rotation.set(0,0,.12*(random(i)-.5));o.scale.set(1,h,1);o.updateMatrix();wood.setMatrixAt(ti++,o.matrix);
      const autumn=x<0 && z>0;
      for(let branch=0;branch<13 && li<9000;branch++) {
        const a=random(i*21+branch)*6.28, spread=branch===0?0:.10;
        o.position.set(x+Math.cos(a)*spread,y+h*(.65+random(i+branch)*.4),z+Math.sin(a)*spread);
        o.scale.setScalar(h*(.10+random(i*3+branch)*.14));o.scale.y*=1.25;o.updateMatrix();leaves.setMatrixAt(li,o.matrix);
        c.set(autumn?'#a88035':'#637643');c.offsetHSL((random(i+branch)-.5)*.07,0,(random(i*2+branch)-.5)*.2);leaves.setColorAt(li++,c);
      }
    }
  }
  rocks.count=ri;leaves.count=li;wood.count=ti;
  rocks.castShadow=true;rocks.receiveShadow=true;leaves.castShadow=true;wood.castShadow=true;
  group.add(rocks,leaves,wood);
}

export function buildBridge(start:THREE.Vector3,end:THREE.Vector3) {
  const group=new THREE.Group(), stone=new THREE.MeshStandardMaterial({color:'#aaa697',roughness:.92});
  const length=start.distanceTo(end), side=new THREE.Vector3(end.z-start.z,0,start.x-end.x).normalize();
  const control=start.clone().lerp(end,.5);control.y+=1.1;
  const curve=new THREE.QuadraticBezierCurve3(start,control,end);
  for(let i=0;i<40;i++) {
    const p=curve.getPoint(i/40),q=curve.getPoint((i+1)/40),mid=p.clone().lerp(q,.5);
    const deck=new THREE.Mesh(new THREE.BoxGeometry(.31,.085,p.distanceTo(q)+.015),stone);deck.position.copy(mid);deck.lookAt(q);deck.castShadow=true;deck.receiveShadow=true;group.add(deck);
    if(i%2===0) for(const sign of [-1,1]) {
      const post=new THREE.Mesh(new THREE.BoxGeometry(.035,.17,.035),stone);post.position.copy(p).addScaledVector(side,sign*.145);post.position.y+=.1;group.add(post);
    }
  }
  for(const sign of [-1,1]) {
    const pts=curve.getPoints(40).map(p=>p.addScaledVector(side,sign*.145).add(new THREE.Vector3(0,.18,0)));
    group.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),40,.023,5,false),stone));
  }
  for(const t of [.12,.88]) {const p=curve.getPoint(t),floor=heightAt(p.x,p.z);const h=Math.max(.1,p.y-floor);const pier=new THREE.Mesh(new THREE.BoxGeometry(.25,h,.3),stone);pier.position.copy(p);pier.position.y-=h/2;group.add(pier);}
  group.userData.length=length;return group;
}

export function rockMaterial(onLoad: () => void) {
  const textureStrength = { value: 0 };
  const placeholder = new THREE.DataTexture(new Uint8Array([255,255,255,255]),1,1);
  placeholder.needsUpdate = true;
  const rockTexture: {value: THREE.Texture} = {value: placeholder};
  const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.94,metalness:0,transparent:true,opacity:0});
  let requested = false;
  material.userData.loadTexture = () => {
    if(requested) return;
    requested = true;
    new THREE.TextureLoader().load('/assets/rocky-terrain.jpg', texture => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.anisotropy = 4;
      rockTexture.value = texture;
      textureStrength.value = .8;
      placeholder.dispose();
      onLoad();
    });
  };
  material.onBeforeCompile=shader=>{
    shader.uniforms.rockTexture = rockTexture;
    shader.uniforms.rockTextureStrength = textureStrength;
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vRockPosition;');
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvRockPosition=position;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
      varying vec3 vRockPosition;
      uniform sampler2D rockTexture;
      uniform float rockTextureStrength;
      float rockHash(vec3 p){return fract(sin(dot(p,vec3(12.9898,78.233,41.3)))*43758.5453);}
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec3 weights=pow(abs(normalize(cross(dFdx(vRockPosition),dFdy(vRockPosition)))),vec3(4.));
      weights/=max(.001,weights.x+weights.y+weights.z);
      vec3 rock=texture2D(rockTexture,vRockPosition.yz*.22).rgb*weights.x
        +texture2D(rockTexture,vRockPosition.xz*.22).rgb*weights.y
        +texture2D(rockTexture,vRockPosition.xy*.22).rgb*weights.z;
      rock=mix(vec3(dot(rock,vec3(.2126,.7152,.0722))),rock,.22);
      diffuseColor.rgb=mix(diffuseColor.rgb,rock*.98,rockTextureStrength*smoothstep(0.,.5,vRockPosition.y));
      float grain=rockHash(floor(vRockPosition*110.));
      float strata=sin(vRockPosition.y*53.+sin(vRockPosition.x*3.)+sin(vRockPosition.z*4.));
      float fissure=sin(vRockPosition.x*37.+vRockPosition.z*29.+sin(vRockPosition.y*4.));
      diffuseColor.rgb*=.88+grain*.22+strata*.025+fissure*.055;
    `);
  };
  return material;
}

export function makePavilion(x:number,z:number) {
  const group=new THREE.Group(), stone=new THREE.MeshStandardMaterial({color:'#d2cfba',roughness:.9});
  const y=heightAt(x,z);
  for(let step=0;step<3;step++) {
    const terrace=new THREE.Mesh(new THREE.CylinderGeometry(.46-step*.06,.48-step*.06,.045,32),stone);
    terrace.position.set(x,y+.025+step*.045,z);terrace.receiveShadow=true;group.add(terrace);
  }
  for(let i=0;i<6;i++) {
    const a=i/6*Math.PI*2;
    const column=new THREE.Mesh(new THREE.CylinderGeometry(.022,.032,.42,8),stone);
    column.position.set(x+Math.cos(a)*.29,y+.34,z+Math.sin(a)*.29);column.castShadow=true;group.add(column);
  }
  const roof=new THREE.Mesh(new THREE.CylinderGeometry(.34,.4,.075,6),stone);
  roof.position.set(x,y+.59,z);roof.castShadow=true;group.add(roof);
  return group;
}
