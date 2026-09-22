import type { DomainScreenPosition, GraphData, GraphNode, ViewMode } from "./types";

interface FallbackCallbacks {
  onHover: (node: GraphNode | null, point?: { x: number; y: number }) => void;
  onSelect: (node: GraphNode | null) => void;
  onLabels: (positions: DomainScreenPosition[]) => void;
}

interface ScreenNode {
  node: GraphNode;
  x: number;
  y: number;
  radius: number;
}

export class CanvasFallbackRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private readonly data: GraphData;
  private readonly callbacks: FallbackCallbacks;
  private readonly enabledDomains: Set<string>;
  private readonly colors: Map<string, string>;
  private screenNodes: ScreenNode[] = [];
  private selectedId: string | null = null;

  constructor(canvas: HTMLCanvasElement, data: GraphData, callbacks: FallbackCallbacks) {
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D is unavailable");
    this.canvas = canvas;
    this.context = context;
    this.data = data;
    this.callbacks = callbacks;
    this.enabledDomains = new Set(data.domains.map((domain) => domain.id));
    this.colors = new Map(data.domains.map((domain) => [domain.id, domain.color]));
    this.bindEvents();
    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  private bindEvents() {
    this.canvas.addEventListener("pointermove", (event) => {
      const node = this.pick(event);
      this.canvas.style.cursor = node ? "pointer" : "default";
      this.callbacks.onHover(node?.node ?? null, { x: event.clientX, y: event.clientY });
    });
    this.canvas.addEventListener("pointerleave", () => this.callbacks.onHover(null));
    this.canvas.addEventListener("click", (event) => this.callbacks.onSelect(this.pick(event)?.node ?? null));
  }

  private pick(event: PointerEvent) {
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    return this.screenNodes.find((item) => Math.hypot(item.x - x, item.y - y) <= item.radius + 8) ?? null;
  }

  private draw() {
    const rect = this.canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const scale = Math.min(width / 25, height / 17);
    const centerX = width * (width > 760 ? 0.62 : 0.5);
    const centerY = height * 0.5;
    const visible = this.data.nodes.filter((node) => this.enabledDomains.has(node.domain_id));
    this.screenNodes = visible.map((node) => ({
      node,
      x: centerX + node.star_position[0] * scale,
      y: centerY - node.star_position[1] * scale,
      radius: 4 + Math.min(node.metrics.total_incident, 7) * 0.55,
    }));
    const positions = new Map(this.screenNodes.map((item) => [item.node.id, item]));

    this.context.clearRect(0, 0, width, height);
    this.context.lineWidth = 1;
    for (const edge of this.data.edges) {
      const source = positions.get(edge.source);
      const target = positions.get(edge.target);
      if (!source || !target) continue;
      const connected = this.selectedId && (edge.source === this.selectedId || edge.target === this.selectedId);
      this.context.globalAlpha = this.selectedId ? (connected ? 0.72 : 0.05) : 0.16;
      this.context.strokeStyle = "#AEB5B6";
      this.context.setLineDash(edge.type === "requires" ? [] : edge.type === "supports" ? [5, 4] : [2, 5]);
      this.context.beginPath();
      this.context.moveTo(source.x, source.y);
      this.context.lineTo(target.x, target.y);
      this.context.stroke();
    }
    this.context.setLineDash([]);
    for (const item of this.screenNodes) {
      const related = !this.selectedId || item.node.id === this.selectedId || this.data.edges.some((edge) =>
        (edge.source === this.selectedId && edge.target === item.node.id) || (edge.target === this.selectedId && edge.source === item.node.id));
      this.context.globalAlpha = related ? 1 : 0.2;
      this.context.fillStyle = this.colors.get(item.node.domain_id) ?? "#F1F1EF";
      this.context.beginPath();
      this.context.arc(item.x, item.y, item.node.id === this.selectedId ? item.radius * 1.55 : item.radius, 0, Math.PI * 2);
      this.context.fill();
    }
    this.context.globalAlpha = 1;
    this.callbacks.onLabels([]);
  }

  private resize() {
    const rect = this.canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio, 2);
    this.canvas.width = Math.round(rect.width * ratio);
    this.canvas.height = Math.round(rect.height * ratio);
    this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.draw();
  }

  setView(_view: ViewMode, _immediate = false) {
    this.draw();
  }

  setSelected(nodeId: string | null) {
    this.selectedId = nodeId;
    this.draw();
  }

  setEnabledDomains(domains: Set<string>) {
    this.enabledDomains.clear();
    domains.forEach((domain) => this.enabledDomains.add(domain));
    this.draw();
  }

  resetView() {
    this.draw();
  }
}
