import * as THREE from 'three';
import { heightAt, random, rockMaterial } from './landscape';

export function coastalDetails(time:{value:number}, anchors:THREE.Vector3[], onLoad:()=>void, capture:{value:number}):THREE.Group {
  const group=new THREE.Group();group.name='coastal-reefs-and-pools';
  const rock=rockMaterial(onLoad,time,-100,capture);
  rock.opacity=1;rock.userData.loadTexture();
  const geometry=new THREE.IcosahedronGeometry(1,2),p=geometry.getAttribute('position');
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i);const fracture=.85+Math.sin(x*9+z*5)*.1+Math.cos(y*7-z*3)*.07;p.setXYZ(i,x*fracture+y*.17,y,z*fracture);}
  geometry.computeVertexNormals();
  // These outcrops extend down into the sea, rather than floating on the surface.
  for(const [index,[x,z,h]] of [[-9.8,-3.3,.7],[9.7,-4.5,1.0],[-10,2.6,.55],[9.9,3.0,.65],[-1.1,-6.9,.45]].entries()) {
    const reef=new THREE.Mesh(geometry,rock);reef.position.set(x,-1.2,z);reef.scale.set(.55+h*.25,1.2+h,.48+h*.2);reef.rotation.y=index*1.7;reef.castShadow=reef.receiveShadow=true;group.add(reef);
  }
  const poolMaterial=new THREE.ShaderMaterial({uniforms:{time},transparent:true,side:THREE.DoubleSide,depthWrite:false,
    vertexShader:`varying vec2 pUv;void main(){pUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`uniform float time;varying vec2 pUv;void main(){float r=length(pUv-.5)*2.;float ripple=sin(r*44.-time*1.4)*.5+.5;gl_FragColor=vec4(mix(vec3(.12,.34,.27),vec3(.36,.64,.53),ripple*.25),.8*(1.-smoothstep(.65,1.,r)));}`});
  let pools=0;
  for(let i=0;i<900 && pools<5;i++) {
    const x=(random(i+8201)-.5)*17,z=(random(i+9201)-.5)*13,y=heightAt(x,z);
    const slope=Math.hypot(heightAt(x+.12,z)-y,heightAt(x,z+.12)-y)/.12;
    if(y<-.02||y>.20||slope>.55||anchors.some(a=>Math.hypot(a.x-x,a.z-z)<.8))continue;
    const pool=new THREE.Mesh(new THREE.PlaneGeometry(.55,.42),poolMaterial);pool.rotation.x=-Math.PI/2;pool.position.set(x,y+.03,z);group.add(pool);
    for(let j=0;j<7;j++){const angle=j*Math.PI*2/7;const rim=new THREE.Mesh(geometry,rock);rim.scale.set(.09,.045,.07);rim.position.set(x+Math.cos(angle)*.26,y+.035,z+Math.sin(angle)*.19);rim.rotation.y=j;rim.receiveShadow=true;group.add(rim);}
    pools++;
  }
  // Bake mesh transforms so the shared triplanar rock shader samples scene
  // coordinates, with the same mineral palette as the mountain itself.
  group.traverse(object=>{
    if(!(object instanceof THREE.Mesh) || object.material!==rock)return;
    object.updateMatrix();object.geometry=object.geometry.clone().applyMatrix4(object.matrix);
    const colors:number[]=[];const count=object.geometry.getAttribute('position').count;
    const tint=new THREE.Color('#898677');for(let i=0;i<count;i++)colors.push(tint.r,tint.g,tint.b);
    object.geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    object.position.set(0,0,0);object.rotation.set(0,0,0);object.scale.set(1,1,1);
  });
  group.userData.poolCount=pools;
  return group;
}
