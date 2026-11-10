import type { ViewSwitcherProps } from "../../customization";
import { SegmentedControl } from "../ui";

/** The buttons that switch between a section's views (the ViewSwitcher slot's default). */
export function ViewSwitcher({ options, value, onChange }: ViewSwitcherProps) {
  return <SegmentedControl label="View" ui="view-switcher" options={options} value={value} onChange={onChange} />;
}
