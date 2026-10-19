import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { coast, heightAt, random, rockMaterial } from './landscape';
import { MarineLife } from './marine';
import { seabedHeight } from './seabed';

export const WATER_LEVEL=-.16;
export const MAX_WAVE_HEIGHT=.13;
export function waterFloorAt(x:number,z:number):number {
  const radius=Math.hypot(x/10.2,z/8);
  const edge=coast(Math.atan2(z/8,x/10.2));
  return radius<=edge ? heightAt(x,z) : -4.8-(radius-edge)*1.8;
}

// Continuous 3D erosion noise: adjacent faces share features without horizontal bands.
function erosion(x:number,y:number,z:number):number {
  const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z);
  const smooth=(v:number)=>v*v*(3-2*v),u=smooth(x-ix),v=smooth(y-iy),w=smooth(z-iz);
  const sample=(a:number,b:number,c:number)=>random(a*31+b*157+c*733)*2-1;
  const mix=THREE.MathUtils.lerp;
  return mix(mix(mix(sample(ix,iy,iz),sample(ix+1,iy,iz),u),mix(sample(ix,iy+1,iz),sample(ix+1,iy+1,iz),u),v),
    mix(mix(sample(ix,iy,iz+1),sample(ix+1,iy,iz+1),u),mix(sample(ix,iy+1,iz+1),sample(ix+1,iy+1,iz+1),u),v),w);
}

/** Displaced water with screen-space refraction and a clipped planar reflection. */
export class TerrainWater {
  readonly group=new THREE.Group();
  readonly surface:THREE.Mesh<THREE.PlaneGeometry,THREE.ShaderMaterial>;
  private readonly target=new THREE.WebGLRenderTarget(1,1,{depthBuffer:true,type:THREE.HalfFloatType});
  private readonly size=new THREE.Vector2();
  private readonly reflection=new THREE.WebGLRenderTarget(1,1,{depthBuffer:true,type:THREE.HalfFloatType});
  private readonly mirrorCamera=new THREE.PerspectiveCamera();
  private readonly mirrorMatrix=new THREE.Matrix4();
  readonly timeUniform={value:0};
  readonly captureUniform={value:0};
  private readonly cliffAnchors:THREE.Vector3[]=[];
  private readonly life:MarineLife;

  constructor(private readonly onLoad:()=>void=()=>{}) {
    this.target.depthTexture=new THREE.DepthTexture(1,1,THREE.UnsignedIntType);
    const geometry=new THREE.PlaneGeometry(26,22,256,224);
    geometry.rotateX(-Math.PI/2);
    const positions=geometry.getAttribute('position'),floors=[];
    for(let i=0;i<positions.count;i++) floors.push(waterFloorAt(positions.getX(i),positions.getZ(i)));
    geometry.setAttribute('floorHeight',new THREE.Float32BufferAttribute(floors,1));
    const material=new THREE.ShaderMaterial({
      transparent:true,depthWrite:false,side:THREE.DoubleSide,
      uniforms:{uTime:this.timeUniform,uDepth:{value:this.target.depthTexture},uNearFar:{value:new THREE.Vector2(.1,1000)},uMirror:{value:this.reflection.texture},uMirrorMatrix:{value:this.mirrorMatrix},uScene:{value:this.target.texture},uResolution:{value:new THREE.Vector2(1,1)},
        uShallow:{value:new THREE.Color('#3a8c89')},uDeep:{value:new THREE.Color('#064b60')}},
      vertexShader:`
        attribute float floorHeight;
        uniform float uTime;
        uniform mat4 uMirrorMatrix;
        varying vec4 vMirror;
        varying vec3 vTangentX,vTangentZ;
        varying vec3 vWorld;
        varying vec3 vWaterNormal;
        varying vec2 vLocal;
        varying float vDepth;
        void main(){
          vec3 p=position;vLocal=p.xz;
          float wave=0.;vec2 grad=vec2(0.);
          for(int i=0;i<6;i++) {
            float k=float(i);
            float angle=.48+k*2.39996;
            vec2 dir=vec2(cos(angle),sin(angle));
            float frequency=1.25*pow(1.62,k);
            float amplitude=.046*pow(.64,k);
            float phase=dot(p.xz,dir)*frequency+uTime*sqrt(frequency)*.85;
            wave+=sin(phase)*amplitude;
            grad+=cos(phase)*amplitude*frequency*dir;
          }
          float shoreDamping=smoothstep(0.,.38,${WATER_LEVEL.toFixed(3)}-floorHeight);
          p.y=${WATER_LEVEL.toFixed(3)}+wave*shoreDamping;
          grad*=shoreDamping;
          vDepth=p.y-floorHeight;
          vWaterNormal=normalize(mat3(modelMatrix)*vec3(-grad.x,1.,-grad.y));
          vec4 world=modelMatrix*vec4(p,1.);vWorld=world.xyz;
          vMirror=uMirrorMatrix*world;
          vTangentX=normalize(mat3(modelMatrix)*vec3(1.,0.,0.));
          vTangentZ=normalize(mat3(modelMatrix)*vec3(0.,0.,1.));
          gl_Position=projectionMatrix*viewMatrix*world;
        }`,
      fragmentShader:`
        uniform float uTime;
        uniform sampler2D uScene,uMirror,uDepth;
        uniform vec2 uNearFar;
        varying vec4 vMirror;
        varying vec3 vTangentX,vTangentZ;
        uniform vec2 uResolution;
        uniform vec3 uShallow,uDeep;
        varying vec3 vWorld;
        varying vec3 vWaterNormal;
        varying vec2 vLocal;
        varying float vDepth;
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float noise(vec2 p){
          vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
          return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);
        }
        float ripples(vec2 p){
          vec2 q=mat2(.94,.34,-.34,.94)*p;
          float drift=noise(q*.65+vec2(uTime*.04,-uTime*.03));
          return noise(vec2(q.x*3.5,q.y*10.5)+vec2(uTime*.20,-uTime*.31)+drift*.6)*.65
            +noise(q*17.3+vec2(-uTime*.17,uTime*.12))*.20
            +noise(p*2.+uTime*.06)*.15;
        }
        float viewZ(float depth){return uNearFar.x*uNearFar.y/((uNearFar.y-uNearFar.x)*depth-uNearFar.y);}
        void main(){
          float radius=pow(pow(abs(vLocal.x)/12.6,2.8)+pow(abs(vLocal.y)/10.4,2.8),1./2.8);
          float edge=1.-smoothstep(.79,1.,radius+(noise(vLocal*1.5)-.5)*.025);
          if(edge<.005 || vDepth<-.025) discard;
          vec2 detail=vec2(ripples(vLocal+vec2(.025,0.))-ripples(vLocal-vec2(.025,0.)),
            ripples(vLocal+vec2(0.,.025))-ripples(vLocal-vec2(0.,.025)))*5.;
          vec3 n=normalize(vWaterNormal+vTangentX*detail.x*.12+vTangentZ*detail.y*.09);
          vec3 viewDir=normalize(cameraPosition-vWorld);
          float fresnel=.025+.975*pow(1.-abs(dot(viewDir,n)),5.);
          vec2 uv=gl_FragCoord.xy/uResolution;
          float waterZ=(viewMatrix*vec4(vWorld,1.)).z;
          float sceneZ=viewZ(texture2D(uDepth,uv).r);
          float thickness=max(0.,waterZ-sceneZ);
          vec3 waterUp=normalize(cross(vTangentZ,vTangentX));
          vec2 bend=(mat3(viewMatrix)*(n-waterUp)).xy;
          vec2 offset=bend*.023*smoothstep(0.,.45,thickness);
          vec2 refractUV=clamp(uv+offset,vec2(.002),vec2(.998));
          // A foreground rock must never be pulled across the water boundary.
          if(viewZ(texture2D(uDepth,refractUV).r)>waterZ) refractUV=uv;
          vec4 refracted=texture2D(uScene,refractUV);
          thickness=clamp(waterZ-viewZ(texture2D(uDepth,refractUV).r),0.,12.);
          // Depth-dependent scattering softens distant rock detail without blurring the shore.
          vec2 blur=vec2(1.6)/uResolution*smoothstep(.4,6.,thickness);
          vec4 scattered=refracted*2.;float samples=2.;
          for(int i=0;i<4;i++) {
            float a=float(i)*1.570796;
            vec2 tap=clamp(refractUV+vec2(cos(a),sin(a))*blur,vec2(.002),vec2(.998));
            if(viewZ(texture2D(uDepth,tap).r)<waterZ) {scattered+=texture2D(uScene,tap);samples+=1.;}
          }
          refracted=scattered/samples;
          vec3 under=refracted.rgb+uDeep*(1.-refracted.a);
          vec3 transmission=exp(-vec3(.48,.15,.11)*thickness);
          vec3 tint=mix(uShallow,uDeep,1.-exp(-thickness*.15));
          vec3 color=under*transmission+tint*(1.-transmission);
          vec2 mirrorUV=vMirror.xy/vMirror.w+bend*.018;
          vec4 reflected=texture2D(uMirror,clamp(mirrorUV,vec2(.002),vec2(.998)));
          vec3 reflectionColor=reflected.rgb+mix(vec3(.20,.36,.43),vec3(.48,.65,.70),smoothstep(-.22,.40,n.x+n.z))*(1.-reflected.a);
          color=mix(color,reflectionColor,fresnel);
          vec3 halfVector=normalize(viewDir+normalize(vec3(-.4,.8,.3)));
          float glint=pow(max(dot(n,halfVector),0.),110.);
          color+=vec3(1.,.94,.78)*glint*.18;
          // Small foam fragments are tied to the actual depth texture, including reefs.
          float wash=noise(vLocal*12.+vec2(uTime*.22,-uTime*.13));
          float shore=(1.-smoothstep(.02,.22,thickness))*smoothstep(.52,.78,wash);
          float crest=smoothstep(.69,.87,ripples(vLocal))*smoothstep(.4,1.,thickness);
          color=mix(color,vec3(.85,.94,.90),shore*.58+crest*.025);
          gl_FragColor=vec4(color,edge*.94);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.surface=new THREE.Mesh(geometry,material);this.surface.renderOrder=10;
    this.surface.frustumCulled=false;
    this.group.add(this.surface);
    this.addSubmergedRocks();
    this.life=new MarineLife(this.timeUniform,this.captureUniform,this.group.children.filter(child=>child!==this.surface));
    this.group.add(this.life.group);
  }

  private addFoundations(material:THREE.MeshStandardMaterial) {
    const centers=[[-5.,-3.5],[4.7,-2.8],[-4.5,3.6],[4.7,4.]];
    const segments=256,layers=56,top=-.24;
    for(let island=0;island<centers.length;island++) {
      const [cx,cz]=centers[island],shore:number[]=[];
      // Trace each island's actual shoreline, independent of the outer terrain tile.
      for(let j=0;j<segments;j++) {
        const angle=j/segments*Math.PI*2,dx=Math.cos(angle),dz=Math.sin(angle);
        let low=.15,high=6.;
        for(let r=.2;r<=6.;r+=.08) {
          if(heightAt(cx+dx*r,cz+dz*r)<top) {high=r;low=Math.max(.15,r-.08);break;}
        }
        for(let n=0;n<9;n++) {const r=(low+high)*.5;if(heightAt(cx+dx*r,cz+dz*r)>top)low=r;else high=r;}
        shore.push((low+high)*.5);
      }
      const positions:number[]=[],colors:number[]=[],indices:number[]=[],color=new THREE.Color();
      for(let layer=0;layer<=layers;layer++) for(let j=0;j<segments;j++) {
        const angle=j/segments*Math.PI*2,t=layer/layers;
        const bottom=5.05+.22*erosion(Math.cos(angle)*3,island,Math.sin(angle)*3);
        const depth=t*bottom;
        const warp=Math.sin(t*Math.PI);
        const theta=angle+.035*erosion(Math.cos(angle)*3,depth,Math.sin(angle)*3)*warp;
        const px=cx+Math.cos(theta)*shore[j],pz=cz+Math.sin(theta)*shore[j];
        const macro=erosion(px*.85,depth*.7,pz*.85);
        const fracture=erosion(px*2.7,depth*2.2,pz*2.7);
        const crevice=Math.pow(Math.max(0.,erosion(px*1.8+12,depth*.9,pz*1.8)),3)*.75;
        // Long, offset joints belong to the continuous rock mass, not stacked rings.
        const jointA=Math.abs(erosion(px*1.15+depth*.11,depth*.24,pz*1.15));
        const jointB=Math.abs(erosion(px*.72,depth*1.1+px*.18,pz*.72+7));
        const joints=(1-THREE.MathUtils.smoothstep(jointA,.015,.12))*.24
          +(1-THREE.MathUtils.smoothstep(jointB,.01,.08))*.12;
        const buttress=Math.sin(t*Math.PI)*(.55+.5*erosion(px*.5,0,pz*.5))
          +THREE.MathUtils.smoothstep(t,.32+.12*macro,.74+.1*macro)*(.25+.3*erosion(px*.9,0,pz*.9));
        let ravine=0;
        for(let cut=0;cut<6;cut++) {
          const direction=(cut+random(island*19+cut+150)) /6*Math.PI*2;
          const distance=Math.atan2(Math.sin(theta-direction),Math.cos(theta-direction));
          const width=.065+random(cut+island*23+300)*.08;
          ravine+=Math.exp(-distance*distance/(width*width))*(.55+random(cut+201)*.75);
        }
        const radius=shore[j]+t*.12+buttress+Math.min(1,t*7)*(macro*.7+fracture*.12-crevice-joints)
          -ravine*THREE.MathUtils.smoothstep(t,.08,.48);
        const y=top-depth+.18*erosion(px*1.3,depth*.5,pz*1.3)*warp;
        const x=cx+Math.cos(theta)*radius,z=cz+Math.sin(theta)*radius;
        positions.push(x,y,z);
        if(layer>2 && layer<layers-2 && j%6===0) this.cliffAnchors.push(new THREE.Vector3(x,y,z));
        color.set('#aaa18b').multiplyScalar(.90+macro*.12+fracture*.05-joints*.55);colors.push(color.r,color.g,color.b);
        if(layer<layers) {const a=layer*segments+j,b=layer*segments+(j+1)%segments;indices.push(a,b,a+segments,b,b+segments,a+segments);}
      }
      const geometry=new THREE.BufferGeometry();
      geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
      geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();
      const cliffMaterial=material.clone();cliffMaterial.flatShading=false;
      // Shader callbacks are not cloned by Three.js.
      cliffMaterial.onBeforeCompile=material.onBeforeCompile;
      const mesh=new THREE.Mesh(geometry,cliffMaterial);mesh.castShadow=mesh.receiveShadow=true;this.group.add(mesh);
    }
  }

  private addReefSpurs(material:THREE.MeshStandardMaterial) {
    // Offset fractured buttresses break up the cliff wall without forming a regular ring.
    const sites=[[-6.8,6.8,.65,1.8],[-5.1,7.1,.58,2.1],[-3.7,7.5,.48,1.5],
      [-1.6,6.9,.72,1.3],[.4,7.4,.5,1.6],[2.7,7.0,.7,2.2],[4.6,7.3,.55,1.6],
      [6.5,6.6,.7,1.9],[-8.1,1.8,.6,1.4],[8.0,2.9,.55,1.5],[0,1.1,.48,1.0]];
    sites.forEach(([cx,cz,width,rise],seed)=>{
      const bottom=seabedHeight(cx,cz)-.18,top=Math.min(-2.85,bottom+rise);
      const vertices:number[]=[],colors:number[]=[],indices:number[]=[],color=new THREE.Color();
      const sides=16,layers=12;
      for(let layer=0;layer<=layers;layer++)for(let j=0;j<sides;j++) {
        const t=layer/layers,a=j/sides*Math.PI*2;
        const ledge=THREE.MathUtils.smoothstep(t,.35+random(seed+91)*.12,.52+random(seed+91)*.12);
        const profile=(1.12-.25*t-.18*ledge)*(1+.16*Math.sin(a*3+seed)+.09*Math.sin(a*7+seed*2));
        const fracture=erosion(Math.cos(a)*3, t*4+seed,Math.sin(a)*3)*.07;
        const bx=Math.sign(Math.cos(a))*Math.pow(Math.abs(Math.cos(a)),.6)*width*(profile+fracture)*1.2;
        const bz=Math.sign(Math.sin(a))*Math.pow(Math.abs(Math.sin(a)),.65)*width*(profile+fracture)*(.7+random(seed+18)*.3);
        const turn=seed*1.73;
        vertices.push(cx+bx*Math.cos(turn)-bz*Math.sin(turn)+t*t*.18*Math.sin(seed),
          bottom+(top-bottom)*t+Math.sin(t*Math.PI)*fracture+t*(.10*Math.sin(a*3+seed)+.08*Math.cos(a+seed)),
          cz+bx*Math.sin(turn)+bz*Math.cos(turn));
        color.set('#aaa28d').multiplyScalar(.87+fracture+random(j+seed*19)*.12);colors.push(color.r,color.g,color.b);
        if(layer<layers){const k=layer*sides+j,n=layer*sides+(j+1)%sides;indices.push(k,k+sides,n,n,k+sides,n+sides);}
      }
      const center=vertices.length/3;vertices.push(cx+.12*Math.sin(seed),top+.025,cz);color.set('#b5ac93');colors.push(color.r,color.g,color.b);
      for(let j=0;j<sides;j++)indices.push(center,layers*sides+(j+1)%sides,layers*sides+j);
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
      geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();
      const rockMaterial=material.clone();rockMaterial.flatShading=false;rockMaterial.onBeforeCompile=material.onBeforeCompile;
      const mesh=new THREE.Mesh(geometry,rockMaterial);mesh.castShadow=mesh.receiveShadow=true;this.group.add(mesh);
    });
  }

  private addSubmergedRocks() {
    const material=rockMaterial(this.onLoad,this.timeUniform,-100,this.captureUniform);
    material.opacity=1;material.transparent=false;material.flatShading=true;material.userData.loadTexture();
    this.addFoundations(material);
    this.addReefSpurs(material);
    const variants:THREE.InstancedMesh[]=[];
    for(let variant=0;variant<6;variant++) {
      const points:THREE.Vector3[]=[];
      for(let j=0;j<42;j++) {
        const y=1-2*(j+.5)/42,angle=j*2.399963,r=Math.sqrt(1-y*y);
        const scale=.72+random(variant*101+j+430)*.36;
        points.push(new THREE.Vector3(Math.cos(angle)*r*scale,Math.max(-.8,y*scale),Math.sin(angle)*r*scale));
      }
      const geometry=new ConvexGeometry(points);geometry.computeBoundingBox();
      const bounds=geometry.boundingBox!,height=bounds.max.y-bounds.min.y;
      const pos=geometry.getAttribute('position');
      for(let j=0;j<pos.count;j++) pos.setY(j,(pos.getY(j)-(bounds.max.y+bounds.min.y)*.5)*2/height);
      geometry.computeVertexNormals();geometry.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(pos.count*3).fill(1),3));
      const mesh=new THREE.InstancedMesh(geometry,material,100);mesh.count=0;mesh.castShadow=mesh.receiveShadow=true;
      variants.push(mesh);this.group.add(mesh);
    }
    const object=new THREE.Object3D(),color=new THREE.Color();
    const islands=[[-5.,-3.5,3.3,2.1],[4.7,-2.8,3.1,2.2],[-4.5,3.6,3.1,2.1],[4.7,4.,3.2,2.1]];
    for(let i=0;i<416;i++) {
      const seed=i+900,foundation=i<96,mesh=variants[i%6];
      let h:number,width:number;
      if(foundation) {
        const anchor=this.cliffAnchors[Math.floor(random(seed)*this.cliffAnchors.length)];
        object.position.copy(anchor);
        h=Math.min(.65+random(seed+8)*.85,Math.max(.12,(-.2-anchor.y)*.55));
        width=.28+random(seed+2)*.35;
        const center=islands.reduce((a,b)=>Math.hypot(anchor.x-a[0],anchor.z-a[1])<Math.hypot(anchor.x-b[0],anchor.z-b[1])?a:b);
        const outward=new THREE.Vector3(anchor.x-center[0],0,anchor.z-center[1]).normalize();
        object.position.addScaledVector(outward,-.12);
        object.rotation.set((random(seed+4)-.5)*.2,Math.atan2(outward.x,outward.z),(random(seed+6)-.5)*.3);
      } else {
        const island=islands[i%4],angle=random(seed)*Math.PI*2,ring=.9+random(seed+1)*.75;
        const x=island[0]+Math.cos(angle)*island[2]*ring,z=island[1]+Math.sin(angle)*island[3]*ring;
        const floor=waterFloorAt(x,z);if(floor>-.3) continue;
        const emerged=i%9===0 && floor>-1.4;
        h=emerged?(WATER_LEVEL-floor)*.65+.15:.12+random(seed+8)*.38;
        width=emerged?.35+random(seed+2)*.45:.15+random(seed+2)*.45;
        const bedHeight=seabedHeight(x,z);
        // Loose submerged rubble rests on the seabed, never on the removed heightfield.
        object.position.set(x,(emerged?floor:bedHeight)+h*.75,z);
        object.rotation.set((random(seed+4)-.5)*.35,random(seed+5)*6,(random(seed+6)-.5)*.4);
      }
      object.scale.set(width,h,foundation?.18+random(seed+3)*.12:width*(.65+random(seed+3)*.55));object.updateMatrix();
      mesh.setMatrixAt(mesh.count,object.matrix);
      color.set('#a29a83').multiplyScalar(.75+random(seed+12)*.36);mesh.setColorAt(mesh.count++,color);
    }
    // A submerged shelf outside the original island makes the water transparent
    // over actual geometry instead of revealing an empty ivory background.
    const bed=new THREE.PlaneGeometry(26,22,256,224);bed.rotateX(-Math.PI/2);
    const p=bed.getAttribute('position'),colors=[];
    for(let i=0;i<p.count;i++) {
      const x=p.getX(i),z=p.getZ(i);
      p.setY(i,seabedHeight(x,z));
      color.set('#b4af96').multiplyScalar(.93+random(i+919)*.08);colors.push(color.r,color.g,color.b);
    }
    bed.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));bed.computeVertexNormals();
    const bedMaterial=rockMaterial(this.onLoad,this.timeUniform,-100,this.captureUniform);
    bedMaterial.opacity=1;bedMaterial.transparent=true;bedMaterial.userData.loadTexture();
    const prepareBed=bedMaterial.onBeforeCompile;
    bedMaterial.onBeforeCompile=(shader,renderer)=>{
      prepareBed(shader,renderer);
      shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>', `
        diffuseColor.a*=1.-smoothstep(.70,.96,pow(pow(abs(vRockPosition.x)/12.6,2.8)+pow(abs(vRockPosition.z)/10.4,2.8),1./2.8));
        #include <opaque_fragment>
      `);
    };
    bedMaterial.customProgramCacheKey=()=>"reef-bed";
    const shelf=new THREE.Mesh(bed,bedMaterial);shelf.receiveShadow=true;shelf.renderOrder=-3;this.group.add(shelf);
  }

  advance(delta:number) {
    this.timeUniform.value+=Math.min(Math.max(delta,0),.05);
    this.life.advance();
  }

  render(renderer:THREE.WebGLRenderer,scene:THREE.Scene,camera:THREE.Camera) {
    if(!this.group.visible) {renderer.render(scene,camera);return;}
    scene.updateMatrixWorld(true);camera.updateMatrixWorld();
    this.life.updateWaterTransform();
    const planePoint=new THREE.Vector3(0,WATER_LEVEL,0).applyMatrix4(this.surface.matrixWorld);
    const planeNormal=new THREE.Vector3(0,1,0).transformDirection(this.surface.matrixWorld);
    const plane=new THREE.Plane().setFromNormalAndCoplanarPoint(planeNormal,planePoint);
    const eye=new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld);
    const look=eye.clone().add(camera.getWorldDirection(new THREE.Vector3()));
    const reflect=(p:THREE.Vector3)=>p.addScaledVector(planeNormal,-2*plane.distanceToPoint(p));
    this.mirrorCamera.position.copy(reflect(eye.clone()));
    this.mirrorCamera.up.set(0,1,0).transformDirection(camera.matrixWorld).reflect(planeNormal);
    this.mirrorCamera.lookAt(reflect(look));this.mirrorCamera.updateMatrixWorld();
    this.mirrorCamera.projectionMatrix.copy(camera.projectionMatrix);
    this.mirrorMatrix.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1)
      .multiply(this.mirrorCamera.projectionMatrix).multiply(this.mirrorCamera.matrixWorldInverse);
    // Oblique near-plane clipping excludes submerged geometry from the reflection.
    const clip=plane.clone().applyMatrix4(this.mirrorCamera.matrixWorldInverse);
    const v=new THREE.Vector4(clip.normal.x,clip.normal.y,clip.normal.z,clip.constant);
    const projection=this.mirrorCamera.projectionMatrix.elements;
    const q=new THREE.Vector4((Math.sign(v.x)+projection[8])/projection[0],
      (Math.sign(v.y)+projection[9])/projection[5],-1,(1+projection[10])/projection[14]);
    v.multiplyScalar(2/v.dot(q));
    projection[2]=v.x;projection[6]=v.y;projection[10]=v.z+1-.003;projection[14]=v.w;
    this.mirrorCamera.projectionMatrixInverse.copy(this.mirrorCamera.projectionMatrix).invert();
    renderer.getDrawingBufferSize(this.size);
    // Preserve submerged rock detail while bounding the capture on high-DPI screens.
    const captureScale=Math.min(1,1440/this.size.x,1600/this.size.y);
    const w=Math.max(1,Math.floor(this.size.x*captureScale)),h=Math.max(1,Math.floor(this.size.y*captureScale));
    if(this.target.width!==w || this.target.height!==h) this.target.setSize(w,h);
    const rw=Math.min(1024,w),rh=Math.max(1,Math.round(h*rw/w));
    if(this.reflection.width!==rw || this.reflection.height!==rh) this.reflection.setSize(rw,rh);
    this.surface.material.uniforms.uResolution.value.copy(this.size);
    const perspective=camera as THREE.PerspectiveCamera;
    this.surface.material.uniforms.uNearFar.value.set(perspective.near,perspective.far);
    const previous=renderer.getRenderTarget();
    const autoShadow=renderer.shadowMap.autoUpdate;
    this.surface.visible=false;this.captureUniform.value=1;
    try {
      renderer.setRenderTarget(this.target);renderer.render(scene,camera);
      renderer.shadowMap.autoUpdate=false;
      renderer.setRenderTarget(this.reflection);renderer.render(scene,this.mirrorCamera);
      this.surface.visible=true;this.captureUniform.value=0;renderer.setRenderTarget(previous);renderer.render(scene,camera);
    } finally {
      this.surface.visible=true;this.captureUniform.value=0;renderer.setRenderTarget(previous);renderer.shadowMap.autoUpdate=autoShadow;
    }
  }
}
