export interface CortexNode {
  id: string;
  name: string;
  type: string;
  category: string;
  riskScore: number;
  description: string;
  details: Record<string, string | number>;
  baseX?: number;
  baseY?: number;
}

export const CORTEX_NODES: CortexNode[] = [];
export const CORTEX_EDGES: any[] = [];
