import * as THREE from 'three';
import { heightAt, random } from './landscape';
import { FishMotion } from './fish-motion';
import { fishGeometry, starfishGeometry, shellGeometry as createShell, seagrassGeometry } from './marine-geometry';

/** Small coastal life shares the water clock and its refraction capture. */
export class MarineLife {
  readonly group=new THREE.Group();
  private fish:THREE.Group[]=[];
  private motion=new FishMotion();
  private previousTime=0;
  constructor(private time:{value:number},capture:{value:number},ground:THREE.Object3D[]) {
    const material=(color:string,vegetation=false)=>{
      const mat=new THREE.MeshStandardMaterial({color,roughness:vegetation?.7:.48,vertexColors:true,transparent:true,side:vegetation?THREE.DoubleSide:THREE.FrontSide});
      mat.onBeforeCompile=shader=>{
        shader.uniforms.lifeTime=time;shader.uniforms.waterCapture=capture;
        shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
          uniform float lifeTime;uniform vec3 waterUp;varying vec2 lifeXZ;varying float lifeDepth;varying vec3 lifeUp;`)
          .replace('#include <begin_vertex>',`#include <begin_vertex>
            ${vegetation?`float phase=modelMatrix[3].x*.7+modelMatrix[3].z*.5;
              #ifdef USE_INSTANCING
              phase+=instanceMatrix[3].x*.7+instanceMatrix[3].z*.5;
              #endif
              transformed.x+=sin(lifeTime*.7+phase+position.y*2.)*position.y*position.y*.14;
              transformed.z+=cos(lifeTime*.55+phase+position.x*3.)*position.y*position.y*.07;`:''}
          `).replace('#include <worldpos_vertex>',`#include <worldpos_vertex>
            vec4 lifePosition=vec4(transformed,1.);
            #ifdef USE_INSTANCING
              lifePosition=instanceMatrix*lifePosition;
            #endif
            lifeDepth=max(0.,-.16-lifePosition.y);
            lifeUp=normalize(mat3(viewMatrix)*waterUp);
          `);
        shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
          uniform float waterCapture;varying vec2 lifeXZ;varying float lifeDepth;varying vec3 lifeUp;`)
          .replace('#include <opaque_fragment>',`if(waterCapture<.5){
            vec3 transmission=exp(-vec3(.14,.065,.045)*lifeDepth/max(.28,abs(dot(normalize(vViewPosition),lifeUp))));
            outgoingLight=outgoingLight*transmission+vec3(.009,.07,.085)*(1.-transmission);
          }
          diffuseColor.a*=1.-smoothstep(.70,.96,pow(pow(abs(lifeXZ.x)/12.6,2.8)+pow(abs(lifeXZ.y)/10.4,2.8),1./2.8));
          #include <opaque_fragment>`);
      };
      mat.customProgramCacheKey=()=>`marine-${vegetation}`;
      return mat;
    };
    const grassMat=material('#ffffff',true),algaeMat=material('#ffffff',true);
    const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
    ground.forEach(mesh=>mesh.updateMatrixWorld(true));
    const patches:THREE.Vector3[]=[];
    for(let i=0;i<500 && patches.length<68;i++) {
      const beds=[[-5.7,7.6],[-2.1,7.9],[1.2,7.6],[5.5,7.7],[0,1.8],[0,-1.9]];
      const bed=beds[i%beds.length],angle=random(i+771)*Math.PI*2,r=Math.sqrt(random(i+901));
      const x=bed[0]+Math.cos(angle)*r*1.3,z=bed[1]+Math.sin(angle)*r*.7;
      if([[0,0],[.4,0],[-.4,0],[0,.4],[0,-.4]].some(([dx,dz])=>heightAt(x+dx,z+dz)>-.5)) continue;
      if(Math.pow(Math.abs(x)/12.6,2.8)+Math.pow(Math.abs(z)/10.4,2.8)>.65) continue;
      ray.set(new THREE.Vector3(x,-.4,z),down);
      const hit=ray.intersectObjects(ground,false)[0];
      if(!hit || hit.point.y>-.9 || hit.point.y< -5.8 || (hit.face && hit.face.normal.y<.45)) continue;
      if(patches.some(p=>p.distanceTo(hit.point)<.23)) continue;
      patches.push(hit.point.clone());
    }
    // Overlapping, irregular colonies share six draws instead of one draw per tuft.
    const transform=new THREE.Object3D();
    for(let variant=0;variant<6;variant++) {
      const entries=patches.filter((_,i)=>i%6===variant);
      const mesh=new THREE.InstancedMesh(seagrassGeometry(variant,variant===0),variant===0?algaeMat:grassMat,entries.length);
      entries.forEach((position,i)=>{
        transform.position.copy(position);transform.rotation.y=(random(i+variant*31)-.5)*.8;
        const scale=.48+random(i+variant*31+19)*.8;
        transform.scale.set(scale,scale*(.8+random(i+5)*.4),scale);transform.updateMatrix();mesh.setMatrixAt(i,transform.matrix);
        mesh.setColorAt(i,new THREE.Color('#ffffff').multiplyScalar(.72+random(i+71)*.28));
      });mesh.receiveShadow=true;this.group.add(mesh);
    }
    const starMat=material('#ffffff'),shellMat=material('#ffffff');
    const starGeometry=starfishGeometry(),shellGeometry=createShell();
    // Find exposed rock shelves independently of the grass, then conform to their normals.
    let stars=0;
    for(let i=0;i<100 && stars<6;i++) {
      const x=(random(i+1601)-.5)*15,z=5.9+random(i+1701)*2;
      ray.set(new THREE.Vector3(x,-.5,z),down);
      const hit=ray.intersectObjects(ground.slice(0,-1),false)[0];
      if(!hit || hit.point.y< -5 || !hit.face || hit.face.normal.y<.35)continue;
      const star=new THREE.Mesh(starGeometry,starMat);
      const normal=hit.face.normal.clone();
      if(hit.object instanceof THREE.InstancedMesh && hit.instanceId!==undefined){const matrix=new THREE.Matrix4();hit.object.getMatrixAt(hit.instanceId,matrix);normal.applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(matrix));}
      star.position.copy(hit.point).addScaledVector(normal,.012);
      star.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),normal);star.rotateY(random(i+66)*6);
      const scale=.7+random(i+101)*.45;star.scale.setScalar(scale);this.group.add(star);stars++;
      if(normal.y>.5 && stars%2===0) {
        const tuft=new THREE.Mesh(seagrassGeometry(i+40,true),algaeMat);
        tuft.position.copy(hit.point).addScaledVector(normal,.015);tuft.scale.setScalar(.65);tuft.receiveShadow=true;this.group.add(tuft);
      }
    }
    patches.slice(0,10).forEach((p,i)=>{
      for(let j=0;j<3;j++){const shell=new THREE.Mesh(shellGeometry,shellMat);shell.position.copy(p).add(new THREE.Vector3((j-1)*.14,.015,-.2));shell.rotation.y=random(i*3+j)*6;shell.scale.setScalar(.7+random(i*4+j)*.5);this.group.add(shell);}
    });
    // Static seabed details share draw calls.
    for(const [geometry,mat] of [[starGeometry,starMat],[shellGeometry,shellMat]] as const) {
      const originals=this.group.children.filter(child=>child instanceof THREE.Mesh && child.geometry===geometry) as THREE.Mesh[];
      const instances=new THREE.InstancedMesh(geometry,mat,originals.length);
      originals.forEach((mesh,i)=>{mesh.updateMatrix();instances.setMatrixAt(i,mesh.matrix);this.group.remove(mesh);});
      instances.receiveShadow=true;this.group.add(instances);
    }
    const fishMat=material('#ffffff'),goldMat=material('#ffffff');
    const geometries=[fishGeometry(),fishGeometry(true)];
    for(let school=0;school<2;school++) {
      const group=new THREE.Group();
      for(let i=0;i<12;i++) {
        const fish=new THREE.Group(),mat=school?goldMat:fishMat;
        const body=new THREE.Mesh(geometries[school].body,mat);
        const tail=new THREE.Mesh(geometries[school].tail,mat);tail.position.x=-.175;fish.add(body,tail);
        fish.scale.setScalar(.72+random(i+school*20+73)*.38);
        fish.position.set((random(i+school*40)-.5)*1.9,(random(i+94)-.5)*.45,(random(i+19)-.5)*.7);
        fish.rotation.y=(random(i+401)-.5)*.15;group.add(fish);this.fish.push(fish);
      }
      this.group.add(group);
    }
    // Convert local depth to the water group's space for attached plants and moving fish.
    this.group.traverse(object=>{
      if(!(object instanceof THREE.Mesh))return;
      const mat=object.material as THREE.MeshStandardMaterial;
      if(mat.userData.depthPatched)return;
      mat.userData.depthPatched=true;
      const compile=mat.onBeforeCompile;
      mat.onBeforeCompile=(shader,renderer)=>{
        compile(shader,renderer);
        shader.uniforms.waterWorldInverse={value:this.group.parent!.matrixWorld.clone().invert()};
        shader.uniforms.waterUp={value:new THREE.Vector3(0,1,0).transformDirection(this.group.parent!.matrixWorld)};
        shader.vertexShader=shader.vertexShader.replace('uniform float lifeTime;','uniform mat4 waterWorldInverse;uniform float lifeTime;').replace('lifeDepth=max(0.,-.16-lifePosition.y);','vec3 waterLocal=(waterWorldInverse*modelMatrix*lifePosition).xyz;lifeXZ=waterLocal.xz;lifeDepth=max(0.,-.16-waterLocal.y);');
        mat.userData.shader=shader;
      };
    });
    this.advance();
  }
  advance() {
    const t=this.time.value,delta=Math.max(0,t-this.previousTime);this.previousTime=t;
    this.motion.step(t,delta);
    const forward=new THREE.Vector3(1,0,0),rotation=new THREE.Quaternion();
    this.fish.forEach((fish,i)=>{
      fish.position.copy(this.motion.positions[i]);
      rotation.setFromUnitVectors(forward,this.motion.velocities[i].clone().normalize());
      fish.quaternion.slerp(rotation,delta?1-Math.exp(-delta*5):1);
      fish.children[0].rotation.y=Math.sin(this.motion.beats[i]-.5)*.035;
      fish.children[1].rotation.y=Math.sin(this.motion.beats[i])*(.16+this.motion.velocities[i].length()*.45);
    });
  }

  updateWaterTransform() {
    const inverse=this.group.parent!.matrixWorld.clone().invert();
    this.group.traverse(object=>{if(object instanceof THREE.Mesh){const shader=(object.material as THREE.Material).userData.shader;if(shader){shader.uniforms.waterWorldInverse.value.copy(inverse);shader.uniforms.waterUp.value.set(0,1,0).transformDirection(this.group.parent!.matrixWorld);}}});
  }
}
