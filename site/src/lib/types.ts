export type ViewMode = "star" | "terrain";
export type RelationshipType = "requires" | "supports" | "related_to";

export interface GraphMeta {
  project: string;
  graph_version: string;
  released_at: string;
  status: string;
  layout_version: string;
  counts: Record<string, number>;
  notice: string;
}

export interface GraphDomain {
  id: string;
  name: string;
  definition: string;
  color: string;
  marker: string;
  subdomains: Array<{ id: string; name: string; definition: string }>;
}

export interface GraphNode {
  id: string;
  name: string;
  domain_id: string;
  subdomain_id: string;
  subdomain_name: string;
  definition: string;
  boundaries: string[];
  observable_behaviors: string[];
  proficiency: Record<"E1" | "E2" | "E3" | "E4", string>;
  evidence: { strong: string[]; weak: string[]; cautions: string[] };
  life_account_links: Array<{ account: string; relation: string; rationale: string }>;
  sources: Array<{ type: string; citation: string; url?: string }>;
  change_log: Array<{ version: string; date: string; summary: string }>;
  status: string;
  version: string;
  claim_status: string;
  metrics: { total_incident: number };
  star_position: [number, number, number];
  terrain_position: [number, number, number];
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: RelationshipType;
  rationale: string;
}

export interface GraphData {
  meta: GraphMeta;
  domains: GraphDomain[];
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface DomainScreenPosition {
  id: string;
  x: number;
  y: number;
  visible: boolean;
}
