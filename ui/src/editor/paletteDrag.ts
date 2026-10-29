export const nodeTypeDragMime = 'application/x-p-graph-node-type';

export interface NodeTypeDragPayload {
  type: string;
  version: number;
}

export function encodeNodeTypeDrag(payload: NodeTypeDragPayload): string {
  return JSON.stringify(payload);
}

export function decodeNodeTypeDrag(
  value: string,
): NodeTypeDragPayload | null {
  try {
    const parsed = JSON.parse(value) as Partial<NodeTypeDragPayload>;
    if (typeof parsed.type !== 'string' || typeof parsed.version !== 'number') {
      return null;
    }
    return { type: parsed.type, version: parsed.version };
  } catch {
    return null;
  }
}
