import { memo, useRef, useState, type CSSProperties } from 'react';
import type { Crossing } from '../diagram/crossings';
import type { Pt } from '../diagram/types';
import { FRONT_SPEED, type FlowRun } from '../operations/flow';
import { FLUID_STYLE, SHADE, pipeWidth } from './theme';

/** The moving streaks while it flows: their pattern, and how long it takes to move one pattern on. */
const STREAKS = { dash: 6, gap: 16, seconds: 0.7 };

const pathD = (pts: Pt[]) => `M${pts.map((p) => p.join(',')).join('L')}`;
const pathLength = (pts: Pt[]) => pts.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);

/**
 * The flowing pipes in 2D: a lighter core that runs along each pipe from the source, as the fuel
 * reaches it, then streaks moving the way the fuel goes. Pipes that pass under another are cut the same way.
 */
export const FlowLines = memo(function FlowLines({ runs, crossings }: { runs: FlowRun[]; crossings: Crossing[] }) {
  const under = new Set(crossings.map((c) => c.under.id));
  // When the flow started, so runs keep their place in the front however late they mount.
  const started = useRef<number | null>(null);
  if (!runs.length) started.current = null;
  else started.current ??= performance.now() / 1000;

  return (
    <g pointerEvents="none">
      {runs.map((run) => (
        <FlowRunPath key={run.id} run={run} started={started.current!} masked={under.has(run.pipe.id)} />
      ))}
    </g>
  );
});

function FlowRunPath({ run, started, masked }: { run: FlowRun; started: number; masked: boolean }) {
  const [mounted] = useState(() => performance.now() / 1000);
  const len = pathLength(run.pts);
  // The front reaches the run's start run.start / FRONT_SPEED after the flow started; a run that appears later starts filling at once.
  const delay = Math.max(0, started + run.start / FRONT_SPEED - mounted);
  const fill = len / FRONT_SPEED;
  const w = pipeWidth(run.pipe);
  const d = pathD(run.pts);
  const body = (
    <>
      <path
        className="flow-anim"
        d={d}
        fill="none"
        stroke={FLUID_STYLE[run.pipe.fluid].liquidHi}
        strokeWidth={w * 0.34}
        strokeDasharray={`${len} ${len}`}
        style={{ '--flow-len': `${len}px`, animation: `flow-fill ${fill}s linear ${delay}s both` } as CSSProperties}
      />
      <path
        className="flow-anim"
        d={d}
        fill="none"
        stroke={SHADE.shine}
        strokeWidth={w * 0.16}
        strokeLinecap="round"
        strokeDasharray={`${STREAKS.dash} ${STREAKS.gap}`}
        opacity={0.75}
        style={
          {
            '--flow-step': `${STREAKS.dash + STREAKS.gap}px`,
            animation: `flow-show 0.3s ease ${delay + fill}s both, flow-move ${STREAKS.seconds}s linear infinite`,
          } as CSSProperties
        }
      />
    </>
  );
  // Cut where the pipe passes under another, with the mask GlassPipes made for it.
  return masked ? <g mask={`url(#cut-${run.pipe.id})`}>{body}</g> : <g>{body}</g>;
}
