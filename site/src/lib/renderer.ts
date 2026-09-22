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

const DOMAIN_CENTERS: Record<string, [number, number]> = {
  AI: [-5.4, -3.3],
  BIZ: [5.2, -3.1],
  PRO: [-4.8, 3.5],
  SOC: [5, 3.4],
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function seeded(index: number): number {
  const value = Math.sin(index * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function terrainHeightAt(x: number, z: number, nodes: GraphNode[]): number {
  let domainMounds = 0;
  for (const [centerX, centerZ] of Object.values(DOMAIN_CENTERS)) {
    const distance = (x - centerX) ** 2 + (z - centerZ) ** 2;
    domainMounds += Math.exp(-distance / 14) * 0.72;
  }
  let localPeak = 0;
  for (const node of nodes) {
    const dx = x - node.terrain_position[0];
    const dz = z - node.terrain_position[2];
    const distance = dx * dx + dz * dz;
    localPeak = Math.max(localPeak, Math.exp(-distance / 1.55) * (0.26 + node.terrain_position[1] * 0.19));
  }
  return 0.06 + domainMounds + localPeak + Math.sin(x * 1.35) * Math.cos(z * 1.1) * 0.055;
}

function nodeGeometry(domain: GraphDomain): THREE.BufferGeometry {
  if (domain.marker === "ring") return new THREE.TorusGeometry(0.26, 0.085, 10, 24);
  if (domain.marker === "diamond") return new THREE.OctahedronGeometry(0.3, 0);
  if (domain.marker === "hexagon") {
    const geometry = new THREE.CylinderGeometry(0.27, 0.27, 0.13, 6);
    geometry.rotateX(Math.PI / 2);
    return geometry;
  }
  return new THREE.SphereGeometry(0.25, 18, 12);
}

function makeTerrainGeometry(nodes: GraphNode[], domains: GraphDomain[]): THREE.BufferGeometry {
  const columns = 54;
  const rows = 42;
  const width = 22;
  const depth = 17;
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const colorByDomain = new Map(domains.map((domain) => [domain.id, new THREE.Color(domain.color)]));
  const paperDark = new THREE.Color("#202124");

  for (let row = 0; row <= rows; row += 1) {
    for (let column = 0; column <= columns; column += 1) {
      const x = (column / columns - 0.5) * width;
      const z = (row / rows - 0.5) * depth;
      const edge = Math.pow(x / (width * 0.52), 4) + Math.pow(z / (depth * 0.54), 4);
      const noise = (seeded(row * 131 + column * 17) - 0.5) * 0.16;
      const falloff = clamp(1.18 - edge, 0, 1);
      const y = terrainHeightAt(x, z, nodes) * falloff + noise * falloff - (1 - falloff) * 0.45;
      positions.push(x, y - 1.1, z);

      let nearestDomain = domains[0];
      let nearestDistance = Number.POSITIVE_INFINITY;
      for (const domain of domains) {
        const [centerX, centerZ] = DOMAIN_CENTERS[domain.id];
        const distance = (x - centerX) ** 2 + (z - centerZ) ** 2;
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestDomain = domain;
        }
      }
      const domainColor = colorByDomain.get(nearestDomain.id) ?? paperDark;
      const mixed = paperDark.clone().lerp(domainColor, 0.16 + falloff * 0.12);
      colors.push(mixed.r, mixed.g, mixed.b);
    }
  }

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const centerX = ((column + 0.5) / columns - 0.5) * width;
      const centerZ = ((row + 0.5) / rows - 0.5) * depth;
      const islandEdge = Math.pow(centerX / (width * 0.49), 4) + Math.pow(centerZ / (depth * 0.49), 4);
      const irregularBoundary = 0.88 + Math.sin(centerX * 0.72) * 0.055 + Math.cos(centerZ * 0.83) * 0.045;
      if (islandEdge > irregularBoundary) continue;
      const a = row * (columns + 1) + column;
      const b = a + 1;
      const c = a + columns + 1;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export class GraphRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly data: GraphData;
  private readonly callbacks: RendererCallbacks;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  private readonly world = new THREE.Group();
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly nodes = new Map<string, NodeVisual>();
  private readonly edges: EdgeVisual[] = [];
  private readonly enabledDomains = new Set<string>();
  private readonly domainById: Map<string, GraphDomain>;
  private readonly starField: THREE.Points;
  private readonly terrain: THREE.Mesh;
  private frame = 0;
  private active = true;
  private view: ViewMode = "star";
  private selectedId: string | null = null;
  private hoveredId: string | null = null;
  private dragging = false;
  private dragged = false;
  private previousPointer = { x: 0, y: 0 };
  private targetRotation = { x: -0.12, y: -0.18 };
  private targetZoom = 21;
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
    this.camera.position.set(0, 1.2, this.targetZoom);
    this.scene.add(this.world);

    const ambient = new THREE.HemisphereLight("#EAF8FA", "#18181B", 2.1);
    const key = new THREE.DirectionalLight("#F1F1EF", 2.4);
    key.position.set(-6, 10, 7);
    this.scene.add(ambient, key);

    this.starField = this.createStarField();
    this.scene.add(this.starField);
    this.terrain = new THREE.Mesh(
      makeTerrainGeometry(data.nodes, data.domains),
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.92,
        metalness: 0.03,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
      }),
    );
    this.terrain.visible = false;
    this.world.add(this.terrain);

    this.createNodes();
    this.createEdges();
    this.bindEvents();
    this.resize();
    this.animate();
  }

  private createStarField(): THREE.Points {
    const positions: number[] = [];
    for (let index = 0; index < 260; index += 1) {
      positions.push((seeded(index * 3) - 0.5) * 42, (seeded(index * 3 + 1) - 0.5) * 28, (seeded(index * 3 + 2) - 0.5) * 24 - 5);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    return new THREE.Points(
      geometry,
      new THREE.PointsMaterial({ color: "#AEB5B6", size: 0.035, transparent: true, opacity: 0.24, sizeAttenuation: true }),
    );
  }

  private createNodes() {
    for (const node of this.data.nodes) {
      const domain = this.domainById.get(node.domain_id)!;
      const material = new THREE.MeshStandardMaterial({
        color: domain.color,
        emissive: domain.color,
        emissiveIntensity: 0.35,
        roughness: 0.42,
        metalness: 0.08,
        transparent: true,
        opacity: 0.96,
      });
      const mesh = new THREE.Mesh(nodeGeometry(domain), material);
      const baseScale = 0.86 + Math.min(node.metrics.total_incident, 7) * 0.055;
      mesh.scale.setScalar(baseScale);
      mesh.position.fromArray(node.star_position);
      mesh.userData.nodeId = node.id;
      this.world.add(mesh);
      this.nodes.set(node.id, {
        node,
        mesh,
        star: new THREE.Vector3(...node.star_position),
        terrain: new THREE.Vector3(
          node.terrain_position[0],
          terrainHeightAt(node.terrain_position[0], node.terrain_position[2], this.data.nodes) - 0.72,
          node.terrain_position[2],
        ),
        baseScale,
      });
    }
  }

  private createEdges() {
    for (const edge of this.data.edges) {
      const source = this.nodes.get(edge.source);
      const target = this.nodes.get(edge.target);
      if (!source || !target) continue;
      const geometry = new THREE.BufferGeometry().setFromPoints([source.mesh.position, target.mesh.position]);
      const material = edge.type === "requires"
        ? new THREE.LineBasicMaterial({ color: "#D8E3E4", transparent: true, opacity: 0.2 })
        : new THREE.LineDashedMaterial({
            color: edge.type === "supports" ? "#AEB5B6" : "#F1F1EF",
            dashSize: edge.type === "supports" ? 0.18 : 0.05,
            gapSize: edge.type === "supports" ? 0.12 : 0.12,
            transparent: true,
            opacity: edge.type === "supports" ? 0.13 : 0.18,
          });
      const line = new THREE.Line(geometry, material);
      line.computeLineDistances();
      line.renderOrder = -1;
      this.world.add(line);
      this.edges.push({ edge, line, source, target });
    }
  }

  private bindEvents() {
    this.canvas.addEventListener("pointerdown", (event) => {
      this.dragging = true;
      this.dragged = false;
      this.previousPointer = { x: event.clientX, y: event.clientY };
      this.canvas.setPointerCapture(event.pointerId);
    });
    this.canvas.addEventListener("pointermove", (event) => {
      if (this.dragging) {
        const dx = event.clientX - this.previousPointer.x;
        const dy = event.clientY - this.previousPointer.y;
        if (Math.abs(dx) + Math.abs(dy) > 2) this.dragged = true;
        this.targetRotation.y += dx * 0.005;
        this.targetRotation.x = clamp(this.targetRotation.x + dy * 0.004, -1.08, 0.78);
        this.previousPointer = { x: event.clientX, y: event.clientY };
        return;
      }
      this.updatePointer(event);
      const hit = this.pickNode();
      const nodeId = hit?.node.id ?? null;
      if (nodeId !== this.hoveredId) {
        this.hoveredId = nodeId;
        this.callbacks.onHover(hit?.node ?? null, { x: event.clientX, y: event.clientY });
        this.canvas.style.cursor = hit ? "pointer" : "grab";
      } else if (hit) {
        this.callbacks.onHover(hit.node, { x: event.clientX, y: event.clientY });
      }
    });
    const finishPointer = (event: PointerEvent) => {
      if (!this.dragging) return;
      this.dragging = false;
      if (!this.dragged) {
        this.updatePointer(event);
        const hit = this.pickNode();
        this.callbacks.onSelect(hit?.node ?? null);
      }
    };
    this.canvas.addEventListener("pointerup", finishPointer);
    this.canvas.addEventListener("pointercancel", () => { this.dragging = false; });
    this.canvas.addEventListener("pointerleave", () => {
      if (!this.dragging) {
        this.hoveredId = null;
        this.callbacks.onHover(null);
      }
    });
    this.canvas.addEventListener("wheel", (event) => {
      event.preventDefault();
      this.targetZoom = clamp(this.targetZoom + event.deltaY * 0.012, 11.5, 32);
    }, { passive: false });
    window.addEventListener("resize", () => this.resize());
    document.addEventListener("visibilitychange", () => {
      this.active = !document.hidden;
      if (this.active && !this.frame) this.animate();
    });
  }

  private updatePointer(event: PointerEvent) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private pickNode(): NodeVisual | null {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const visibleMeshes = [...this.nodes.values()].filter((visual) => visual.mesh.visible).map((visual) => visual.mesh);
    const hit = this.raycaster.intersectObjects(visibleMeshes, false)[0];
    if (!hit) return null;
    return this.nodes.get(hit.object.userData.nodeId) ?? null;
  }

  private animate = () => {
    if (!this.active) {
      this.frame = 0;
      return;
    }
    this.frame = window.requestAnimationFrame(this.animate);
    const ease = this.reducedMotion ? 1 : 0.085;
    this.world.rotation.x += (this.targetRotation.x - this.world.rotation.x) * ease;
    this.world.rotation.y += (this.targetRotation.y - this.world.rotation.y) * ease;
    this.camera.position.z += (this.targetZoom - this.camera.position.z) * ease;

    if (this.transitionProgress < 1) this.transitionProgress = Math.min(1, this.transitionProgress + (this.reducedMotion ? 1 : 0.035));
    const smooth = 1 - Math.pow(1 - this.transitionProgress, 4);
    for (const visual of this.nodes.values()) {
      const target = this.view === "star" ? visual.star : visual.terrain;
      if (this.transitionProgress < 1) visual.mesh.position.lerp(target, this.reducedMotion ? 1 : 0.075 + smooth * 0.04);
      else visual.mesh.position.copy(target);
      visual.mesh.rotation.y += this.reducedMotion ? 0 : 0.002;
    }
    this.updateEdges();
    this.updateVisualState();
    this.updateEnvironment();
    this.renderer.render(this.scene, this.camera);
    this.updateDomainLabels();
  };

  private updateEdges() {
    for (const visual of this.edges) {
      const positions = visual.line.geometry.getAttribute("position") as THREE.BufferAttribute;
      positions.setXYZ(0, visual.source.mesh.position.x, visual.source.mesh.position.y, visual.source.mesh.position.z);
      positions.setXYZ(1, visual.target.mesh.position.x, visual.target.mesh.position.y, visual.target.mesh.position.z);
      positions.needsUpdate = true;
      visual.line.computeLineDistances();
    }
  }

  private updateVisualState() {
    const neighborIds = new Set<string>();
    if (this.selectedId) {
      neighborIds.add(this.selectedId);
      for (const visual of this.edges) {
        if (visual.edge.source === this.selectedId) neighborIds.add(visual.edge.target);
        if (visual.edge.target === this.selectedId) neighborIds.add(visual.edge.source);
      }
    }

    for (const visual of this.nodes.values()) {
      const visible = this.enabledDomains.has(visual.node.domain_id);
      visual.mesh.visible = visible;
      if (!visible) continue;
      const material = visual.mesh.material as THREE.MeshStandardMaterial;
      material.depthTest = this.view === "star";
      visual.mesh.renderOrder = this.view === "terrain" ? 2 : 0;
      const active = !this.selectedId || neighborIds.has(visual.node.id);
      material.opacity += ((active ? 0.96 : 0.18) - material.opacity) * 0.12;
      const selectedScale = visual.node.id === this.selectedId ? 1.55 : visual.node.id === this.hoveredId ? 1.25 : 1;
      const targetScale = visual.baseScale * selectedScale;
      visual.mesh.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.14);
      material.emissiveIntensity = visual.node.id === this.selectedId ? 1.25 : visual.node.id === this.hoveredId ? 0.75 : 0.35;
    }

    for (const visual of this.edges) {
      const domainVisible = this.enabledDomains.has(visual.source.node.domain_id) && this.enabledDomains.has(visual.target.node.domain_id);
      visual.line.visible = domainVisible;
      if (!domainVisible) continue;
      const connected = this.selectedId && (visual.edge.source === this.selectedId || visual.edge.target === this.selectedId);
      const material = visual.line.material as THREE.LineBasicMaterial;
      material.depthTest = this.view === "star";
      visual.line.renderOrder = this.view === "terrain" ? 1 : -1;
      const base = visual.edge.type === "related_to" ? 0.18 : visual.edge.type === "requires" ? 0.2 : 0.13;
      material.opacity += (((this.selectedId ? (connected ? 0.82 : 0.025) : base)) - material.opacity) * 0.14;
      material.color.set(connected ? this.domainById.get(visual.source.node.domain_id)?.color ?? "#F1F1EF" : "#AEB5B6");
    }
  }

  private updateEnvironment() {
    const terrainMaterial = this.terrain.material as THREE.MeshStandardMaterial;
    const starMaterial = this.starField.material as THREE.PointsMaterial;
    const terrainTarget = this.view === "terrain" ? 0.98 : 0;
    const starTarget = this.view === "star" ? 0.24 : 0.035;
    terrainMaterial.opacity += (terrainTarget - terrainMaterial.opacity) * 0.09;
    starMaterial.opacity += (starTarget - starMaterial.opacity) * 0.09;
    this.terrain.visible = terrainMaterial.opacity > 0.01;
  }

  private updateDomainLabels() {
    const rect = this.canvas.getBoundingClientRect();
    const positions = this.data.domains.map((domain) => {
      const members = [...this.nodes.values()].filter((visual) => visual.node.domain_id === domain.id && visual.mesh.visible);
      const center = members.reduce((total, visual) => total.add(visual.mesh.position), new THREE.Vector3()).multiplyScalar(1 / Math.max(members.length, 1));
      center.applyMatrix4(this.world.matrixWorld).project(this.camera);
      return {
        id: domain.id,
        x: (center.x * 0.5 + 0.5) * rect.width,
        y: (-center.y * 0.5 + 0.5) * rect.height,
        visible: members.length > 0 && center.z > -1 && center.z < 1,
      };
    });
    this.callbacks.onLabels(positions);
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    this.renderer.setSize(rect.width, rect.height, false);
    this.camera.aspect = rect.width / rect.height;
    this.camera.updateProjectionMatrix();
    this.world.position.x = rect.width > 900 ? 2.1 : 0;
  }

  setView(view: ViewMode, immediate = false) {
    if (view === this.view && !immediate) return;
    this.view = view;
    this.transitionProgress = immediate ? 1 : 0;
    this.targetRotation = view === "star" ? { x: -0.12, y: -0.18 } : { x: -0.78, y: -0.12 };
    this.targetZoom = view === "star" ? 21 : 22.5;
    if (immediate) {
      for (const visual of this.nodes.values()) visual.mesh.position.copy(view === "star" ? visual.star : visual.terrain);
    }
  }

  setSelected(nodeId: string | null) {
    this.selectedId = nodeId;
  }

  setEnabledDomains(domains: Set<string>) {
    this.enabledDomains.clear();
    domains.forEach((domain) => this.enabledDomains.add(domain));
  }

  resetView() {
    this.targetRotation = this.view === "star" ? { x: -0.12, y: -0.18 } : { x: -0.78, y: -0.12 };
    this.targetZoom = this.view === "star" ? 21 : 22.5;
  }
}
