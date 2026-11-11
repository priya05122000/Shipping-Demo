import { Component, Suspense, type ComponentType, type ReactNode } from "react";
import type { CustomView, CustomViewProps, Slot } from "../customize/types";
import { DocumentIcon, EmptyState } from "../ui";

/*
 * How the viewer uses a ship's customizations (layer 2, see ../customize/types.ts). A customization is the ship's own
 * code, so one that fails falls back to the viewer's own behaviour, with the error in the console, rather than breaking
 * the viewer.
 */

class Fallback extends Component<{ what: string; fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error(`This ship's ${this.props.what} failed, so the viewer's own is shown instead:`, error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** A slot: the ship's component if it customizes it (given `Default`), else the viewer's own. */
export function Slotted<P extends object>({
  name,
  custom: Custom,
  default: Default,
  props,
}: {
  name: string;
  custom: Slot<P> | undefined;
  default: ComponentType<P>;
  props: P;
}) {
  if (!Custom) return <Default {...props} />;
  return (
    <Fallback what={`${name} component`} fallback={<Default {...props} />}>
      <Custom {...props} Default={Default} />
    </Fallback>
  );
}

/** The view mode of a ship's own view: its ID with a prefix, so it can't take a built-in view's place. */
export function customViewMode(view: CustomView): `custom:${string}` {
  return `custom:${view.id}`;
}

/** A ship's own view of a section, with a message instead if it fails. */
export function CustomViewHost({ view, props }: { view: CustomView; props: CustomViewProps }) {
  const View = view.component;
  return (
    <Fallback
      what={`"${view.label}" view`}
      fallback={<EmptyState icon={<DocumentIcon className="size-6" />} title={`The ${view.label} view couldn't be shown`}>The browser console has the error.</EmptyState>}
    >
      <Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-slate-500">Loading…</div>}>
        <View {...props} />
      </Suspense>
    </Fallback>
  );
}

/** Calls a ship's hook, which mustn't break the viewer: an error is logged, and `fallback` returned. */
export function callHook<T>(name: string, call: () => T, fallback: T): T {
  try {
    return call();
  } catch (error) {
    console.error(`This ship's ${name} hook failed:`, error);
    return fallback;
  }
}
