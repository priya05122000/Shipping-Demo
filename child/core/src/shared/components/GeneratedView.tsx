import { Component, Suspense, type ReactNode } from "react";
import type { SectionView, SectionViewProps } from "../diagram";
import { EmptyState } from "../ui";

interface GeneratedViewProps extends SectionViewProps {
  /** The section's generated view (a lazy component from src/sections). */
  view: SectionView;
  /** E.g. "2D", for messages. */
  label: string;
  icon: ReactNode;
}

/**
 * Shows one of a section's generated views (Diagram2D.tsx or Diagram3D.tsx), loading it on first use. The code is
 * generated with AI and can change while it's being written, so an error in it shows a message instead of breaking
 * the viewer.
 */
export function GeneratedView({ view: View, label, icon, ...props }: GeneratedViewProps) {
  return (
    <ViewBoundary view={View} label={label} icon={icon}>
      <Suspense
        fallback={
          <div role="status" className="flex h-full items-center justify-center text-sm text-slate-500">
            Loading the {label} view…
          </div>
        }
      >
        <View {...props} />
      </Suspense>
    </ViewBoundary>
  );
}

interface ViewBoundaryProps {
  view: SectionView;
  label: string;
  icon: ReactNode;
  children: ReactNode;
}

class ViewBoundary extends Component<ViewBoundaryProps, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidUpdate(previous: ViewBoundaryProps) {
    // A new version of the view (e.g. regenerated) gets a fresh try.
    if (previous.view !== this.props.view && this.state.error) this.setState({ error: null });
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <EmptyState icon={this.props.icon} title={`The generated ${this.props.label} view couldn't be shown`}>
        <span className="block break-words">{error.message}</span>
        <button
          type="button"
          onClick={() => this.setState({ error: null })}
          className="mt-3 rounded-md px-2 py-1 text-xs font-medium text-accent-600 hover:bg-accent-50 focus-visible:outline-2 focus-visible:outline-accent-600"
        >
          Try again
        </button>
      </EmptyState>
    );
  }
}
