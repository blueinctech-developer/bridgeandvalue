export type ExtractedBlock = { element_id: string; widget_type: string; position: number; label: string; original: Record<string, unknown> };
export function extractBlocks(html: string): { page: ExtractedBlock[]; global: ExtractedBlock[] };
export function sanitizeHtml(html: string): string;
export function renderHtml(
  html: string,
  o: {
    pageBlocks: { element_id: string; widget_type: string; content: unknown }[];
    globalBlocks: { element_id: string; widget_type: string; content: unknown }[];
    menu?: { label: string; url: string; new_tab: boolean }[];
    altByPath?: Map<string, string>;
    currentPath?: string;
  }
): string;
export function spliceElement(html: string, marker: string, fn: (fragment: string) => string): string;
