import type { Section } from "@/shared/diagram";
import { DocumentIcon, EmptyState } from "@/shared/ui";

/** The section's manual (PDF), in the browser's PDF viewer. */
export function ManualView({ section }: { section: Section }) {
  if (!section.manual) {
    return (
      <EmptyState icon={<DocumentIcon className="size-6" />} title="No manual yet">
        Add one to {section.title} in the Library.
      </EmptyState>
    );
  }
  return <iframe src={section.manual} title={`${section.title} manual`} className="block size-full" />;
}
