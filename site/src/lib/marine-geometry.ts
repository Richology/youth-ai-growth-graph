import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { random } from './landscape';

function colored(geometry:THREE.BufferGeometry,color:THREE.Color) {
  geometry.deleteAttribute('uv');
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(Array.from({length:geometry.getAttribute('position').count},()=>[color.r,color.g,color.b]).flat(),3));
  return geometry;
}
function surface(vertices:number[],indices:number[],colors:number[]) {
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}
function fin(points:number[][],color:THREE.Color) {
  const vertices=points.flat(),indices:number[]=[];
  for(let i=1;i<points.length-1;i++)indices.push(0,i,i+1,0,i+1,i);
  const geometry=surface(vertices,indices,[]).toNonIndexed();geometry.computeVertexNormals();return colored(geometry,color);
}

/** Tapered body, forked tail, fins, gills and two inset eyes, all true geometry. */
export function fishGeometry(gold=false) {
  const vertices:number[]=[],indices:number[]=[],colors:number[]=[],color=new THREE.Color();
  const rings=24,sides=16;
  for(let i=0;i<=rings;i++) {
    const t=i/rings,x=-.18+t*.40;
    const profile=Math.pow(Math.sin(Math.PI*t),.75)*(.55+.55*t);
    for(let j=0;j<=sides;j++) {
      const a=j/sides*Math.PI*2,y=Math.cos(a)*profile*.065,z=Math.sin(a)*profile*.038;
      vertices.push(x,y,z);
      const dorsal=THREE.MathUtils.smoothstep(Math.cos(a),-.25,.8);
      color.set(gold?'#d8c38b':'#d5dfd6').lerp(new THREE.Color(gold?'#5c6946':'#344f56'),dorsal*.88);
      // A muted lateral stripe, gill slit and small-scale variation survive close inspection.
      if(Math.abs(Math.cos(a))<.18)color.multiplyScalar(.76);
      if(t>.74 && t<.79 && Math.abs(Math.sin(a))>.55)color.multiplyScalar(.48);
      color.multiplyScalar(.94+.06*Math.sin(i*5+j*3));colors.push(color.r,color.g,color.b);
      if(i<rings && j<sides){const k=i*(sides+1)+j;indices.push(k,k+1,k+sides+1,k+1,k+sides+2,k+sides+1);}
    }
  }
  const body=surface(vertices,indices,colors),finColor=new THREE.Color(gold?'#b5a16b':'#839b95');
  const pieces=[body,
    fin([[-.09,.045,0],[-.04,.108,0],[.045,.063,0],[.09,.046,0]],finColor),
    fin([[-.08,-.035,0],[-.04,-.081,0],[.03,-.052,0]],finColor),
    fin([[.095,-.01,.026],[.025,-.045,.085],[.01,-.02,.03]],finColor),
    fin([[.095,-.01,-.026],[.01,-.02,-.03],[.025,-.045,-.085]],finColor)];
  for(const side of [-1,1]) {
    const iris=new THREE.SphereGeometry(.011,10,8);iris.scale(1,1,.45);iris.translate(.15,.018,side*.027);pieces.push(colored(iris,new THREE.Color('#b0ad7f')));
    const pupil=new THREE.SphereGeometry(.0065,10,8);pupil.scale(1,1,.4);pupil.translate(.151,.019,side*.032);pieces.push(colored(pupil,new THREE.Color('#101e20')));
  }
  const tail=fin([[0,0,0],[-.115,.09,0],[-.088,.008,0],[-.12,-.082,0],[-.015,-.015,0]],finColor);
  return {body:mergeGeometries(pieces.map(g=>g.index?g.toNonIndexed():g))!,tail};
}

/** Rounded arms with domed, granular skin rather than an extruded star icon. */
export function starfishGeometry() {
  const vertices:number[]=[],colors:number[]=[],indices:number[]=[],color=new THREE.Color(),rings=14,segments=160;
  for(let r=0;r<=rings;r++)for(let j=0;j<=segments;j++) {
    const t=r/rings,a=j/segments*Math.PI*2;
    const arm=Math.pow((1+Math.cos(a*5))*.5,3.5),radius=(.085+arm*.235)*(1+.09*Math.sin(a*3+.6));
    const bump=(random(r*segments+j+80)-.5)*.005*Math.sin(Math.PI*t);
    vertices.push(Math.cos(a)*radius*t,.015+(.035+arm*.018)*Math.sin(Math.PI*(1-t)*.5)+bump,Math.sin(a)*radius*t);
    color.set('#c08c4f').multiplyScalar(.78+random(r*segments+j+88)*.34);colors.push(color.r,color.g,color.b);
    if(r<rings && j<segments){const k=r*(segments+1)+j;indices.push(k,k+1,k+segments+1,k+1,k+segments+2,k+segments+1);}
  }
  return surface(vertices,indices,colors);
}

export function shellGeometry() {
  const vertices:number[]=[],colors:number[]=[],indices:number[]=[],color=new THREE.Color(),rings=12,segments=24;
  for(let r=0;r<=rings;r++)for(let j=0;j<=segments;j++) {
    const t=r/rings,a=-1.12+j/segments*2.24,rib=1+.065*Math.cos(a*24);
    vertices.push(Math.sin(a)*t*.085*rib,.045*Math.sin(Math.PI*t)*Math.cos(a*.6)+.004,Math.cos(a)*t*.12);
    color.set('#b4a48a').multiplyScalar(.82+.16*Math.cos(a*24)+.08*Math.sin(t*42));colors.push(color.r,color.g,color.b);
    if(r<rings && j<segments){const k=r*(segments+1)+j;indices.push(k,k+segments+1,k+1,k+1,k+segments+1,k+segments+2);}
  }
  return surface(vertices,indices,colors);
}

/** Curved ribbons with a raised midrib, tapered tips and irregular rooted rosettes. */
export function seagrassGeometry(seed:number,algae=false) {
  const vertices:number[]=[],colors:number[]=[],indices:number[]=[],color=new THREE.Color();
  const blades=algae?12:11+Math.floor(random(seed+18)*9),steps=20;
  for(let blade=0;blade<blades;blade++) {
    const n=seed*71+blade,a=random(n+201)*Math.PI*2,height=.55+random(n+301)*1.05;
    const baseX=(random(n+401)-.5)*.32,baseZ=(random(n+501)-.5)*.32,start=vertices.length/3;
    for(let k=0;k<=steps;k++) {
      const t=k/steps,lean=(.18+random(n+99)*.38)*t*t;
      const tip=t*(1-.13*t*t),width=(algae?.028:.014)*Math.pow(Math.sin(Math.PI*t),.6)+.0008;
      const turn=a+Math.sin(t*4+n)*.25;
      for(let edge=0;edge<3;edge++) {
        const side=edge-1;
        const flutter=algae?1+.25*Math.sin(t*24+n):1;
        vertices.push(baseX+(Math.cos(a)*.25+.75)*lean+Math.sin(turn)*width*side*flutter,
          height*tip+(edge===1?.009:0)*Math.sin(t*Math.PI),baseZ+(Math.sin(a)*.25+.3)*lean-Math.cos(turn)*width*side*flutter);
        color.set(algae?'#727943':'#819e47').lerp(new THREE.Color('#b5bf68'),t*.35).multiplyScalar((edge===1?1.14:.85)*(.8+random(n+202)*.3));colors.push(color.r,color.g,color.b);
      }
      if(k<steps)for(let edge=0;edge<2;edge++){const q=start+k*3+edge;indices.push(q,q+1,q+3,q+1,q+4,q+3);}
    }
  }
  return surface(vertices,indices,colors);
}
