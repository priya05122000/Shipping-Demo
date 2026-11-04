import type { Section } from "@/shared/diagram";

/**
 * Every drawing the viewer can show, in menu order. To add one, create a folder here holding
 * index.ts (exporting `defineSection({...})`), diagram.ts, data.json, Icon.tsx and line-diagram.png,
 * then list it here.
 */
export const sections: Section[] = [];

export function findSection(id: string): Section | undefined {
  return sections.find((section) => section.id === id);
}
