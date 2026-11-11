import { memo } from 'react';
import type { Reading } from '../data/readings';
import { partBox } from '../diagram/partSpecs';
import type { PartDef } from '../diagram/types';
import { STATUS_COLOR, UI } from './theme';

interface Props {
  parts: PartDef[];
  readings: Record<string, Reading>;
  showValues: boolean;
  showTags: boolean;
}

const CHAR_W = 0.6; // monospace advance, in em
const LINE_H = 12.5;

export const Callouts = memo(function Callouts({ parts, readings, showValues, showTags }: Props) {
  if (!showValues && !showTags) return null;
  return (
    <g className="callouts font-mono" pointerEvents="none">
      {parts.map((part) => {
        const reading = readings[part.tag];
        const lines: { text: string; color: string; size: number; weight: number }[] = [];
        if (showTags) lines.push({ text: part.tag, color: UI.ink, size: 9.5, weight: 500 });
        if (showValues && reading) lines.push({ text: reading.value, color: STATUS_COLOR[reading.status], size: 10.5, weight: 700 });
        if (!lines.length) return null;

        const w = Math.max(...lines.map((l) => l.text.length * l.size * CHAR_W)) + 10;
        const h = lines.length * LINE_H + 5;
        const box = partBox(part);
        const cx = (box.x0 + box.x1) / 2;
        const cy = (box.y0 + box.y1) / 2;
        const pos = {
          top: [cx - w / 2, box.y0 - 5 - h],
          bottom: [cx - w / 2, box.y1 + 5],
          left: [box.x0 - 7 - w, cy - h / 2],
          right: [box.x1 + 7, cy - h / 2],
        }[part.label];
        const [x, y] = pos;
        const accent = reading ? STATUS_COLOR[reading.status] : STATUS_COLOR.idle;
        return (
          <g key={part.tag}>
            <rect x={x} y={y} width={w} height={h} rx={3} fill={UI.panel} fillOpacity={0.9} stroke={accent} strokeOpacity={0.5} strokeWidth={0.8} />
            {lines.map((l, i) => (
              <text
                key={i}
                x={x + w / 2}
                y={y + 2.5 + LINE_H * (i + 1) - 3}
                textAnchor="middle"
                fontSize={l.size}
                fontWeight={l.weight}
                fill={l.color}
              >
                {l.text}
              </text>
            ))}
          </g>
        );
      })}
    </g>
  );
});
