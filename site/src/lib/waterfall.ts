import * as THREE from 'three';
import { heightAt, random } from './landscape';

// A single authored drainage route on the cyan mountain, independent of graph edges.
export const CASCADE_ROUTE = [[-5.2,-4.65],[-4.8,-4.55],[-4.4,-4.45],[-4.0,-4.35],[-3.6,-4.15],[-3.2,-4.0]];
export function buildWaterfall(time: {value:number}): THREE.Group {
  const group = new THREE.Group(); group.name = 'mountain-cascade';
  const shelves=[3.62,3.55,3.35,1.5,.6,-.12];
  const points = CASCADE_ROUTE.map(([x,z],i) => new THREE.Vector3(x, Math.max(shelves[i],heightAt(x,z)+.09),z));
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const positions:number[]=[], uvs:number[]=[], indices:number[]=[];
  const columns=16;
  for(let i=0;i<=128;i++) {
    const t=i/128,p=curve.getPoint(t),tangent=curve.getTangent(t);
    const side=new THREE.Vector3(tangent.z,0,-tangent.x).normalize();
    const width=.11+.34*Math.sin(Math.PI*t)+.08*t+.025*Math.sin(t*19);
    for(let j=0;j<=columns;j++) {
      const u=j/columns, across=(u*2-1);
      const q=p.clone().addScaledVector(side,width*across);
      // Independent raised strands give the water volume instead of a flat ribbon.
      q.y=Math.max(q.y,heightAt(q.x,q.z)+.055)+Math.sin(u*31+t*8)*.018+.018;
      positions.push(q.x,q.y,q.z);uvs.push(u,t);
      if(i<128 && j<columns){const k=i*(columns+1)+j;indices.push(k,k+1,k+columns+1,k+1,k+columns+2,k+columns+1);}
    }
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();
  const material=new THREE.ShaderMaterial({uniforms:{time,aerationScale:{value:1}},side:THREE.DoubleSide,transparent:true,depthWrite:false,
    vertexShader:`uniform float time;varying vec2 flowUv;varying vec3 flowNormal;varying vec3 eyeDirection;
      void main(){flowUv=uv;vec3 p=position;p.y+=.012*(.5+.5*sin(uv.y*83.-time*7.+uv.x*21.));
        vec4 mv=modelViewMatrix*vec4(p,1.);flowNormal=normalize(normalMatrix*normal);eyeDirection=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}`,
    fragmentShader:`uniform float time;uniform float aerationScale;varying vec2 flowUv;varying vec3 flowNormal;varying vec3 eyeDirection;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
      void main(){vec2 p=flowUv;
        float flow=p.y*12.-time*1.9;
        float strands=noise(vec2(p.x*13.,flow*1.8));
        float fine=noise(vec2(p.x*43.,flow*6.));
        float froth=noise(vec2(p.x*17.,flow*5.));
        float edge=smoothstep(0.,.16+noise(vec2(flow,p.x))*.08,p.x)*(1.-smoothstep(.78,.99,p.x));
        float split=smoothstep(.18,.55,strands);
        float plunge=smoothstep(.28,.52,p.y);
        float collision=exp(-pow((p.y-.40)/.055,2.))+exp(-pow((p.y-.80)/.06,2.));
        float aeration=plunge*.22+smoothstep(.58,.88,froth)*(.10+plunge*.28)+collision*.25;
        aeration*=aerationScale;
        float fresnel=pow(1.-abs(dot(normalize(flowNormal),normalize(eyeDirection))),3.);
        float glint=pow(max(0.,fine),6.)*.5;
        vec3 color=mix(vec3(.12,.38,.34),vec3(.96,.99,.98),.12+fine*.17+aeration+fresnel*.25)+glint;
        float sprayBreak=smoothstep(.55,.95,p.y)*froth*.22;
        gl_FragColor=vec4(color,edge*(.17+plunge*.12+split*.32+aeration*.25+sprayBreak));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`});
  group.add(new THREE.Mesh(geometry,material));
  // A narrow spring-fed channel follows the original rock surface into the fall.
  const source=points[0].clone();
  const creekPoints=[new THREE.Vector3(-5.58,heightAt(-5.58,-4.48)+.07,-4.48),new THREE.Vector3(-5.42,heightAt(-5.42,-4.56)+.07,-4.56),source];
  const creekCurve=new THREE.CatmullRomCurve3(creekPoints);
  const creekPositions:number[]=[],creekUvs:number[]=[],creekIndices:number[]=[];
  for(let i=0;i<=32;i++) {
    const t=i/32,p=creekCurve.getPoint(t),d=creekCurve.getTangent(t),side=new THREE.Vector3(d.z,0,-d.x).normalize();
    for(const sign of [-1,1]){const q=p.clone().addScaledVector(side,sign*(.055+t*.055));q.y=Math.max(q.y,heightAt(q.x,q.z)+.065);creekPositions.push(q.x,q.y,q.z);creekUvs.push((sign+1)/2,t);}
    if(i<32){const k=i*2;creekIndices.push(k,k+1,k+2,k+1,k+3,k+2);}
  }
  const creekGeometry=new THREE.BufferGeometry();creekGeometry.setAttribute('position',new THREE.Float32BufferAttribute(creekPositions,3));creekGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(creekUvs,2));creekGeometry.setIndex(creekIndices);creekGeometry.computeVertexNormals();
  const creekMaterial=material.clone();creekMaterial.uniforms.time=time;creekMaterial.uniforms.aerationScale.value=.12;
  const creek=new THREE.Mesh(creekGeometry,creekMaterial);creek.name='spring-channel';group.add(creek);
  const impact=points.at(-1)!.clone();impact.y=-.055;
  for(const [index,center,size] of [[0,points[2],.62],[1,points[4],.72],[2,impact,1.65]] as [number,THREE.Vector3,number][]) {
    const pool=new THREE.Mesh(new THREE.PlaneGeometry(size*2,size*2),new THREE.ShaderMaterial({uniforms:{time},transparent:true,depthWrite:false,side:THREE.DoubleSide,
      vertexShader:`varying vec2 poolUv;void main(){poolUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader:`uniform float time;varying vec2 poolUv;void main(){vec2 p=(poolUv-.5)*2.;float r=length(p);float angle=atan(p.y,p.x);float churn=sin(p.x*43.+time*4.)*sin(p.y*37.-time*3.);float front=r+.025*sin(angle*13.+time);float ring=pow(max(0.,sin(front*30.-time*4.)),7.);float foam=exp(-r*r*15.)*(.76+.22*churn);float wake=ring*.20*smoothstep(-.4,.6,sin(angle*9.+r*17.-time*.3))*exp(-r*1.5);gl_FragColor=vec4(.93,.99,.97,(foam+wake)*(1.-smoothstep(.55,1.,r)));}` }));
    pool.rotation.x=-Math.PI/2;pool.position.copy(center);pool.position.y+=.035;pool.name='cascade-impact-'+index;group.add(pool);
    const drops:number[]=[],phases:number[]=[];
    for(let i=0;i<240;i++){drops.push((random(i+510)-.5)*size*1.7,.18+random(i+611)*size*.6,(random(i+712)-.5)*size*1.4);phases.push(random(i+813));}
    const sprayGeometry=new THREE.BufferGeometry();sprayGeometry.setAttribute('position',new THREE.Float32BufferAttribute(drops,3));sprayGeometry.setAttribute('phase',new THREE.Float32BufferAttribute(phases,1));
    const spray=new THREE.Points(sprayGeometry,new THREE.ShaderMaterial({uniforms:{time},transparent:true,depthWrite:false,
      vertexShader:`uniform float time;attribute float phase;varying float life;varying float mist;void main(){float t=fract(time*.85+phase);life=sin(t*3.14159);mist=step(.66,phase);vec3 p=vec3(position.x*t,position.y*4.*t*(1.-t),position.z*t);vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=mix(clamp(62./-mv.z,1.5,4.),clamp(340./-mv.z,7.,27.),mist);}`,
      fragmentShader:`varying float life;varying float mist;void main(){float r=length(gl_PointCoord-.5);float alpha=mix(1.-smoothstep(.2,.5,r),exp(-r*r*20.)*(1.-smoothstep(.3,.5,r)),mist);gl_FragColor=vec4(.94,.99,.98,alpha*life*mix(.68,.075,mist));}` }));
    spray.position.copy(center);spray.position.y+=.06;spray.name='cascade-spray-'+index;group.add(spray);
  }
  const ledgeMaterial=new THREE.MeshStandardMaterial({color:'#777767',roughness:.62});
  for(const [index,scale] of [[2,.45],[4,.32]]) {
    const point=points[index];
    const ledge=new THREE.Mesh(new THREE.IcosahedronGeometry(1,1),ledgeMaterial);
    const bed=Math.max(-.4,heightAt(point.x,point.z)-.15),height=Math.max(.25,point.y-bed);
    ledge.position.set(point.x-.08,bed+height*.46,point.z-.24);
    ledge.scale.set(scale*1.25,height*.50,scale*.6);ledge.rotation.y=index*.7;
    ledge.castShadow=ledge.receiveShadow=true;group.add(ledge);
  }
  return group;
}
