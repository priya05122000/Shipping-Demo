import type { KeyboardEvent } from "react";
import type { Section } from "../../sections";
import { CATALOG } from "../../sections/catalog";
import { DiagramIcon, EmptyState } from "../../ui";

interface DrawingViewProps {
  section: Section;
  selectedId: string | null;
  /** Called with null when the selection is cleared (background click, or clicking the selected item). */
  onSelect: (itemId: string | null) => void;
}

/**
 * The section's uploaded line diagram (the "Drawing" view, and 2D when it has no generated view) with a hotspot over
 * each item from its diagram.ts. Image and hotspots share one viewBox (the image's pixel size), so they stay aligned at
 * any zoom. Hotspot styles are in styles.css. Without a diagram.ts, the image is shown on its own.
 */
export function DrawingView({ section, selectedId, onSelect }: DrawingViewProps) {
  if (!section.image) {
    return (
      <EmptyState icon={<DiagramIcon className="size-6" />} title="No line diagram yet">
        Add one to {section.title} in the Library.
      </EmptyState>
    );
  }
  if (!section.diagram) {
    return <img src={section.image} alt={`${section.title} line diagram`} className="size-full object-contain" />;
  }

  const { width, height, items } = section.diagram;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-full w-full"
      role="group"
      aria-label={`${section.title} line diagram`}
      onClick={() => onSelect(null)}
    >
      <image href={section.image} width={width} height={height} />
      {items.map((item) => {
        const selected = item.id === selectedId;
        const toggle = () => onSelect(selected ? null : item.id);
        const onKeyDown = (event: KeyboardEvent) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          toggle();
        };
        return (
          <g
            key={item.id}
            className="hotspot"
            role="button"
            tabIndex={0}
            aria-pressed={selected}
            aria-label={`${item.id} · ${item.label} (${CATALOG[item.kind].label})`}
            style={{ color: CATALOG[item.kind].color }}
            onClick={(event) => {
              event.stopPropagation();
              toggle();
            }}
            onKeyDown={onKeyDown}
          >
            <rect x={item.x} y={item.y} width={item.width} height={item.height} rx={6} />
          </g>
        );
      })}
    </svg>
  );
}
