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
  return .91 / Math.pow(Math.pow(Math.abs(Math.cos(a)),4)+Math.pow(Math.abs(Math.sin(a)),4),.25)
    + .055*Math.sin(3*a+.4)+.028*Math.cos(7*a)+.018*Math.sin(19*a)+.008*Math.sin(43*a);
}
function baseHeight(x:number,z:number):number {
  const r=Math.hypot(x/10.2,z/8.0), edge=coast(Math.atan2(z/8,x/10.2));
  if(r>edge) return -1.1;
  const warp=(noise(x*.85,z*.85)-.5)*.32;
  let mass=0;
  for(const [cx,cz,len,width,angle,h] of ridges) {
    const dx=x-cx,dz=z-cz;
    const u=(dx*Math.cos(angle)+dz*Math.sin(angle))/len;
    // A bent crest, an eroded saddle and two unequal flanks replace the cone.
    const bend=Math.sin(u*3.2+cx)*.18+u*.14;
    const v=(-dx*Math.sin(angle)+dz*Math.cos(angle))/width+bend;
    const along=Math.pow(Math.max(0,1-u*u),.72);
    const across=Math.max(0,1-Math.abs(v)+warp*.55);
    const flank=Math.pow(across,v>0?.66:1.45);
    const saddle=1-.24*Math.exp(-Math.pow((u-.2)/.18,2))*Math.max(0,1-Math.abs(v));
    const body=along*flank*saddle*h*(.84+noise(u*3+cx,cz)*.16);
    mass=Math.max(mass,body);
  }
  const strata=(noise(x*2.7,z*2.7)-.5)*.20+(noise(x*8,z*8)-.5)*.075;
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
const terraces=Object.values(sites).flat().map(([x,z])=>({x,z,y:Math.max(.3,baseHeight(x,z)),radius:.32}));
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
  const color=new THREE.Color(), moss=new THREE.Color('#6f7d49');
  for(let ring=0;ring<=rings;ring++) for(let s=0;s<segments;s++) {
    const a=s/segments*Math.PI*2,t=Math.max(.0001,ring/rings),radius=coast(a);
    const x=Math.cos(a)*10.2*t*radius,z=Math.sin(a)*8*t*radius,y=heightAt(x,z);
    positions.push(x,y,z);
    const slope=Math.hypot(heightAt(x+.07,z)-y,heightAt(x,z+.07)-y)/.07;
    color.set('#898677').lerp(new THREE.Color('#343832'),1-smooth(-.55,.25,y));
    if(y>-.5 && y<.65) color.lerp(new THREE.Color('#77715b'),(1-smooth(.3,1.8,slope))*.48);
    color.multiplyScalar(.83+noise(x*9,z*9)*.24);
    if(y>-.35 && slope<2.2) color.lerp(moss,(.22+noise(x*1.3,z*1.3)*.28)*smooth(-.4,.3,y));
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
  // Branchlets leave irregular gaps instead of forming a circular leaf card.
  ctx.lineCap='round';
  for(let branch=0;branch<9;branch++) {
    const angle=branch*2.399, reach=28+random(branch+31)*29;
    const endX=64+Math.cos(angle)*reach,endY=66+Math.sin(angle)*reach;
    ctx.strokeStyle='#817d68';ctx.lineWidth=1.1;
    ctx.beginPath();ctx.moveTo(64,68);ctx.quadraticCurveTo(64+Math.cos(angle+.3)*reach*.5,66+Math.sin(angle+.3)*reach*.5,endX,endY);ctx.stroke();
    for(let leaf=0;leaf<11;leaf++) {
      const t=.22+leaf*.068,side=leaf%2?1:-1;
      const x=64+(endX-64)*t+Math.cos(angle+Math.PI/2)*side*6;
      const y=66+(endY-66)*t+Math.sin(angle+Math.PI/2)*side*6;
      const shade=165+Math.floor(random(branch*17+leaf)*85);
      ctx.fillStyle=`rgb(${shade},${shade},${Math.floor(shade*.92)})`;
      ctx.beginPath();ctx.ellipse(x,y,3+random(leaf+branch)*2.6,1.5+random(leaf+9)*1.3,angle+side*.65,0,Math.PI*2);ctx.fill();
    }
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
  const leafMaterial=new THREE.MeshStandardMaterial({map:foliageTexture(),alphaTest:.28,alphaToCoverage:true,side:THREE.DoubleSide,roughness:.95});
  leafMaterial.onBeforeCompile=shader=>{
    // A small diffuse contribution approximates light passing through thin leaves.
    // It retains each tree's instance color, including the autumn foliage.
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>', 'outgoingLight += diffuseColor.rgb * .055;\n#include <opaque_fragment>');
  };
  const leaves=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),leafMaterial,11000);
  const crownGeometry=new THREE.IcosahedronGeometry(1,2), crownPositions=crownGeometry.getAttribute('position');
  for(let i=0;i<crownPositions.count;i++) {
    const x=crownPositions.getX(i),y=crownPositions.getY(i),z=crownPositions.getZ(i);
    const r=.78+noise(x*5+z*2,y*5)*.3;crownPositions.setXYZ(i,x*r,y*r,z*r);
  }
  crownGeometry.computeVertexNormals();
  const crowns=new THREE.InstancedMesh(crownGeometry,new THREE.MeshStandardMaterial({roughness:1,color:'#d1d2b8'}),4500);
  const wood=new THREE.InstancedMesh(new THREE.CylinderGeometry(.009,.018,1,5),new THREE.MeshStandardMaterial({color:'#8f8165',roughness:1}),3500);
  const o=new THREE.Object3D(),c=new THREE.Color();let ri=0,li=0,ti=0,ci=0;
  for(let i=0;i<3600;i++) {
    const x=(random(i*7)-.5)*20,z=(random(i*7+1)-.5)*15,y=heightAt(x,z);
    if(y<-.42 || anchors.some(a=>Math.hypot(a.x-x,a.z-z)<.46)) continue;
    const slope=Math.hypot(heightAt(x+.08,z)-y,heightAt(x,z+.08)-y)/.08;
    const scale=.035+Math.pow(random(i*7+2),2)*.21;
    if(ri<2800) {
      o.position.set(x,y-.04,z);o.rotation.set(random(i)*.5,random(i+2)*6,random(i+3)*.4);
      o.scale.set(scale*(1+random(i+5)),scale*(.5+random(i+9)),scale);o.updateMatrix();rocks.setMatrixAt(ri,o.matrix);
      c.set('#aaa596').multiplyScalar(.64+random(i+18)*.38);rocks.setColorAt(ri++,c);
    }
    // Low vegetation follows moist, sheltered shelves, with open gravel between patches.
    if(y>-.35 && slope<1.6 && noise(x*1.2,z*1.2)>.52 && ci<4400) {
      o.position.set(x,y+.025,z);o.rotation.set(0,random(i)*6,0);o.scale.set(.13+random(i+34)*.16,.04+random(i+35)*.06,.12+random(i+36)*.15);o.updateMatrix();crowns.setMatrixAt(ci,o.matrix);
      c.set('#626d3d').multiplyScalar(.75+random(i+37)*.4);crowns.setColorAt(ci++,c);
    }
    if(y<.05 || slope>3.5 || noise(x*.95+3,z*.95)<.47 || ti>3400 || li>10900) continue;
    const tall=random(i+94)>.73, h=(tall?.55:.24)+random(i+44)*(tall?.6:.42);
    o.position.set(x,y+h*.5,z);o.rotation.set(0,random(i)*6,.12*(random(i)-.5));o.scale.set(1,h,1);o.updateMatrix();wood.setMatrixAt(ti++,o.matrix);
    const autumn=x<-.8 && z>.7;
    for(let branch=0;branch<7;branch++) {
      const angle=branch*2.4+random(i)*6,level=.38+branch*.085,spread=h*(tall?.23:.44)*Math.sin(level*Math.PI)*(.8+random(i+branch)*.4);
      const bx=x+Math.cos(angle)*spread,bz=z+Math.sin(angle)*spread,by=y+h*level;
      const from=new THREE.Vector3(x,y+h*(level-.15),z),to=new THREE.Vector3(bx,by,bz);
      o.position.copy(from).lerp(to,.5);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),to.clone().sub(from).normalize());o.scale.set(.5,from.distanceTo(to),.5);o.updateMatrix();wood.setMatrixAt(ti++,o.matrix);
      if(ci<4500) {
        o.position.set(bx,by,bz);o.rotation.set(.2,angle,.15);o.scale.set(h*(tall?.095:.12),h*.12,h*.11);o.updateMatrix();crowns.setMatrixAt(ci,o.matrix);
        c.set(autumn?'#936b32':tall?'#405837':'#647640').multiplyScalar(.8+random(i+branch)*.35);crowns.setColorAt(ci++,c);
      }
      for(let cross=0;cross<3;cross++) {
        o.position.set(bx,by+(random(i+branch+cross)-.5)*h*.12,bz);o.rotation.set(.45+cross*.8,angle+cross*1.05,random(i+branch)*.6);o.scale.set(h*(tall?.54:.80),h*(.38+random(i+branch)*.18),1);o.updateMatrix();leaves.setMatrixAt(li,o.matrix);
        c.set(autumn?(random(i)>.5?'#c3934b':'#a88647'):(tall?'#466343':'#6c8548'));
        c.offsetHSL((random(i+branch)-.5)*.045,0,(random(i*2+branch)-.5)*.12);leaves.setColorAt(li++,c);
      }
    }
  }
  rocks.count=ri;leaves.count=li;wood.count=ti;crowns.count=ci;crowns.castShadow=true;crowns.receiveShadow=true;
  rocks.castShadow=true;rocks.receiveShadow=true;leaves.castShadow=true;leaves.receiveShadow=true;wood.castShadow=true;
  group.add(rocks,crowns,leaves,wood);
  addCliffLayers(group, anchors);
}

// Actual broken ledges interrupt smooth slopes at a scale larger than a texture.
function addCliffLayers(group:THREE.Group,anchors:THREE.Vector3[]) {
  // Embedded fractured blocks form faces, rather than a stack of identical disks.
  const geometry=new THREE.IcosahedronGeometry(1,1);
  const positions=geometry.getAttribute('position');
  const colors:number[]=[],color=new THREE.Color();
  for(let i=0;i<positions.count;i++) {
    const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);
    const fracture=.76+noise(x*3+z,y*2)*.3;
    positions.setXYZ(i,x*fracture+y*.14,y*.78+Math.sin(x*4+z)*.10,z*fracture);
    color.set('#8f8c7b').multiplyScalar(.79+noise(x*3,z*3)*.24);
    colors.push(color.r,color.g,color.b);
  }
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();
  const cliffs=new THREE.InstancedMesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,flatShading:true}),150);
  const object=new THREE.Object3D();let count=0;
  for(let i=0;i<2300 && count<150;i++) {
    const x=(random(i+8001)-.5)*18,z=(random(i+12001)-.5)*14,y=heightAt(x,z);
    if(y<.15 || anchors.some(a=>Math.hypot(a.x-x,a.z-z)<.62)) continue;
    const dx=(heightAt(x+.08,z)-heightAt(x-.08,z))/.16;
    const dz=(heightAt(x,z+.08)-heightAt(x,z-.08))/.16;
    const slope=Math.hypot(dx,dz);if(slope<1.45||slope>6) continue;
    const h=.38+random(i+22)*.72,w=.25+random(i+23)*.45;
    object.position.set(x,y-h*.48,z);
    object.rotation.set(Math.atan(dz)*.22,Math.atan2(dx,dz)+.35, -Math.atan(dx)*.22);
    object.scale.set(w,h,w*(.45+random(i+29)*.3));object.updateMatrix();cliffs.setMatrixAt(count++,object.matrix);
  }
  cliffs.count=count;cliffs.castShadow=true;cliffs.receiveShadow=true;group.add(cliffs);
}

// Neutral scenic trails; these routes never add graph relationships.
export function surfacePath(a:THREE.Vector3,b:THREE.Vector3):THREE.Vector3[] {
  const length=Math.hypot(b.x-a.x,b.z-a.z),side=new THREE.Vector3(b.z-a.z,0,a.x-b.x).normalize();
  const steps=Math.max(2,Math.ceil(length/.085));
  const position=(t:number,bend:number)=>{
    const p=a.clone().lerp(b,t).addScaledVector(side,Math.sin(t*Math.PI)*bend);
    p.y=heightAt(p.x,p.z);return p;
  };
  let bend=0,best=Infinity;
  for(const candidate of [-1.4,-.7,0,.7,1.4]) {
    let cost=Math.abs(candidate)*.12,previous=position(0,candidate);
    for(let k=1;k<=32;k++) {
      const p=position(k/32,candidate),rise=Math.abs(p.y-previous.y);
      const run=Math.max(.01,Math.hypot(p.x-previous.x,p.z-previous.z));
      cost+=rise*rise+Math.pow(Math.max(0,rise/run-1.1),2)*.2+(p.y<.05?.5:0);previous=p;
    }
    if(cost<best) {best=cost;bend=candidate;}
  }
  return Array.from({length:steps+1},(_,i)=>position(i/steps,bend));
}
export function buildFootpath(points:THREE.Vector3[]) {
  const group=new THREE.Group();if(points.length<2) return group;
  const routes:THREE.Vector3[][]=[],connected=new Set([0]);
  // A short scenic tree connects the landings without crisscrossing them in ID order.
  while(connected.size<points.length) {
    let from=0,to=-1,best=Infinity;
    for(const i of connected) for(let j=0;j<points.length;j++) {
      if(connected.has(j)) continue;
      const cost=Math.hypot(points[i].x-points[j].x,points[i].z-points[j].z)+Math.abs(points[i].y-points[j].y)*.8;
      if(cost<best) {best=cost;from=i;to=j;}
    }
    routes.push(surfacePath(points[from],points[to]));connected.add(to);
  }
  const vertices:number[]=[],indices:number[]=[],matrices:THREE.Matrix4[]=[],object=new THREE.Object3D();
  for(const route of routes) {
    const offset=vertices.length/3;
    route.forEach((p,i)=>{
      const before=route[Math.max(0,i-1)],after=route[Math.min(route.length-1,i+1)];
      const tangent=after.clone().sub(before);tangent.y=0;tangent.normalize();
      for(const sign of [-1,1]) {
        const x=p.x-tangent.z*.065*sign,z=p.z+tangent.x*.065*sign;
        vertices.push(x,heightAt(x,z)+.018,z);
      }
      if(i<route.length-1) {
        const k=offset+i*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);
        const q=route[i+1],rise=q.y-p.y,run=Math.hypot(q.x-p.x,q.z-p.z);
        // Quiet earth on gentle sections, a real tread only where a step is needed.
        if(Math.abs(rise)/Math.max(.01,run)>.5 && i%2===0) {
          object.position.copy(p);object.position.y+=.025;
          object.rotation.set(0,Math.atan2(q.x-p.x,q.z-p.z),0);object.updateMatrix();matrices.push(object.matrix.clone());
        }
      }
    });
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();
  const trail=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:'#8f8872',roughness:1,side:THREE.DoubleSide}));
  trail.receiveShadow=true;group.add(trail);
  const steps=new THREE.InstancedMesh(new THREE.BoxGeometry(.135,.025,.075),new THREE.MeshStandardMaterial({color:'#aaa48f',roughness:1}),matrices.length);
  matrices.forEach((matrix,i)=>steps.setMatrixAt(i,matrix));steps.receiveShadow=true;group.add(steps);return group;
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
  for(const point of [start,end]) {
    const landing=new THREE.Mesh(new THREE.CylinderGeometry(.26,.32,.07,10),stone);
    landing.position.copy(point);landing.position.y-=.015;
    landing.receiveShadow=true;landing.castShadow=true;group.add(landing);
  }
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
      textureStrength.value = .65;
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
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec3 weights=pow(abs(normalize(cross(dFdx(vRockPosition),dFdy(vRockPosition)))),vec3(4.));
      weights/=max(.001,weights.x+weights.y+weights.z);
      vec3 rock=texture2D(rockTexture,vRockPosition.yz*.22).rgb*weights.x
        +texture2D(rockTexture,vRockPosition.xz*.22).rgb*weights.y
        +texture2D(rockTexture,vRockPosition.xy*.22).rgb*weights.z;
      rock=mix(vec3(dot(rock,vec3(.2126,.7152,.0722))),rock,.22);
      diffuseColor.rgb=mix(diffuseColor.rgb,rock*.98,rockTextureStrength*smoothstep(0.,.5,vRockPosition.y));
      float bandPosition=vRockPosition.y*15.+sin(vRockPosition.x*1.7)+sin(vRockPosition.z*1.3);
      float bandAA=1.-smoothstep(.3,1.6,fwidth(bandPosition));
      float strata=sin(bandPosition)*bandAA;
      float mineral=sin(vRockPosition.x*4.+sin(vRockPosition.z*3.));
      diffuseColor.rgb*=.97+strata*.045+mineral*.035;
      // Mineral variation stays broad enough to survive the overview camera.
      float lichen=smoothstep(.45,.82,sin(vRockPosition.x*2.1+sin(vRockPosition.z*2.8))*.5+.5)*weights.y;
      diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.82,.94,.68),lichen*.24);

    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      // Screen-space surface gradient: bounded micro-relief from the rock albedo.
      float relief=dot(rock,vec3(.2126,.7152,.0722))*.045*rockTextureStrength;
      vec3 surfaceDx=dFdx(-vViewPosition),surfaceDy=dFdy(-vViewPosition);
      vec3 tangentX=cross(surfaceDy,normal),tangentY=cross(normal,surfaceDx);
      float determinant=dot(surfaceDx,tangentX);
      vec3 reliefGradient=sign(determinant)*(dFdx(relief)*tangentX+dFdy(relief)*tangentY);
      normal=normalize(abs(determinant)*normal-reliefGradient);
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
