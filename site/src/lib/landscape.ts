import * as THREE from 'three';

// Deterministic art direction: heights are scenery, never competency scores.
export const random = (n: number) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453123; return v - Math.floor(v); };
function noise(x: number, z: number): number {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  return (random(ix + iz * 157) * (1-u) + random(ix+1 + iz*157)*u)*(1-v)
    + (random(ix+(iz+1)*157)*(1-u)+random(ix+1+(iz+1)*157)*u)*v;
}
const smooth = (a:number,b:number,x:number) => THREE.MathUtils.smoothstep(x,a,b);

// Elongated, overlapping ridges create four different silhouettes and a winding valley.
// x, z, length, width, heading, height
const ridges = [
  [-5.2,-4.5,3.4,1.35,-.55,5.7],[-5.7,-1.8,3.0,1.8,.55,3.3],[-2.9,-2.8,2.3,1.2,-.7,2.9],
  [3.6,-3.9,3.2,1.5,.75,4.8],[6.0,-2.5,2.5,1.65,-.5,3.3],[3.0,-.7,1.9,1.35,.2,2.5],
  [-5.2,3.5,3.8,2.0,.6,3.5],[-2.6,3.0,2.3,1.15,-.4,2.7],[-6.5,1.5,1.9,1.1,.1,2.8],
  [4.1,3.6,3.8,1.8,-.65,3.7],[6.6,3.7,2.2,1.4,.3,2.65],[2.2,5.3,2.5,1.3,.6,2.4],
  [-.7,-4.9,1.0,.7,.3,1.6],[.5,-1.0,.9,.6,-.6,1.5],[-.4,2.0,.65,.5,0,1.2],
  [-8.6,-.2,.8,.55,.5,1.1],[8.5,-4.5,.8,.5,-.2,1.2],[8.3,1.2,.9,.5,1,1.2],[-1.1,6.6,.7,.5,0,1.0],
];
export function coast(a:number) {
  return .95 / Math.pow(Math.pow(Math.abs(Math.cos(a)),4)+Math.pow(Math.abs(Math.sin(a)),4),.25)
    + .055*Math.sin(3*a+.4)+.028*Math.cos(7*a)+.018*Math.sin(19*a)+.008*Math.sin(43*a);
}
function baseHeight(x:number,z:number):number {
  const r=Math.hypot(x/10.2,z/8.0), edge=coast(Math.atan2(z/8,x/10.2));
  if(r>edge) return -1.1;
  const warp=(noise(x*.85,z*.85)-.5)*.32;
  let mass=0;
  for(const [cx,cz,len,width,angle,h] of ridges) {
    const dx=x-cx,dz=z-cz, u=(dx*Math.cos(angle)+dz*Math.sin(angle))/len;
    const v=(-dx*Math.sin(angle)+dz*Math.cos(angle))/width;
    const distance=Math.sqrt(u*u+v*v)+warp;
    const body=Math.pow(Math.max(0,1-distance),.68)*h;
    mass=Math.max(mass,body);
  }
  const strata=(noise(x*2.7,z*2.7)-.5)*.26+(noise(x*8,z*8)-.5)*.10;
  // Low shelves break up the coast without making another raised, flat platter.
  const shore=Math.pow(noise(x*.8+16,z*.8),4)*.5;
  return -.62 + (mass+strata*smooth(0,.7,mass)+shore)*(1-smooth(edge-.10,edge,r));
}

const sites:Record<string,number[][]> = {
  AI:[[-4.7,-4.8],[-5.3,-3.8],[-3.6,-3.5],[-2.5,-2.7],[-3.8,-1.7],[-6.5,-2.5],[-7,-1.5],[-5.8,-.8],[-5.1,-2],[-6.3,-3.5],[-6.4,-5.4],[-5.3,-5.8],[-4.3,-5.6],[-7.1,-4.5],[-3.4,-4.8]],
  BIZ:[[6.6,-3.2],[7.2,-2.3],[5.7,-2.3],[6.3,-1.3],[7,-3.8],[3.0,-1.2],[3.8,-.4],[4.8,-1.2],[2.4,-2.1],[4,-2.3],[3.8,-4.3],[3,-5.1],[4.6,-3.4],[5,-4.6],[2.5,-3.8]],
  PRO:[[-5.8,5.6],[-4.8,5],[-6.5,4.5],[-4,5.8],[-6.8,3.5],[-2.6,3.1],[-3.4,2.4],[-2.2,4],[-4.1,3.7],[-3.4,4.7],[-5.8,1.3],[-6.8,1.9],[-5.2,2.4],[-4.5,1.5],[-5.8,3.5]],
  SOC:[[6.4,3.6],[7.2,4.3],[5.8,4.6],[6.7,2.4],[7.5,3.2],[3.5,5.8],[2.3,5.3],[4.4,6.1],[4.4,4.9],[2.5,6.3],[3.5,1.8],[4.5,2.5],[3.2,3.2],[5.3,3.4],[4.1,4]],
};
const terraces=Object.values(sites).flat().map(([x,z])=>({x,z,y:Math.max(.3,baseHeight(x,z)),radius:.43}));
export function terrainSite(domain:string,index:number,fallback:[number,number,number]):THREE.Vector3 {
  const [x,z]=sites[domain]?.[index] ?? [fallback[0],fallback[2]];
  return new THREE.Vector3(x,heightAt(x,z),z);
}
export function heightAt(x:number,z:number):number {
  let h=baseHeight(x,z);
  for(const t of terraces) {
    const distance=Math.hypot(x-t.x,z-t.z);
    if(distance<t.radius+.4) h=THREE.MathUtils.lerp(h,t.y,1-smooth(t.radius*.65,t.radius+.4,distance));
  }
  return h;
}
export function landscapeGeometry() {
  const rings=160,segments=320;
  const positions:number[]=[],colors:number[]=[],indices:number[]=[];
  const color=new THREE.Color(), moss=new THREE.Color('#666e42');
  for(let ring=0;ring<=rings;ring++) for(let s=0;s<segments;s++) {
    const a=s/segments*Math.PI*2,t=Math.max(.0001,ring/rings),radius=coast(a);
    const x=Math.cos(a)*10.2*t*radius,z=Math.sin(a)*8*t*radius,y=heightAt(x,z);
    positions.push(x,y,z);
    const slope=Math.hypot(heightAt(x+.07,z)-y,heightAt(x,z+.07)-y)/.07;
    color.set(y<-.25?'#303632':'#827e6c');
    color.multiplyScalar(.83+noise(x*9,z*9)*.24);
    if(y>0 && slope<2.2) color.lerp(moss,.30+noise(x*1.3,z*1.3)*.28);
    colors.push(color.r,color.g,color.b);
    if(ring<rings) {const i=ring*segments+s,j=ring*segments+(s+1)%segments;indices.push(i,j,i+segments,j,j+segments,i+segments);}
  }
  for(let layer=1;layer<=9;layer++) for(let s=0;s<segments;s++) {
    const a=s/segments*Math.PI*2,radius=coast(a)+(noise(s*.3,layer*.6)-.5)*.018;
    positions.push(Math.cos(a)*10.2*radius,-.62-layer*.075-random(s)*.045,Math.sin(a)*8*radius);
    color.set(layer%3===0?'#777162':'#4b4d43').multiplyScalar(.72+random(s*13+layer)*.3);colors.push(color.r,color.g,color.b);
    const i=(rings+layer-1)*segments+s,j=(rings+layer-1)*segments+(s+1)%segments;indices.push(i,j,i+segments,j,j+segments,i+segments);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();return g;
}

function foliageTexture() {
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
  const ctx=canvas.getContext('2d')!;
  // Many individual leaf silhouettes, with open space between the branchlets.
  for(let i=0;i<95;i++) {
    const a=random(i*5)*Math.PI*2,r=Math.sqrt(random(i*5+1))*54;
    const x=64+Math.cos(a)*r,y=64+Math.sin(a)*r;
    ctx.fillStyle=`rgb(${180+Math.floor(random(i+4)*65)},${180+Math.floor(random(i+4)*65)},${180+Math.floor(random(i+4)*65)})`;
    ctx.beginPath();ctx.ellipse(x,y,4+random(i+6)*4,2+random(i+7)*2.8,a,0,Math.PI*2);ctx.fill();
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}
export function populateLandscape(group:THREE.Group,anchors:THREE.Vector3[]) {
  const rockGeo=new THREE.IcosahedronGeometry(1,1), attr=rockGeo.getAttribute('position');
  for(let i=0;i<attr.count;i++) {
    const x=attr.getX(i),y=attr.getY(i),z=attr.getZ(i),r=.85+noise(x*3,z*3)*.25;
    attr.setXYZ(i,x*r,y*.65+Math.sin(x*6+z)*.12,z*r);
  }
  rockGeo.computeVertexNormals();
  const rocks=new THREE.InstancedMesh(rockGeo,new THREE.MeshStandardMaterial({color:'#878271',roughness:1,flatShading:true}),2800);
  const leaves=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),new THREE.MeshStandardMaterial({map:foliageTexture(),alphaTest:.22,side:THREE.DoubleSide,roughness:.95}),11000);
  const wood=new THREE.InstancedMesh(new THREE.CylinderGeometry(.009,.018,1,5),new THREE.MeshStandardMaterial({color:'#8f8165',roughness:1}),3500);
  const o=new THREE.Object3D(),c=new THREE.Color();let ri=0,li=0,ti=0;
  for(let i=0;i<3600;i++) {
    const x=(random(i*7)-.5)*20,z=(random(i*7+1)-.5)*15,y=heightAt(x,z);
    if(y<-.2 || anchors.some(a=>Math.hypot(a.x-x,a.z-z)<.46)) continue;
    const slope=Math.hypot(heightAt(x+.08,z)-y,heightAt(x,z+.08)-y)/.08;
    const scale=.035+Math.pow(random(i*7+2),2)*.21;
    if(ri<2800) {
      o.position.set(x,y-.04,z);o.rotation.set(random(i)*.5,random(i+2)*6,random(i+3)*.4);
      o.scale.set(scale*(1+random(i+5)),scale*(.5+random(i+9)),scale);o.updateMatrix();rocks.setMatrixAt(ri++,o.matrix);
    }
    if(y<.05 || slope>3.5 || noise(x*.95+3,z*.95)<.47 || ti>3400 || li>10900) continue;
    const tall=random(i+94)>.73, h=(tall?.6:.32)+random(i+44)*(tall?.65:.42);
    o.position.set(x,y+h*.5,z);o.rotation.set(0,random(i)*6,.12*(random(i)-.5));o.scale.set(1,h,1);o.updateMatrix();wood.setMatrixAt(ti++,o.matrix);
    const autumn=x<-.8 && z>.7;
    for(let branch=0;branch<7;branch++) {
      const angle=branch*2.4+random(i)*6,level=.38+branch*.085,spread=h*(tall?.17:.3)*(1-level*.5);
      const bx=x+Math.cos(angle)*spread,bz=z+Math.sin(angle)*spread,by=y+h*level;
      const from=new THREE.Vector3(x,y+h*(level-.15),z),to=new THREE.Vector3(bx,by,bz);
      o.position.copy(from).lerp(to,.5);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),to.clone().sub(from).normalize());o.scale.set(.5,from.distanceTo(to),.5);o.updateMatrix();wood.setMatrixAt(ti++,o.matrix);
      for(let cross=0;cross<3;cross++) {
        o.position.set(bx,by,bz);o.rotation.set(.25+cross*.9,angle+cross*1.05,.2);o.scale.set(h*(tall?.55:.82),h*.64,1);o.updateMatrix();leaves.setMatrixAt(li,o.matrix);
        c.set(autumn?(random(i)>.5?'#be8740':'#92753b'):(tall?'#58694a':'#899151'));
        c.offsetHSL((random(i+branch)-.5)*.045,0,(random(i*2+branch)-.5)*.12);leaves.setColorAt(li++,c);
      }
    }
  }
  rocks.count=ri;leaves.count=li;wood.count=ti;
  rocks.castShadow=true;rocks.receiveShadow=true;leaves.castShadow=true;leaves.receiveShadow=false;wood.castShadow=true;
  group.add(rocks,leaves,wood);
}

// Footpaths are neutral scenery; colored curves alone encode graph relationships.
export function buildFootpath(points:THREE.Vector3[]) {
  const path=new THREE.Group(),stone=new THREE.MeshStandardMaterial({color:'#b2ab92',roughness:1});
  for(let n=1;n<points.length;n++) {
    const a=points[n-1],b=points[n],steps=Math.ceil(a.distanceTo(b)/.10);
    for(let i=0;i<=steps;i++) {
      const t=i/steps,x=THREE.MathUtils.lerp(a.x,b.x,t),z=THREE.MathUtils.lerp(a.z,b.z,t);
      const y=heightAt(x,z);if(y<0) continue;
      const step=new THREE.Mesh(new THREE.BoxGeometry(.14,.035,.10),stone);
      step.position.set(x,y+.025,z);step.rotation.y=Math.atan2(b.x-a.x,b.z-a.z);step.receiveShadow=true;path.add(step);
    }
  }
  return path;
}

export function buildBridge(start:THREE.Vector3,end:THREE.Vector3) {
  const group=new THREE.Group(), stone=new THREE.MeshStandardMaterial({color:'#b5ae98',roughness:.92});
  const length=start.distanceTo(end), side=new THREE.Vector3(end.z-start.z,0,start.x-end.x).normalize();
  const control=start.clone().lerp(end,.5);control.y+=.6;
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
      textureStrength.value = .56;
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
