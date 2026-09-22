import { GraphRenderer } from "../lib/renderer";
import { CanvasFallbackRenderer } from "../lib/canvas-fallback";
import type { GraphData, GraphEdge, GraphNode, ViewMode } from "../lib/types";

const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector);
const $$ = <T extends HTMLElement>(selector: string) => [...document.querySelectorAll<T>(selector)];

const canvas = $("#graph-canvas") as HTMLCanvasElement;
const stage = $("#graph-stage")!;
const app = $("#app-shell")!;
const loading = $("#graph-loading")!;
const errorState = $("#graph-error")!;
const details = $("#node-details")!;
const tooltip = $("#graph-tooltip")!;
const announcer = $("#graph-announcer")!;
const terrainNote = $("#terrain-note")!;

let data: GraphData;
let graphRenderer: GraphRenderer | CanvasFallbackRenderer;
let compatibilityMode = false;
let activeView: ViewMode = "star";
let selectedNode: GraphNode | null = null;
let nodeHistory: string[] = [];
let enabledDomains = new Set<string>();

const nodeById = () => new Map(data.nodes.map((node) => [node.id, node]));

function replaceList(target: HTMLElement | null, values: string[]) {
  if (!target) return;
  target.replaceChildren(...values.map((value) => {
    const item = document.createElement("li");
    item.textContent = value;
    return item;
  }));
}

function setUrlState() {
  const url = new URL(window.location.href);
  if (activeView === "star") url.searchParams.delete("view");
  else url.searchParams.set("view", activeView);
  if (selectedNode) url.searchParams.set("node", selectedNode.id);
  else url.searchParams.delete("node");
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

function relationSets(nodeId: string) {
  const directPrerequisites = data.edges.filter((edge) => edge.type === "requires" && edge.source === nodeId);
  const unlocks = data.edges.filter((edge) => edge.type === "requires" && edge.target === nodeId);
  const supportsOut = data.edges.filter((edge) => edge.type === "supports" && edge.source === nodeId);
  const supportsIn = data.edges.filter((edge) => edge.type === "supports" && edge.target === nodeId);
  const related = data.edges.filter((edge) => edge.type === "related_to" && (edge.source === nodeId || edge.target === nodeId));
  return { directPrerequisites, unlocks, supportsOut, supportsIn, related };
}

function createRelationButton(edge: GraphEdge, currentId: string, label?: string) {
  const targetId = edge.source === currentId ? edge.target : edge.source;
  const target = nodeById().get(targetId);
  const button = document.createElement("button");
  button.type = "button";
  button.className = "relation-node";
  button.dataset.nodeId = targetId;
  const name = document.createElement("span");
  name.textContent = target?.name ?? targetId;
  const meta = document.createElement("small");
  meta.textContent = label ?? target?.subdomain_name ?? targetId;
  button.append(name, meta);
  button.addEventListener("click", () => selectNode(targetId, true));
  return button;
}

function renderRelationGroup(title: string, edges: GraphEdge[], currentId: string, labels?: (edge: GraphEdge) => string) {
  if (!edges.length) return null;
  const group = document.createElement("section");
  group.className = "relation-group";
  const heading = document.createElement("h4");
  heading.textContent = `${title} ${edges.length}`;
  const list = document.createElement("div");
  edges.forEach((edge) => list.append(createRelationButton(edge, currentId, labels?.(edge))));
  group.append(heading, list);
  return group;
}

function renderLifeLinks(node: GraphNode) {
  const container = $("#detail-life")!;
  const names: Record<string, string> = { wealth: "财富", health: "健康", relationships: "关系" };
  container.replaceChildren(...node.life_account_links.map((link) => {
    const item = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = names[link.account] ?? link.account;
    const rationale = document.createElement("span");
    rationale.textContent = link.rationale;
    item.append(title, rationale);
    return item;
  }));
}

function renderLevels(node: GraphNode) {
  const list = $("#detail-levels")!;
  list.replaceChildren(...(["E1", "E2", "E3", "E4"] as const).map((level) => {
    const item = document.createElement("li");
    const badge = document.createElement("strong");
    badge.textContent = level;
    const text = document.createElement("p");
    text.textContent = node.proficiency[level];
    item.append(badge, text);
    return item;
  }));
}

function renderSources(node: GraphNode) {
  const list = $("#detail-sources")!;
  list.replaceChildren(...node.sources.map((source) => {
    const item = document.createElement("li");
    if (source.url) {
      const link = document.createElement("a");
      link.href = source.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = source.citation;
      item.append(link);
    } else {
      item.textContent = source.citation;
    }
    return item;
  }));
  const versions = $("#detail-versions")!;
  versions.replaceChildren(...node.change_log.map((change) => {
    const item = document.createElement("li");
    const label = document.createElement("strong");
    label.textContent = `${change.version} · ${change.date}`;
    const text = document.createElement("span");
    text.textContent = change.summary;
    item.append(label, text);
    return item;
  }));
}

function renderDetails(node: GraphNode) {
  const domain = data.domains.find((item) => item.id === node.domain_id)!;
  const relations = relationSets(node.id);
  $("#detail-domain")!.textContent = `${domain.name} · ${node.subdomain_name}`;
  $("#detail-domain")!.style.setProperty("--node-color", domain.color);
  $("#detail-title")!.textContent = node.name;
  $("#detail-meta")!.textContent = `${node.id} · ${node.status === "draft" ? "草案" : node.status} · v${node.version}`;
  $("#detail-definition")!.textContent = node.definition;
  replaceList($("#detail-behaviors"), node.observable_behaviors);
  replaceList($("#detail-boundaries"), node.boundaries);
  replaceList($("#evidence-strong"), node.evidence.strong);
  replaceList($("#evidence-weak"), node.evidence.weak);
  replaceList($("#evidence-cautions"), node.evidence.cautions);
  renderLifeLinks(node);
  renderLevels(node);
  renderSources(node);

  const summary = $("#relation-summary")!;
  const summaryValues = [
    ["直接前置", relations.directPrerequisites.length],
    ["可继续发展", relations.unlocks.length],
    ["支持关系", relations.supportsOut.length + relations.supportsIn.length],
    ["相关能力", relations.related.length],
  ];
  summary.replaceChildren(...summaryValues.map(([label, value]) => {
    const item = document.createElement("span");
    item.innerHTML = `<strong>${value}</strong>${label}`;
    return item;
  }));

  const relationContainer = $("#detail-relations")!;
  const groups = [
    renderRelationGroup("直接前置", relations.directPrerequisites, node.id),
    renderRelationGroup("可继续发展", relations.unlocks, node.id),
    renderRelationGroup("该能力支持", relations.supportsOut, node.id),
    renderRelationGroup("支持该能力", relations.supportsIn, node.id),
    renderRelationGroup("相关能力", relations.related, node.id),
  ].filter(Boolean) as HTMLElement[];
  if (!groups.length) {
    const empty = document.createElement("p");
    empty.className = "section-note";
    empty.textContent = "当前版本尚未记录直接关系。";
    groups.push(empty);
  }
  relationContainer.replaceChildren(...groups);
  $("#detail-back")!.toggleAttribute("hidden", nodeHistory.length === 0);
}

function selectNode(nodeId: string | null, pushHistory = false) {
  const nextNode = nodeId ? nodeById().get(nodeId) ?? null : null;
  if (pushHistory && selectedNode && selectedNode.id !== nodeId) nodeHistory.push(selectedNode.id);
  selectedNode = nextNode;
  graphRenderer.setSelected(nextNode?.id ?? null);
  if (nextNode) {
    renderDetails(nextNode);
    details.classList.add("is-open");
    details.setAttribute("aria-hidden", "false");
    app.classList.add("has-details");
    announcer.textContent = `已选择能力：${nextNode.name}`;
  } else {
    details.classList.remove("is-open");
    details.setAttribute("aria-hidden", "true");
    app.classList.remove("has-details");
    announcer.textContent = "已关闭能力详情";
    nodeHistory = [];
  }
  setUrlState();
}

function setView(view: ViewMode, immediate = false) {
  activeView = view;
  graphRenderer.setView(view, immediate);
  stage.dataset.view = view;
  app.dataset.view = view;
  terrainNote.hidden = view !== "terrain";
  $$<HTMLButtonElement>("[data-view-button]").forEach((button) => {
    const active = button.dataset.viewButton === view;
    button.setAttribute("aria-pressed", String(active));
  });
  announcer.textContent = view === "star" ? "已切换到星图视图" : "已切换到地形视图";
  setUrlState();
}

function bindTabs() {
  const tabs = $$<HTMLButtonElement>("[role=tab]");
  const panels = $$<HTMLElement>("[role=tabpanel]");
  const activate = (tab: HTMLButtonElement) => {
    tabs.forEach((item) => { item.setAttribute("aria-selected", String(item === tab)); item.tabIndex = item === tab ? 0 : -1; });
    panels.forEach((panel) => { panel.hidden = panel.id !== tab.getAttribute("aria-controls"); });
  };
  tabs.forEach((tab, index) => {
    tab.tabIndex = tab.getAttribute('aria-selected') === 'true' ? 0 : -1;
    tab.addEventListener('click', () => activate(tab));
    tab.addEventListener('keydown', (event) => {
      const next = event.key === 'ArrowRight' ? (index+1)%tabs.length : event.key === 'ArrowLeft' ? (index+tabs.length-1)%tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length-1 : -1;
      if(next >= 0) { event.preventDefault(); activate(tabs[next]); tabs[next].focus(); }
    });
  });
}

function allPrerequisites(startId: string) {
  const result: GraphEdge[] = [];
  const seen = new Set<string>([startId]);
  const queue = [startId];
  while (queue.length) {
    const current = queue.shift()!;
    for (const edge of data.edges.filter((item) => item.type === "requires" && item.source === current)) {
      if (!seen.has(edge.target)) {
        seen.add(edge.target);
        result.push(edge);
        queue.push(edge.target);
      }
    }
  }
  return result;
}

function bindControls() {
  $$<HTMLButtonElement>("[data-view-button]").forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.viewButton as ViewMode));
  });
  $$<HTMLButtonElement>("[data-domain-filter]").forEach((button) => {
    button.addEventListener("click", (event) => {
      const domainId = button.dataset.domainFilter!;
      if (event.altKey || event.metaKey) enabledDomains = new Set([domainId]);
      else if (enabledDomains.has(domainId)) {
        if (enabledDomains.size === 1) {
          announcer.textContent = "至少需要保留一个能力领域";
          return;
        }
        enabledDomains.delete(domainId);
      } else enabledDomains.add(domainId);
      $$<HTMLButtonElement>("[data-domain-filter]").forEach((item) => item.setAttribute("aria-pressed", String(enabledDomains.has(item.dataset.domainFilter!))));
      graphRenderer.setEnabledDomains(enabledDomains);
    });
  });
  $("#reset-view")!.addEventListener("click", () => graphRenderer.resetView());
  $("#detail-close")!.addEventListener("click", () => selectNode(null));
  $("#detail-back")!.addEventListener("click", () => {
    const previous = nodeHistory.pop();
    if (previous) selectNode(previous, false);
  });
  $("#show-prerequisites")!.addEventListener("click", () => {
    if (!selectedNode) return;
    const edges = allPrerequisites(selectedNode.id);
    const container = $("#detail-relations")!;
    const previous = container.querySelector(".full-chain");
    previous?.remove();
    const group = renderRelationGroup("完整前置链", edges, selectedNode.id, (edge) => `前置于 ${edge.source}`);
    if (group) {
      group.classList.add("full-chain");
      container.prepend(group);
      announcer.textContent = `已展开 ${edges.length} 项前置能力`;
    } else announcer.textContent = "该能力当前没有已记录的前置能力";
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && selectedNode) selectNode(null);
  });
  canvas.addEventListener("keydown", (event) => {
    if (!["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Enter"].includes(event.key)) return;
    event.preventDefault();
    const visibleNodes = data.nodes.filter((node) => enabledDomains.has(node.domain_id));
    const currentIndex = selectedNode ? visibleNodes.findIndex((node) => node.id === selectedNode!.id) : -1;
    if (event.key === "Enter" && selectedNode) return;
    const direction = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
    const nextIndex = (currentIndex + direction + visibleNodes.length) % visibleNodes.length;
    selectNode(visibleNodes[nextIndex].id, Boolean(selectedNode));
  });
}

function buildAccessibleIndex() {
  const list = $("#node-index-list")!;
  const search = $("#node-search") as HTMLInputElement;
  const status = $("#node-search-status")!;
  const render = (query = "") => {
    const normalized = query.trim().toLowerCase();
    const matches = data.nodes.filter((node) => !normalized || node.name.toLowerCase().includes(normalized) || node.id.toLowerCase().includes(normalized));
    list.replaceChildren(...matches.map((node) => {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.innerHTML = `<span>${node.name}</span><small>${node.id} · ${node.subdomain_name}</small>`;
      button.addEventListener("click", () => {
        selectNode(node.id, Boolean(selectedNode));
        const accessibleIndex = $("#accessible-index") as HTMLDetailsElement | null;
        if (accessibleIndex) accessibleIndex.open = false;
        details.querySelector<HTMLElement>(".detail-close")?.focus();
      });
      item.append(button);
      return item;
    }));
    status.textContent = `${matches.length} 项能力`;
  };
  search.addEventListener("input", () => render(search.value));
  render();
}

function handleHover(node: GraphNode | null, point?: { x: number; y: number }) {
  if (!node || !point) {
    tooltip.hidden = true;
    return;
  }
  const domain = data.domains.find((item) => item.id === node.domain_id)!;
  tooltip.querySelector<HTMLElement>(".tooltip-domain")!.textContent = `${domain.name} · ${node.subdomain_name}`;
  tooltip.querySelector<HTMLElement>(".tooltip-name")!.textContent = node.name;
  tooltip.querySelector<HTMLElement>(".tooltip-definition")!.textContent = node.definition;
  tooltip.style.left = `${Math.min(point.x + 18, window.innerWidth - 300)}px`;
  tooltip.style.top = `${Math.min(point.y + 18, window.innerHeight - 170)}px`;
  tooltip.hidden = false;
}

function updateLabels(positions: Array<{ id: string; x: number; y: number; visible: boolean }>) {
  const occupied: Array<{x:number;y:number;w:number;h:number}> = [];
  const width=stage.clientWidth;
  positions.forEach(position => {
    const nodeId=position.id.startsWith('node:')?position.id.slice(5):null;
    const label=$<HTMLElement>(nodeId?`[data-node-label="${nodeId}"]`:`[data-domain-label="${position.id}"]`);
    if(!label) return;
    const domainId=nodeId?nodeById().get(nodeId)?.domain_id:position.id;
    label.hidden=!position.visible||!domainId||!enabledDomains.has(domainId);
    if(label.hidden) return;
    const w=label.offsetWidth,h=label.offsetHeight;
    const x=Math.max(8,Math.min(width-w-8,position.x+(nodeId?12:-w/2)));
    let y=position.y+(nodeId?-h/2:18);
    const collides=()=>occupied.some(r=>x<r.x+r.w+5&&x+w+5>r.x&&y<r.y+r.h+4&&y+h+4>r.y);
    if(collides()) y+=h+5;
    if(collides()) y-=2*(h+5);
    if(collides() && nodeId!==selectedNode?.id) {label.hidden=true;return;}
    label.style.translate='none';
    label.style.transform=`translate3d(${x}px,${y}px,0)`;
    occupied.push({x,y,w,h});
  });
}

async function initialize() {
  try {
    const response = await fetch("/data/graph.json", { cache: "no-cache" });
    if (!response.ok) throw new Error(`Graph request failed: ${response.status}`);
    data = await response.json() as GraphData;
    enabledDomains = new Set(data.domains.map((domain) => domain.id));
    bindTabs();
    buildAccessibleIndex();
    const callbacks = {
      onHover: handleHover,
      onSelect: (node: GraphNode | null) => selectNode(node?.id ?? null, Boolean(node && selectedNode)),
      onLabels: updateLabels,
    };
    try {
      graphRenderer = new GraphRenderer(canvas, data, callbacks);
    } catch (webglError) {
      console.warn("WebGL unavailable, using Canvas 2D compatibility mode.", webglError);
      graphRenderer = new CanvasFallbackRenderer(canvas, data, callbacks);
      compatibilityMode = true;
      const terrainButton = $<HTMLButtonElement>("[data-view-button=terrain]")!;
      terrainButton.disabled = true;
      terrainButton.title = "当前设备使用星图兼容模式";
      terrainButton.setAttribute("aria-label", "地形视图不可用，当前设备使用星图兼容模式");
      announcer.textContent = "当前设备使用星图兼容模式";
    }
    bindControls();
    const url = new URL(window.location.href);
    const requestedView = !compatibilityMode && url.searchParams.get("view") === "terrain" ? "terrain" : "star";
    setView(requestedView, true);
    const requestedNode = url.searchParams.get("node");
    if (requestedNode && nodeById().has(requestedNode)) selectNode(requestedNode);
    loading.classList.add("is-complete");
    window.setTimeout(() => loading.setAttribute("hidden", ""), 450);
  } catch (error) {
    console.error(error);
    loading.setAttribute("hidden", "");
    errorState.hidden = false;
  }
}

$("#retry-graph")?.addEventListener("click", () => window.location.reload());
initialize();
