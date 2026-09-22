import * as THREE from "three";
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
}

interface EdgeVisual {
  edge: GraphEdge;
  line: THREE.Line;
  source: NodeVisual;
  target: NodeVisual;
}

const TERRAIN_CENTERS: Record<string, [number, number]> = {
  AI: [-4.5, -3.25], BIZ: [4.4, -3.1], PRO: [-4.25, 3.35], SOC: [4.35, 3.35],
};

const STAR_CENTERS: Record<string, [number, number, number]> = {
  AI: [3.2, -2.15, -0.25], BIZ: [3.15, 2.2, 0.3], PRO: [-3.15, 2.2, -0.1], SOC: [-3.2, -2.15, 0.25],
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function seeded(index: number): number {
  const value = Math.sin(index * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function boundaryRadius(angle: number): number {
  return 1 + Math.sin(angle * 3 + 0.4) * 0.055 + Math.cos(angle * 5 - 0.7) * 0.04 + Math.sin(angle * 8) * 0.018;
}

function terrainHeightAt(x: number, z: number, nodes: GraphNode[]): number {
  const normalized = Math.sqrt((x / 10.7) ** 2 + (z / 8.25) ** 2);
  if (normalized > boundaryRadius(Math.atan2(z / 8.25, x / 10.7))) return -1.2;
  let height = 0.2 + (1 - normalized) * 0.32;
  for (const [centerX, centerZ] of Object.values(TERRAIN_CENTERS)) {
    const distance = (x - centerX) ** 2 + (z - centerZ) ** 2;
    height += Math.exp(-distance / 12) * 0.7;
  }
  for (const node of nodes) {
    const dx = x - node.terrain_position[0];
    const dz = z - node.terrain_position[2];
    const distance = dx * dx + dz * dz;
    const peak = 0.16 + Math.max(0, node.terrain_position[1] - 0.5) * 0.44;
    height += Math.exp(-distance / 0.62) * peak;
  }
  return height + Math.sin(x * 1.22 + z * 0.28) * Math.cos(z * 1.05 - x * 0.18) * 0.07;
}

function starPosition(node: GraphNode, index: number, domainIndex: number): THREE.Vector3 {
  const center = STAR_CENTERS[node.domain_id];
  const localIndex = index % 15;
  const phi = Math.acos(1 - 2 * ((localIndex + 0.6) / 15));
  const theta = localIndex * 2.399963 + domainIndex * 0.72;
  const radius = 1.45 + seeded(index * 7 + 3) * 0.85;
  return new THREE.Vector3(
    center[0] + Math.sin(phi) * Math.cos(theta) * radius,
    center[1] + Math.cos(phi) * radius * 0.82,
    center[2] + Math.sin(phi) * Math.sin(theta) * radius * 0.9,
  );
}

function makeTerrainGeometry(nodes: GraphNode[], domains: GraphDomain[]): THREE.BufferGeometry {
  const radialSteps = 22;
  const segments = 96;
  const positions: number[] = [0, terrainHeightAt(0, 0, nodes) - 0.85, 0];
  const colors: number[] = [];
  const indices: number[] = [];
  const darkRock = new THREE.Color("#25272a");
  const soil = new THREE.Color("#68685f");
  const colorByDomain = new Map(domains.map((domain) => [domain.id, new THREE.Color(domain.color)]));
  const vertexColor = (x: number, z: number, edge = false) => {
    if (edge) return darkRock.clone().lerp(new THREE.Color("#111114"), 0.28);
    let nearest = domains[0];
    let distance = Number.POSITIVE_INFINITY;
    for (const domain of domains) {
      const [cx, cz] = TERRAIN_CENTERS[domain.id];
      const next = (x - cx) ** 2 + (z - cz) ** 2;
      if (next < distance) { distance = next; nearest = domain; }
    }
    return soil.clone().lerp(colorByDomain.get(nearest.id)!, 0.28).offsetHSL(0, 0, seeded(Math.round((x + 12) * 31 + (z + 10) * 17)) * 0.055);
  };
  const centerColor = vertexColor(0, 0);
  colors.push(centerColor.r, centerColor.g, centerColor.b);
  for (let ring = 1; ring <= radialSteps; ring += 1) {
    const t = ring / radialSteps;
    for (let segment = 0; segment < segments; segment += 1) {
      const angle = (segment / segments) * Math.PI * 2;
      const wobble = boundaryRadius(angle);
      const x = Math.cos(angle) * 10.7 * t * wobble;
      const z = Math.sin(angle) * 8.25 * t * wobble;
      positions.push(x, terrainHeightAt(x, z, nodes) - 0.85, z);
      const color = vertexColor(x, z);
      colors.push(color.r, color.g, color.b);
    }
  }
  for (let segment = 0; segment < segments; segment += 1) {
    const next = (segment + 1) % segments;
    indices.push(0, 1 + next, 1 + segment);
  }
  for (let ring = 1; ring < radialSteps; ring += 1) {
    const innerStart = 1 + (ring - 1) * segments;
    const outerStart = 1 + ring * segments;
    for (let segment = 0; segment < segments; segment += 1) {
      const next = (segment + 1) % segments;
      indices.push(innerStart + segment, outerStart + next, outerStart + segment);
      indices.push(innerStart + segment, innerStart + next, outerStart + next);
    }
  }
  const topStart = 1 + (radialSteps - 1) * segments;
  const wallStart = positions.length / 3;
  for (let segment = 0; segment < segments; segment += 1) {
    const angle = (segment / segments) * Math.PI * 2;
    const wobble = boundaryRadius(angle);
    const x = Math.cos(angle) * 10.7 * wobble;
    const z = Math.sin(angle) * 8.25 * wobble;
    positions.push(x, -2.35 - seeded(segment * 11) * 0.42, z);
    const color = vertexColor(x, z, true);
    colors.push(color.r, color.g, color.b);
  }
  for (let segment = 0; segment < segments; segment += 1) {
    const next = (segment + 1) % segments;
    indices.push(topStart + segment, wallStart + next, wallStart + segment);
    indices.push(topStart + segment, topStart + next, wallStart + next);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
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

  constructor(canvas: HTMLCanvasElement, data: GraphData, callbacks: RendererCallbacks) {
    this.canvas = canvas;
    this.data = data;
    this.callbacks = callbacks;
    this.domainById = new Map(data.domains.map((domain) => [domain.id, domain]));
    data.domains.forEach((domain) => this.enabledDomains.add(domain.id));
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.camera.position.set(0, 0.7, this.targetZoom);
    this.scene.add(this.world);
    const ambient = new THREE.HemisphereLight("#f6ffff", "#17191c", 2.25);
    const key = new THREE.DirectionalLight("#fff8e8", 3.2);
    key.position.set(-7, 12, 9);
    const rim = new THREE.DirectionalLight("#65d9ed", 1.15);
    rim.position.set(10, 4, -9);
    this.scene.add(ambient, key, rim);
    this.starField = this.createStarField();
    this.scene.add(this.starField);
    this.createStarDecor();
    this.world.add(this.starDecor);
    this.terrain = new THREE.Mesh(
      makeTerrainGeometry(data.nodes, data.domains),
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0.02, transparent: true, opacity: 0 }),
    );
    this.terrain.visible = false;
    this.world.add(this.terrain, this.terrainDecor);
    this.createNodes();
    this.createEdges();
    this.createTerrainDecor();
    this.bindEvents();
    this.resize();
    this.animate();
  }

  private createStarField(): THREE.Points {
    const positions: number[] = [];
    for (let index = 0; index < 520; index += 1) positions.push((seeded(index * 3) - 0.5) * 38, (seeded(index * 3 + 1) - 0.5) * 26, (seeded(index * 3 + 2) - 0.5) * 24 - 4);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    return new THREE.Points(geometry, new THREE.PointsMaterial({ color: "#b7c9cc", size: 0.027, transparent: true, opacity: 0.28, sizeAttenuation: true }));
  }

  private createStarDecor() {
    this.starDecor.add(ellipse(7.5, 4.85, [0.5, 0.18, -0.23], 0.14), ellipse(7.1, 4.4, [-0.38, 0.55, 0.2], 0.1), ellipse(5.7, 5.7, [0.08, 1.18, 0.08], 0.075));
    for (const domain of this.data.domains) {
      const center = STAR_CENTERS[domain.id];
      const ring = ellipse(2.5, 1.8, [0.34, 0.16, seeded(domain.id.charCodeAt(0)) * 0.8], 0.12);
      (ring.material as THREE.LineBasicMaterial).color.set(domain.color);
      ring.position.set(...center);
      this.starDecor.add(ring);
    }
  }

  private createNodes() {
    const geometry = new THREE.IcosahedronGeometry(0.18, 2);
    const haloGeometry = new THREE.RingGeometry(0.25, 0.32, 32);
    this.data.nodes.forEach((node, index) => {
      const domain = this.domainById.get(node.domain_id)!;
      const material = new THREE.MeshStandardMaterial({ color: domain.color, emissive: domain.color, emissiveIntensity: 0.72, roughness: 0.3, metalness: 0.06, transparent: true, opacity: 0.98 });
      const mesh = new THREE.Mesh(geometry, material);
      const halo = new THREE.Mesh(haloGeometry, new THREE.MeshBasicMaterial({ color: domain.color, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }));
      halo.position.z = -0.02;
      mesh.add(halo);
      const baseScale = 0.9 + Math.min(node.metrics.total_incident, 7) * 0.052;
      const star = starPosition(node, index, this.data.domains.findIndex((item) => item.id === node.domain_id));
      const x = node.terrain_position[0];
      const z = node.terrain_position[2];
      const terrain = new THREE.Vector3(x, terrainHeightAt(x, z, this.data.nodes) - 0.42, z);
      mesh.scale.setScalar(baseScale);
      mesh.position.copy(star);
      mesh.userData.nodeId = node.id;
      this.world.add(mesh);
      const platform = new THREE.Group();
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.46, 0.22, 18), new THREE.MeshStandardMaterial({ color: "#2e3132", roughness: 0.8, metalness: 0.12 }));
      const platformRim = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.035, 8, 28), new THREE.MeshBasicMaterial({ color: domain.color, transparent: true, opacity: 0.78 }));
      platformRim.rotation.x = Math.PI / 2;
      platformRim.position.y = 0.12;
      platform.add(base, platformRim);
      platform.position.set(x, terrain.y - 0.29, z);
      platform.visible = false;
      this.terrainDecor.add(platform);
      this.nodes.set(node.id, { node, mesh, halo, platform, star, terrain, baseScale });
    });
  }

  private createEdges() {
    for (const edge of this.data.edges) {
      const source = this.nodes.get(edge.source);
      const target = this.nodes.get(edge.target);
      if (!source || !target) continue;
      const geometry = new THREE.BufferGeometry().setFromPoints(Array.from({ length: 13 }, () => new THREE.Vector3()));
      const material = edge.type === "requires"
        ? new THREE.LineBasicMaterial({ color: "#d8e3e4", transparent: true, opacity: 0.22 })
        : new THREE.LineDashedMaterial({ color: "#aeb5b6", dashSize: edge.type === "supports" ? 0.16 : 0.04, gapSize: edge.type === "supports" ? 0.11 : 0.1, transparent: true, opacity: 0.14 });
      const line = new THREE.Line(geometry, material);
      line.renderOrder = -1;
      this.world.add(line);
      this.edges.push({ edge, line, source, target });
    }
  }

  private createTerrainDecor() {
    const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.035, 0.05, 0.26, 5), new THREE.MeshStandardMaterial({ color: "#35322b", roughness: 1 }), 84);
    const crowns = new THREE.InstancedMesh(new THREE.ConeGeometry(0.18, 0.55, 6), new THREE.MeshStandardMaterial({ color: "#294c3b", roughness: 0.95 }), 84);
    const trunkMatrix = new THREE.Matrix4();
    const crownMatrix = new THREE.Matrix4();
    let placed = 0;
    for (let index = 0; index < 160 && placed < 84; index += 1) {
      const angle = seeded(index * 5) * Math.PI * 2;
      const radius = 2.2 + seeded(index * 5 + 1) * 7.1;
      const x = Math.cos(angle) * radius * 1.18;
      const z = Math.sin(angle) * radius * 0.83;
      const nearNode = this.data.nodes.some((node) => Math.hypot(x - node.terrain_position[0], z - node.terrain_position[2]) < 0.72);
      if (nearNode || terrainHeightAt(x, z, this.data.nodes) < -0.3) continue;
      const y = terrainHeightAt(x, z, this.data.nodes) - 0.84;
      const scale = 0.72 + seeded(index * 5 + 2) * 0.75;
      trunkMatrix.compose(new THREE.Vector3(x, y + 0.13 * scale, z), new THREE.Quaternion(), new THREE.Vector3(scale, scale, scale));
      crownMatrix.compose(new THREE.Vector3(x, y + 0.5 * scale, z), new THREE.Quaternion(), new THREE.Vector3(scale, scale, scale));
      trunks.setMatrixAt(placed, trunkMatrix);
      crowns.setMatrixAt(placed, crownMatrix);
      placed += 1;
    }
    trunks.count = placed;
    crowns.count = placed;
    this.terrainDecor.add(trunks, crowns);
    const centerMarker = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.05, 0.25, 32), new THREE.MeshStandardMaterial({ color: "#34373a", roughness: 0.58, metalness: 0.25 }));
    centerMarker.position.set(0, terrainHeightAt(0, 0, this.data.nodes) - 0.94, 0);
    const centerRing = new THREE.Mesh(new THREE.TorusGeometry(0.86, 0.035, 8, 48), new THREE.MeshBasicMaterial({ color: "#f1f1ef", transparent: true, opacity: 0.4 }));
    centerRing.rotation.x = Math.PI / 2;
    centerRing.position.y = 0.14;
    centerMarker.add(centerRing);
    this.terrainDecor.add(centerMarker);

    const ridgeMaterial = new THREE.MeshStandardMaterial({ color: "#4a4d49", roughness: 0.96, flatShading: true });
    Object.entries(TERRAIN_CENTERS).forEach(([domainId, [cx, cz]], domainIndex) => {
      const domain = this.domainById.get(domainId)!;
      for (let peak = 0; peak < 3; peak += 1) {
        const angle = domainIndex * 1.45 + peak * 2.2;
        const x = cx + Math.cos(angle) * (0.8 + peak * 0.28);
        const z = cz + Math.sin(angle) * (0.65 + peak * 0.24);
        const rock = new THREE.Mesh(new THREE.ConeGeometry(0.55 - peak * 0.08, 1.25 - peak * 0.16, 7), ridgeMaterial.clone());
        (rock.material as THREE.MeshStandardMaterial).color.lerp(new THREE.Color(domain.color), 0.13);
        rock.position.set(x, terrainHeightAt(x, z, this.data.nodes) - 0.2, z);
        rock.rotation.y = seeded(domainIndex * 10 + peak) * Math.PI;
        this.terrainDecor.add(rock);
      }
    });

    let bridgeCount = 0;
    this.data.edges.forEach((edge, index) => {
      const source = this.nodes.get(edge.source);
      const target = this.nodes.get(edge.target);
      if (!source || !target) return;
      const crossDomain = source.node.domain_id !== target.node.domain_id;
      if (!crossDomain && index % 7 !== 0) return;
      if (crossDomain && bridgeCount > 4) return;
      if (crossDomain) bridgeCount += 1;
      const start = source.terrain.clone();
      const end = target.terrain.clone();
      start.y -= 0.08;
      end.y -= 0.08;
      const middle = start.clone().lerp(end, 0.5);
      middle.y += crossDomain ? 0.38 : 0.16;
      const curve = new THREE.QuadraticBezierCurve3(start, middle, end);
      const route = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 24, crossDomain ? 0.035 : 0.022, 6, false),
        new THREE.MeshStandardMaterial({ color: crossDomain ? "#4e5049" : "#7d8175", roughness: 0.9, metalness: 0.04 }),
      );
      this.terrainDecor.add(route);
    });
    this.terrainDecor.visible = false;
  }

  private bindEvents() {
    this.canvas.addEventListener("pointerdown", (event) => { this.dragging = true; this.dragged = false; this.previousPointer = { x: event.clientX, y: event.clientY }; this.canvas.setPointerCapture(event.pointerId); });
    this.canvas.addEventListener("pointermove", (event) => {
      if (this.dragging) {
        const dx = event.clientX - this.previousPointer.x;
        const dy = event.clientY - this.previousPointer.y;
        if (Math.abs(dx) + Math.abs(dy) > 2) this.dragged = true;
        this.targetRotation.y += dx * 0.004;
        this.targetRotation.x = clamp(this.targetRotation.x + dy * 0.0035, -1.2, 0.68);
        this.previousPointer = { x: event.clientX, y: event.clientY };
        return;
      }
      this.updatePointer(event);
      const hit = this.pickNode();
      const nodeId = hit?.node.id ?? null;
      if (nodeId !== this.hoveredId) { this.hoveredId = nodeId; this.callbacks.onHover(hit?.node ?? null, { x: event.clientX, y: event.clientY }); this.canvas.style.cursor = hit ? "pointer" : "grab"; }
      else if (hit) this.callbacks.onHover(hit.node, { x: event.clientX, y: event.clientY });
    });
    const finishPointer = (event: PointerEvent) => { if (!this.dragging) return; this.dragging = false; if (!this.dragged) { this.updatePointer(event); this.callbacks.onSelect(this.pickNode()?.node ?? null); } };
    this.canvas.addEventListener("pointerup", finishPointer);
    this.canvas.addEventListener("pointercancel", () => { this.dragging = false; });
    this.canvas.addEventListener("pointerleave", () => { if (!this.dragging) { this.hoveredId = null; this.callbacks.onHover(null); } });
    this.canvas.addEventListener("wheel", (event) => { event.preventDefault(); this.targetZoom = clamp(this.targetZoom + event.deltaY * 0.011, 11.5, 29); }, { passive: false });
    window.addEventListener("resize", () => this.resize());
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
    this.frame = window.requestAnimationFrame(this.animate);
    const ease = this.reducedMotion ? 1 : 0.085;
    this.world.rotation.x += (this.targetRotation.x - this.world.rotation.x) * ease;
    this.world.rotation.y += (this.targetRotation.y - this.world.rotation.y) * ease;
    this.camera.position.z += (this.targetZoom - this.camera.position.z) * ease;
    if (this.transitionProgress < 1) this.transitionProgress = Math.min(1, this.transitionProgress + (this.reducedMotion ? 1 : 0.035));
    for (const visual of this.nodes.values()) visual.mesh.position.lerp(this.view === "star" ? visual.star : visual.terrain, this.reducedMotion ? 1 : 0.11);
    this.updateEdges();
    this.updateVisualState();
    this.updateEnvironment();
    this.renderer.render(this.scene, this.camera);
    this.updateDomainLabels();
  };

  private updateEdges() {
    for (const visual of this.edges) {
      const start = visual.source.mesh.position;
      const end = visual.target.mesh.position;
      const middle = start.clone().lerp(end, 0.5);
      if (this.view === "star") middle.normalize().multiplyScalar(Math.max(start.length(), end.length()) + 0.65);
      else middle.y += 0.42 + start.distanceTo(end) * 0.045;
      const positions = visual.line.geometry.getAttribute("position") as THREE.BufferAttribute;
      new THREE.QuadraticBezierCurve3(start, middle, end).getPoints(12).forEach((point, index) => positions.setXYZ(index, point.x, point.y, point.z));
      positions.needsUpdate = true;
      visual.line.computeLineDistances();
    }
  }

  private updateVisualState() {
    const neighborIds = new Set<string>();
    if (this.selectedId) {
      neighborIds.add(this.selectedId);
      for (const visual of this.edges) { if (visual.edge.source === this.selectedId) neighborIds.add(visual.edge.target); if (visual.edge.target === this.selectedId) neighborIds.add(visual.edge.source); }
    }
    for (const visual of this.nodes.values()) {
      const visible = this.enabledDomains.has(visual.node.domain_id);
      visual.mesh.visible = visible;
      visual.platform.visible = visible && this.view === "terrain";
      if (!visible) continue;
      const material = visual.mesh.material as THREE.MeshStandardMaterial;
      const active = !this.selectedId || neighborIds.has(visual.node.id);
      material.opacity += ((active ? 0.98 : 0.14) - material.opacity) * 0.12;
      const selectedScale = visual.node.id === this.selectedId ? 1.65 : visual.node.id === this.hoveredId ? 1.3 : 1;
      const targetScale = visual.baseScale * selectedScale * (this.view === "terrain" ? 0.86 : 1);
      visual.mesh.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.14);
      material.emissiveIntensity = visual.node.id === this.selectedId ? 1.8 : visual.node.id === this.hoveredId ? 1.2 : 0.72;
      (visual.halo.material as THREE.MeshBasicMaterial).opacity = active ? (visual.node.id === this.selectedId ? 0.72 : 0.2) : 0.04;
    }
    for (const visual of this.edges) {
      const visible = this.enabledDomains.has(visual.source.node.domain_id) && this.enabledDomains.has(visual.target.node.domain_id);
      visual.line.visible = visible;
      if (!visible) continue;
      const connected = this.selectedId && (visual.edge.source === this.selectedId || visual.edge.target === this.selectedId);
      const material = visual.line.material as THREE.LineBasicMaterial;
      const base = this.view === "terrain" ? 0.26 : visual.edge.type === "related_to" ? 0.16 : visual.edge.type === "requires" ? 0.24 : 0.14;
      material.opacity += ((this.selectedId ? (connected ? 0.9 : 0.018) : base) - material.opacity) * 0.14;
      material.color.set(connected ? this.domainById.get(visual.source.node.domain_id)?.color ?? "#f1f1ef" : this.view === "terrain" ? "#565e58" : "#aebfc2");
    }
  }

  private updateEnvironment() {
    const terrainMaterial = this.terrain.material as THREE.MeshStandardMaterial;
    const starMaterial = this.starField.material as THREE.PointsMaterial;
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
      center.y += this.view === "terrain" ? 1.25 : 0;
      center.applyMatrix4(this.world.matrixWorld).project(this.camera);
      return { id: domain.id, kind: "domain", x: (center.x * 0.5 + 0.5) * rect.width, y: (-center.y * 0.5 + 0.5) * rect.height, visible: members.length > 0 && center.z > -1 && center.z < 1 };
    });
    for (const domain of this.data.domains) {
      const keyNodes = [...this.nodes.values()]
        .filter((visual) => visual.node.domain_id === domain.id)
        .sort((a, b) => b.node.metrics.total_incident - a.node.metrics.total_incident)
        .slice(0, 3);
      keyNodes.forEach((visual) => {
        const point = visual.mesh.position.clone();
        point.applyMatrix4(this.world.matrixWorld).project(this.camera);
        positions.push({
          id: `node:${visual.node.id}`,
          kind: "node",
          x: (point.x * 0.5 + 0.5) * rect.width,
          y: (-point.y * 0.5 + 0.5) * rect.height,
          visible: visual.mesh.visible && point.z > -1 && point.z < 1,
        });
      });
    }
    this.callbacks.onLabels(positions);
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    this.renderer.setSize(rect.width, rect.height, false);
    this.camera.aspect = rect.width / rect.height;
    this.camera.updateProjectionMatrix();
    this.world.position.x = rect.width > 900 ? 2.25 : 0;
  }

  setView(view: ViewMode, immediate = false) {
    if (view === this.view && !immediate) return;
    this.view = view;
    this.transitionProgress = immediate ? 1 : 0;
    this.targetRotation = view === "star" ? { x: -0.08, y: -0.16 } : { x: 0.66, y: -0.16 };
    this.targetZoom = view === "star" ? 18.5 : 20.5;
    if (immediate) for (const visual of this.nodes.values()) visual.mesh.position.copy(view === "star" ? visual.star : visual.terrain);
  }

  setSelected(nodeId: string | null) { this.selectedId = nodeId; }

  setEnabledDomains(domains: Set<string>) {
    this.enabledDomains.clear();
    domains.forEach((domain) => this.enabledDomains.add(domain));
  }

  resetView() {
    this.targetRotation = this.view === "star" ? { x: -0.08, y: -0.16 } : { x: 0.66, y: -0.16 };
    this.targetZoom = this.view === "star" ? 18.5 : 20.5;
  }
}
