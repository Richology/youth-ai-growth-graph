import * as THREE from "three";
import { heightAt, landscapeGeometry, populateLandscape, buildBridge, rockMaterial, makePavilion, terrainSite, buildFootpath } from "./landscape";
import { starLayout, STAR_CENTERS } from "./star-layout";
import type { DomainScreenPosition, GraphData, GraphDomain, GraphEdge, GraphNode, ViewMode } from "./types";

interface RendererCallbacks {
  onHover: (node: GraphNode | null, point?: { x: number; y: number }) => void;
  onSelect: (node: GraphNode | null) => void;
  onLabels: (positions: DomainScreenPosition[]) => void;
}

interface NodeVisual {
  node: GraphNode;
  mesh: THREE.Mesh;
  halo: THREE.Mesh;
  platform: THREE.Group;
  star: THREE.Vector3;
  terrain: THREE.Vector3;
  baseScale: number;
  landmark: boolean;
}

interface EdgeVisual {
  edge: GraphEdge;
  line: THREE.Line;
  source: NodeVisual;
  target: NodeVisual;
  terrainPoints: THREE.Vector3[];
}

const EDGE_SEGMENTS = 64;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function seeded(index: number): number {
  const value = Math.sin(index * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function radianceTexture() {
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
  const ctx=canvas.getContext('2d')!,gradient=ctx.createRadialGradient(64,64,0,64,64,64);
  gradient.addColorStop(0,'rgba(255,255,255,.65)');gradient.addColorStop(.16,'rgba(255,255,255,.23)');
  gradient.addColorStop(.42,'rgba(255,255,255,.065)');gradient.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);return new THREE.CanvasTexture(canvas);
}

function ellipse(radiusX: number, radiusY: number, rotation: [number, number, number], opacity: number) {
  const points = Array.from({ length: 129 }, (_, index) => {
    const angle = (index / 128) * Math.PI * 2;
    return new THREE.Vector3(Math.cos(angle) * radiusX, Math.sin(angle) * radiusY, 0);
  });
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({ color: "#63777c", transparent: true, opacity, depthWrite: false }),
  );
  line.rotation.set(...rotation);
  return line;
}

export class GraphRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly data: GraphData;
  private readonly starPositions: Map<string, THREE.Vector3>;
  private readonly callbacks: RendererCallbacks;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  private readonly world = new THREE.Group();
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly nodes = new Map<string, NodeVisual>();
  private readonly edges: EdgeVisual[] = [];
  private readonly enabledDomains = new Set<string>();
  private readonly domainById: Map<string, GraphDomain>;
  private readonly starField: THREE.Points;
  private readonly starDecor = new THREE.Group();
  private readonly terrainDecor = new THREE.Group();
  private readonly terrain: THREE.Mesh;
  private frame = 0;
  private active = true;
  private view: ViewMode = "star";
  private selectedId: string | null = null;
  private hoveredId: string | null = null;
  private dragging = false;
  private dragged = false;
  private previousPointer = { x: 0, y: 0 };
  private targetRotation = { x: -0.08, y: -0.16 };
  private targetZoom = 18.5;
  private transitionProgress = 1;
  private reducedMotion = false;
  private pointers = new Map<number, {x:number;y:number}>();
  private pinchDistance = 0;
  private cameras = { star: { x:-.08,y:-.16,zoom:18.5 }, terrain: { x:.88,y:-.12,zoom:25 } };
  private dirtyFrames = 120;
  private focusFrames = 0;
  private invalidate() { this.dirtyFrames = 90; if (!this.frame && this.active) this.animate(); }


  constructor(canvas: HTMLCanvasElement, data: GraphData, callbacks: RendererCallbacks) {
    this.canvas = canvas;
    this.data = data;
    this.starPositions = starLayout(data);
    this.callbacks = callbacks;
    this.domainById = new Map(data.domains.map((domain) => [domain.id, domain]));
    data.domains.forEach((domain) => this.enabledDomains.add(domain.id));
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.camera.position.set(0, 0.7, this.targetZoom);
    this.scene.add(this.world);
    const ambient = new THREE.HemisphereLight("#e4edf4", "#645e4d", 1.45);
    const key = new THREE.DirectionalLight("#fff1d6", 3.4);
    key.position.set(-8, 11, 7);
    key.castShadow = true; key.shadow.mapSize.set(2048,2048);
    Object.assign(key.shadow.camera,{left:-15,right:15,top:15,bottom:-15,near:1,far:50});
    key.shadow.intensity = .62; key.shadow.radius = 3; key.shadow.bias = -.001; key.shadow.normalBias = .025;
    const rim = new THREE.DirectionalLight("#dce9f4", .8);
    rim.position.set(10, 4, -9);
    const fill = new THREE.DirectionalLight("#edf3f5", .3);
    fill.position.set(1, 3, 12);
    this.scene.add(ambient, key, rim, fill);
    this.starField = this.createStarField();
    this.scene.add(this.starField);
    this.createStarDecor();
    this.world.add(this.starDecor);
    this.terrain = new THREE.Mesh(
      landscapeGeometry(),
      rockMaterial(() => this.invalidate()),
    );
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(27, 22), new THREE.ShadowMaterial({ opacity: .11, depthWrite: false }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1.42;
    ground.receiveShadow = true;
    this.terrainDecor.add(ground);
    this.terrain.visible = false;
    this.terrain.renderOrder = -2;
    this.terrain.receiveShadow = true; this.terrain.castShadow = true;
    this.world.add(this.terrain, this.terrainDecor);
    this.createNodes();
    this.createEdges();
    this.createTerrainDecor();
    this.bindEvents();
    this.resize();
  }

  private createStarField(): THREE.Points {
    const positions: number[] = [];
    for (let index = 0; index < 520; index += 1) positions.push((seeded(index * 3) - 0.5) * 38, (seeded(index * 3 + 1) - 0.5) * 26, (seeded(index * 3 + 2) - 0.5) * 24 - 4);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    return new THREE.Points(geometry, new THREE.PointsMaterial({ color: "#b7c9cc", size: 0.027, transparent: true, opacity: 0.28, sizeAttenuation: true }));
  }

  private createStarDecor() {
    const glowMap=radianceTexture();
    this.starDecor.add(ellipse(7.4, 4.9, [.12, .18, -.10], .055), ellipse(7.8, 5.25, [-.16, .2, .08], .035));
    for (const domain of this.data.domains) {
      const domainGroup=new THREE.Group(); domainGroup.userData.domainId=domain.id; this.starDecor.add(domainGroup);
      const members=this.data.nodes.filter(n=>n.domain_id===domain.id);
      const domainCenter=new THREE.Vector3(...STAR_CENTERS[domain.id]);domainCenter.x*=1.23;domainCenter.y*=1.16;
      const hub=new THREE.Mesh(new THREE.SphereGeometry(.20,20,16),new THREE.MeshBasicMaterial({color:domain.color,toneMapped:false}));hub.position.copy(domainCenter);domainGroup.add(hub);
      const aura=new THREE.Sprite(new THREE.SpriteMaterial({map:glowMap,color:domain.color,toneMapped:false,transparent:true,opacity:.55,depthWrite:false,blending:THREE.AdditiveBlending}));
      aura.scale.set(2.4,2.4,1);hub.add(aura);
      const groups=[...new Set(members.map(n=>n.subdomain_name))];
      groups.forEach(group=>{
        const children=members.filter(n=>n.subdomain_name===group);
        const points=children.map(n=>this.starPositions.get(n.id)!.clone());
        const center=points.reduce((a,b)=>a.add(b),new THREE.Vector3()).multiplyScalar(1/points.length);
        center.z-=.7;
        const groupHub=new THREE.Mesh(new THREE.SphereGeometry(.045,12,8),new THREE.MeshBasicMaterial({color:domain.color,transparent:true,opacity:.5}));groupHub.position.copy(center);domainGroup.add(groupHub);
        for(const point of [...points,domainCenter]) {
          const middle=center.clone().lerp(point,.5);middle.z-=.25;
          const curve=new THREE.QuadraticBezierCurve3(center,middle,point);
          const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(12)),new THREE.LineBasicMaterial({color:domain.color,transparent:true,opacity:point===domainCenter?.055:.11,depthWrite:false}));domainGroup.add(line);
        }
      });
    }
  }

  private createNodes() {
    const geometry = new THREE.SphereGeometry(0.105, 16, 12);
    const haloGeometry = new THREE.RingGeometry(0.13, 0.145, 32);
    const glowTexture=radianceTexture();
    const landmarkIds=new Set<string>();
    for(const id of new Set(this.data.nodes.map(n=>n.subdomain_id))) {
      const members=this.data.nodes.filter(n=>n.subdomain_id===id).sort((a,b)=>b.metrics.total_incident-a.metrics.total_incident||a.id.localeCompare(b.id));
      if(members[0]) landmarkIds.add(members[0].id);
    }
    this.data.nodes.forEach((node) => {
      const domain = this.domainById.get(node.domain_id)!;
      const material = new THREE.MeshBasicMaterial({ color: domain.color, toneMapped:false, transparent: true, opacity: .92 });
      const mesh = new THREE.Mesh(geometry, material);
      const halo = new THREE.Mesh(haloGeometry, new THREE.MeshBasicMaterial({ color: domain.color, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }));
      halo.position.z = -0.02;
      mesh.add(halo);
      const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTexture,color:domain.color,toneMapped:false,transparent:true,opacity:.5,depthWrite:false,blending:THREE.AdditiveBlending}));glow.scale.set(1.6,1.6,1);mesh.add(glow);
      const baseScale = 0.64 + Math.min(node.metrics.total_incident, 10) * 0.10;
      const star = this.starPositions.get(node.id)!;
      const ordinal = this.data.nodes.filter(n => n.domain_id === node.domain_id).indexOf(node);
      const site = terrainSite(node.domain_id, ordinal, node.terrain_position);
      const { x, z } = site;
      const terrain = site.clone().add(new THREE.Vector3(0, .18, 0));
      mesh.scale.setScalar(baseScale);
      mesh.position.copy(star);
      mesh.userData.nodeId = node.id;
      this.world.add(mesh);
      const landmark=landmarkIds.has(node.id);
      const platform = new THREE.Group();
      const radius=landmark?.21:.12;
      const baseGeometry=new THREE.CylinderGeometry(radius,radius*1.2,landmark?.055:.025,landmark?12:8);
      const vertices=baseGeometry.getAttribute('position');
      for(let i=0;i<vertices.count;i++) {
        const x=vertices.getX(i),z=vertices.getZ(i),angle=Math.atan2(z,x),factor=1+Math.sin(angle*3+ordinal)*.075;
        vertices.setXYZ(i,x*factor,vertices.getY(i),z*factor);
      }
      baseGeometry.computeVertexNormals();
      const base = new THREE.Mesh(baseGeometry, new THREE.MeshStandardMaterial({ color: landmark?"#999782":"#777767", roughness: .98 }));
      base.receiveShadow=true;
      const platformRim = new THREE.Mesh(new THREE.TorusGeometry(radius*.9, 0.009, 8, 32), new THREE.MeshBasicMaterial({ color: domain.color, transparent: true, opacity: 0.78 }));
      platformRim.rotation.x = Math.PI / 2;
      platformRim.position.y = landmark?.032:.018;
      platform.add(base, platformRim);
      platform.position.set(x, site.y + (landmark?.032:.014), z);
      platform.visible = false;
      this.terrainDecor.add(platform);
      this.nodes.set(node.id, { node, mesh, halo, platform, star, terrain, baseScale, landmark });
    });
  }

  private createEdges() {
    for (const edge of this.data.edges) {
      const source = this.nodes.get(edge.source);
      const target = this.nodes.get(edge.target);
      if (!source || !target) continue;
      const geometry = new THREE.BufferGeometry().setFromPoints(Array.from({ length: EDGE_SEGMENTS + 1 }, () => new THREE.Vector3()));
      const material = edge.type === "requires"
        ? new THREE.LineBasicMaterial({ color: "#d8e3e4", transparent: true, opacity: 0.22 })
        : new THREE.LineDashedMaterial({ color: "#aeb5b6", dashSize: edge.type === "supports" ? 0.09 : 0.025, gapSize: edge.type === "supports" ? 0.075 : 0.085, transparent: true, opacity: 0.14 });
      const line = new THREE.Line(geometry, material);
      line.renderOrder = 0;
      this.world.add(line);
      const terrainPoints = Array.from({length:EDGE_SEGMENTS + 1}, (_, i) => {
        const t=i/EDGE_SEGMENTS, point=source.terrain.clone().lerp(target.terrain,t);
        // Keep relationships above the surface, with a subtle lift over the valley.
        point.y=Math.max(point.y, heightAt(point.x,point.z)+.20)+Math.sin(t*Math.PI)*.18;
        return point;
      });
      this.edges.push({ edge, line, source, target, terrainPoints });
    }
  }

  private createTerrainDecor() {
    populateLandscape(this.terrainDecor, [...this.nodes.values()].map(v => v.terrain));
    const bridges = [[[-2.5,-2.7],[2.4,-2.1]],[[-2.2,4],[2.3,5.3]]];
    for (const domain of this.data.domains) {
      const members=[...this.nodes.values()].filter(v=>v.node.domain_id===domain.id);
      const subdomains=[...new Set(members.map(v=>v.node.subdomain_id))];
      for(const id of subdomains) this.terrainDecor.add(buildFootpath(members.filter(v=>v.node.subdomain_id===id).map(v=>v.terrain)));
    }
    for (const [a,b] of bridges) {
      const start = new THREE.Vector3(a[0],heightAt(a[0],a[1])+.065,a[1]);
      const end = new THREE.Vector3(b[0],heightAt(b[0],b[1])+.065,b[1]);
      this.terrainDecor.add(buildBridge(start,end));
    }
    for(const [x,z] of [[-5.5,-3.0],[5.5,2.0]]) this.terrainDecor.add(makePavilion(x,z));
    this.terrainDecor.visible = false;
  }

  private bindEvents() {
    this.canvas.addEventListener("pointerdown", (event) => { this.invalidate(); this.pointers.set(event.pointerId,{x:event.clientX,y:event.clientY}); if(this.pointers.size === 2) { const [a,b]=[...this.pointers.values()]; this.pinchDistance=Math.hypot(a.x-b.x,a.y-b.y); } this.dragging = true; this.dragged = false; this.previousPointer = { x: event.clientX, y: event.clientY }; this.canvas.setPointerCapture(event.pointerId); });
    this.canvas.addEventListener("pointermove", (event) => {
      this.invalidate();
      if(this.pointers.has(event.pointerId)) this.pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
      if(this.pointers.size===2) {
        const [a,b]=[...this.pointers.values()], distance=Math.hypot(a.x-b.x,a.y-b.y);
        this.targetZoom=clamp(this.targetZoom*this.pinchDistance/Math.max(distance,1),11.5,42);
        this.pinchDistance=distance;this.dragged=true;return;
      }
      if (this.dragging) {
        const dx = event.clientX - this.previousPointer.x;
        const dy = event.clientY - this.previousPointer.y;
        if (Math.abs(dx) + Math.abs(dy) > 2) this.dragged = true;
        this.targetRotation.y += dx * 0.004;
        this.targetRotation.x = clamp(this.targetRotation.x + dy * 0.0035, this.view === "terrain" ? 0.18 : -1.2, this.view === "terrain" ? 1.35 : 0.68);
        this.previousPointer = { x: event.clientX, y: event.clientY };
        return;
      }
      this.updatePointer(event);
      const hit = this.pickNode();
      const nodeId = hit?.node.id ?? null;
      if (nodeId !== this.hoveredId) { this.hoveredId = nodeId; this.callbacks.onHover(hit?.node ?? null, { x: event.clientX, y: event.clientY }); this.canvas.style.cursor = hit ? "pointer" : "grab"; }
      else if (hit) this.callbacks.onHover(hit.node, { x: event.clientX, y: event.clientY });
    });
    const finishPointer = (event: PointerEvent) => { this.pointers.delete(event.pointerId); if(this.pointers.size) { this.previousPointer=[...this.pointers.values()][0]; return; } if (!this.dragging) return; this.dragging = false; if (!this.dragged) { this.updatePointer(event); this.callbacks.onSelect(this.pickNode()?.node ?? null); } };
    this.canvas.addEventListener("pointerup", finishPointer);
    this.canvas.addEventListener("pointercancel", () => { this.dragging = false; this.pointers.clear(); });
    this.canvas.addEventListener("pointerleave", () => { if (!this.dragging) { this.hoveredId = null; this.callbacks.onHover(null); } });
    this.canvas.addEventListener("wheel", (event) => { event.preventDefault(); this.invalidate(); this.targetZoom = clamp(this.targetZoom + event.deltaY * 0.011, 11.5, 42); }, { passive: false });
    new ResizeObserver(() => this.resize()).observe(this.canvas);
    document.addEventListener("visibilitychange", () => { this.active = !document.hidden; if (this.active && !this.frame) this.animate(); });
  }

  private updatePointer(event: PointerEvent) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private pickNode(): NodeVisual | null {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const meshes = [...this.nodes.values()].filter((visual) => visual.mesh.visible).map((visual) => visual.mesh);
    const hit = this.raycaster.intersectObjects(meshes, false)[0];
    return hit ? this.nodes.get(hit.object.userData.nodeId) ?? null : null;
  }

  private animate = () => {
    if (!this.active) { this.frame = 0; return; }
    this.frame = 0;
    if (this.dirtyFrames-- > 0) this.frame = window.requestAnimationFrame(this.animate);
    const ease = this.reducedMotion ? 1 : 0.085;
    this.world.rotation.x += (this.targetRotation.x - this.world.rotation.x) * ease;
    this.world.rotation.y += (this.targetRotation.y - this.world.rotation.y) * ease;
    this.camera.position.z += (this.targetZoom - this.camera.position.z) * ease;
    if (this.transitionProgress < 1) this.transitionProgress = Math.min(1, this.transitionProgress + (this.reducedMotion ? 1 : 0.035));
    for (const visual of this.nodes.values()) visual.mesh.position.lerp(this.view === "star" ? visual.star : visual.terrain, this.reducedMotion ? 1 : 0.11);
    this.updateEdges();
    this.updateVisualState();
    this.updateEnvironment();
    if(this.focusFrames-- > 0 && this.selectedId) this.keepSelectionVisible();
    this.renderer.render(this.scene, this.camera);
    this.updateDomainLabels();
  };

  private keepSelectionVisible() {
    const visual=this.nodes.get(this.selectedId!); if(!visual) return;
    const rect=this.canvas.getBoundingClientRect();
    const panel=document.querySelector('#node-details')!.getBoundingClientRect();
    const mobile=window.innerWidth<768;
    this.world.updateMatrixWorld(true);
    const point=visual.mesh.position.clone().applyMatrix4(this.world.matrixWorld).project(this.camera);
    const x=(point.x*.5+.5)*rect.width,y=(-point.y*.5+.5)*rect.height;
    const top=mobile?25:90, bottom=mobile?Math.max(80,panel.top-rect.top-35):rect.height-90;
    const left=mobile?35:Math.min(350,rect.width*.35),right=rect.width-140;
    let dx=0,dy=0;
    if(mobile) {dx=rect.width*.5-x;dy=(top+bottom)*.5-y;}
    else {
      if(x<left) dx=left-x; if(x>right) dx=right-x;
      if(y<top) dy=top-y; if(y>bottom) dy=bottom-y;
      if(this.view==='terrain' && x>panel.left-rect.left-80 && y>panel.top-rect.top-55) dy=panel.top-rect.top-70-y;
    }
    const unit=2*Math.tan(THREE.MathUtils.degToRad(this.camera.fov/2))*this.camera.position.z/rect.height;
    this.world.position.x+=dx*unit*.18;this.world.position.y-=dy*unit*.18;
  }

  private updateEdges() {
    for (const visual of this.edges) {
      const start = visual.source.mesh.position;
      const end = visual.target.mesh.position;
      const middle = start.clone().lerp(end, 0.5);
      if (this.view === "star") middle.z += visual.source.node.domain_id === visual.target.node.domain_id ? 0 : .35;
      else middle.y += 0.24 + start.distanceTo(end) * 0.025;
      const positions = visual.line.geometry.getAttribute("position") as THREE.BufferAttribute;
      const points = this.view === "terrain" && this.transitionProgress >= 1
        ? visual.terrainPoints : new THREE.QuadraticBezierCurve3(start, middle, end).getPoints(EDGE_SEGMENTS);
      points.forEach((point, index) => positions.setXYZ(index, point.x, point.y, point.z));
      positions.needsUpdate = true;
      visual.line.computeLineDistances();
    }
  }

  private updateVisualState() {
    for(const child of this.starDecor.children) if(child.userData.domainId) child.visible=this.enabledDomains.has(child.userData.domainId);
    const neighborIds = new Set<string>();
    if (this.selectedId) {
      neighborIds.add(this.selectedId);
      for (const visual of this.edges) { if (visual.edge.source === this.selectedId) neighborIds.add(visual.edge.target); if (visual.edge.target === this.selectedId) neighborIds.add(visual.edge.source); }
    }
    for (const visual of this.nodes.values()) {
      const visible = this.enabledDomains.has(visual.node.domain_id);
      visual.mesh.visible = visible;
      visual.platform.visible = visible && this.view === "terrain";
      const rim=visual.platform.children[1] as THREE.Mesh<THREE.TorusGeometry,THREE.MeshBasicMaterial>;
      const emphasized=visual.node.id===this.selectedId||visual.node.id===this.hoveredId;
      rim.visible=visual.landmark||emphasized;
      rim.material.opacity=emphasized?.9:.45;
      if (!visible) continue;
      const material = visual.mesh.material as THREE.MeshBasicMaterial;
      const active = !this.selectedId || neighborIds.has(visual.node.id);
      const worldDepth = visual.star.clone().applyMatrix4(this.world.matrixWorld).z;
      const depth = this.view === "star" ? clamp(THREE.MathUtils.mapLinear(worldDepth, -3, 3, .42, 1.0), .35, 1) : .98;
      material.opacity += ((active ? depth : depth * .78) - material.opacity) * 0.12;
      const selectedScale = visual.node.id === this.selectedId ? 1.65 : visual.node.id === this.hoveredId ? 1.3 : 1;
      const targetScale = visual.baseScale * selectedScale * (this.view === "terrain" ? 0.86 : 1);
      visual.mesh.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.14);
      const glow=visual.mesh.children.find(c=>c instanceof THREE.Sprite) as THREE.Sprite;
      (glow.material as THREE.SpriteMaterial).opacity=(active ? .44 : .24) * depth;

      (visual.halo.material as THREE.MeshBasicMaterial).opacity = visual.node.id === this.selectedId ? .65 : visual.node.id === this.hoveredId ? .35 : 0;
    }
    for (const visual of this.edges) {
      const visible = this.enabledDomains.has(visual.source.node.domain_id) && this.enabledDomains.has(visual.target.node.domain_id);
      visual.line.visible = visible;
      if (!visible) continue;
      const connected = this.selectedId && (visual.edge.source === this.selectedId || visual.edge.target === this.selectedId);
      const material = visual.line.material as THREE.LineBasicMaterial;
      const sameDomain = visual.source.node.domain_id === visual.target.node.domain_id;
      const base = this.view === "terrain" ? (sameDomain ? .22 : .065) : (sameDomain ? .34 : .16);
      material.opacity += ((this.selectedId ? (connected ? .78 : base * .40) : base) - material.opacity) * 0.14;
      material.color.set(visual.source.node.domain_id === visual.target.node.domain_id || connected ? this.domainById.get(visual.source.node.domain_id)!.color : this.view === "terrain" ? "#b8c2a5" : "#b2c1c1");
    }
  }

  private updateEnvironment() {
    const terrainMaterial = this.terrain.material as THREE.MeshStandardMaterial;
    const starMaterial = this.starField.material as THREE.PointsMaterial;
    if(this.view === "terrain") terrainMaterial.userData.loadTexture();
    terrainMaterial.opacity = this.view === "terrain" ? Math.min(1, terrainMaterial.opacity + 0.12) : 0;
    starMaterial.opacity += ((this.view === "star" ? 0.28 : 0.025) - starMaterial.opacity) * 0.1;
    this.terrain.visible = this.view === "terrain";
    this.terrainDecor.visible = this.view === "terrain";
    this.starDecor.visible = this.view === "star";
  }

  private updateDomainLabels() {
    const rect = this.canvas.getBoundingClientRect();
    const positions: DomainScreenPosition[] = this.data.domains.map((domain) => {
      const members = [...this.nodes.values()].filter((visual) => visual.node.domain_id === domain.id && visual.mesh.visible);
      const center = members.reduce((total, visual) => total.add(visual.mesh.position), new THREE.Vector3()).multiplyScalar(1 / Math.max(members.length, 1));
      center.y += this.view === "terrain" ? .55 : -.45;
      center.applyMatrix4(this.world.matrixWorld).project(this.camera);
      return { id: domain.id, kind: "domain", x: (center.x * 0.5 + 0.5) * rect.width, y: (-center.y * 0.5 + 0.5) * rect.height, visible: members.length > 0 && center.z > -1 && center.z < 1 };
    });
    const keyIds=new Set<string>();
    if(this.selectedId) {
      keyIds.add(this.selectedId);
      for(const {edge} of this.edges) { if(edge.source===this.selectedId) keyIds.add(edge.target); if(edge.target===this.selectedId) keyIds.add(edge.source); }
    }
    if (!this.selectedId || window.innerWidth >= 768) {
      for(const domain of this.data.domains) [...this.nodes.values()].filter(v=>v.node.domain_id===domain.id).sort((a,b)=>b.node.metrics.total_incident-a.node.metrics.total_incident).slice(0,window.innerWidth<768?1:2).forEach(v=>keyIds.add(v.node.id));
    }
    const localCamera=this.world.worldToLocal(this.camera.position.clone());
    for(const visual of this.nodes.values()) {
      const point=visual.mesh.position.clone().applyMatrix4(this.world.matrixWorld).project(this.camera);
      let occluded=false;
      if(this.view==='terrain' && keyIds.has(visual.node.id) && visual.node.id!==this.selectedId) {
        const target=visual.mesh.position;
        const length=localCamera.distanceTo(target), steps=Math.ceil(length/.25);
        for(let i=1;i<steps-1;i++) {
          const sample=localCamera.clone().lerp(target,i/steps);
          if(Math.abs(sample.x)<10.4 && Math.abs(sample.z)<8.5 && sample.y<heightAt(sample.x,sample.z)-.04) {occluded=true;break;}
        }
      }
      positions.push({id:`node:${visual.node.id}`,kind:'node',x:(point.x*.5+.5)*rect.width,y:(-point.y*.5+.5)*rect.height,visible:!occluded&&keyIds.has(visual.node.id)&&visual.mesh.visible&&point.z>-1&&point.z<1});
    }
    this.callbacks.onLabels(positions);
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    this.renderer.setSize(rect.width, rect.height, false);
    this.camera.aspect = rect.width / rect.height;
    this.camera.updateProjectionMatrix();
    const desktop = window.innerWidth >= 768;
    this.world.position.x = desktop ? (this.view === 'terrain' ? 2.7 : 1.9) : 0;
    this.world.position.y = this.view === 'terrain' ? (desktop ? 1.15 : 3.1) : .35;
    this.world.scale.setScalar(desktop ? Math.min(1,Math.max(.60,(rect.width-260)/1000)) : (this.view === 'star' ? .92 : 1));
    if(desktop && this.view==='terrain') {
      const intro=document.querySelector('.intro-panel')!.getBoundingClientRect();
      const left=Math.min(intro.right-rect.left+24,rect.width*.4);
      const unit=2*Math.tan(THREE.MathUtils.degToRad(20))*this.targetZoom/rect.height;
      this.world.scale.setScalar(Math.min(1,Math.max(.35,(rect.width-left-24)*unit/22)));
      this.world.position.x=(left-24)*.5*unit;
    }
    this.focusFrames=this.selectedId?70:0;
    // Narrow viewports need a wider field of view to retain the whole landscape.
    this.camera.fov = desktop ? 40 : 62;
    this.camera.updateProjectionMatrix();
    this.invalidate();
  }

  setView(view: ViewMode, immediate = false) {
    if (view === this.view && !immediate) return;
    this.cameras[this.view] = { ...this.targetRotation, zoom:this.targetZoom };
    this.view = view;
    this.transitionProgress = immediate ? 1 : 0;
    this.targetRotation = { x:this.cameras[view].x, y:this.cameras[view].y };
    this.targetZoom = this.cameras[view].zoom;
    this.resize();
    if (immediate) for (const visual of this.nodes.values()) visual.mesh.position.copy(view === "star" ? visual.star : visual.terrain);
  }

  setSelected(nodeId: string | null) { this.selectedId = nodeId; this.resize(); this.focusFrames=nodeId?70:0; this.invalidate(); }

  setEnabledDomains(domains: Set<string>) {
    this.invalidate();
    this.enabledDomains.clear();
    domains.forEach((domain) => this.enabledDomains.add(domain));
  }

  resetView() {
    this.invalidate();
    this.targetRotation = this.view === "star" ? { x: -0.08, y: -0.16 } : { x: 0.88, y: -0.12 };
    this.targetZoom = this.view === "star" ? 18.5 : 25;
  }
}
