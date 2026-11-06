"use client";

import type { ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { projectConfigs } from "@/components/records/configs";
import type { TabId } from "@/components/records/types";
import { Tabs, type TabItem } from "@/components/ui/Tabs";
import { ToastProvider } from "@/components/ui/Toast";
import { useCollection } from "@/hooks/useCollection";
import { useProject } from "./ProjectWorkspace";
import { ResourceTab } from "./ResourceTab";

const TAB_IDS: TabId[] = ["sections", "objects"];

function isTabId(value: string | null): value is TabId {
  return TAB_IDS.includes(value as TabId);
}

/** One ship's Library: its sections and objects. Inside ProjectWorkspace. */
export function ProjectLibrary() {
  const { sections: sectionConfig, objects: objectConfig } = projectConfigs(useProject());
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab: TabId = isTabId(tabParam) ? tabParam : "sections";

  const sections = useCollection(sectionConfig.store).data;
  const objects = useCollection(objectConfig.store).data;

  const tabs: TabItem<TabId>[] = [
    { id: "sections", label: sectionConfig.label, icon: sectionConfig.icon, count: sections?.items.length },
    { id: "objects", label: objectConfig.label, icon: objectConfig.icon, count: objects?.items.length },
  ];

  function selectTab(id: TabId) {
    // Native history updates sync with useSearchParams without a server round trip.
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", id);
    window.history.replaceState(null, "", `?${params.toString()}`);
  }

  return (
    <ToastProvider>
      <Tabs tabs={tabs} activeId={activeTab} onChange={selectTab} />
      {/* Panels stay mounted so each tab keeps its search and page while hidden. */}
      <div className="mt-6">
        <TabPanel id="sections" active={activeTab}>
          <ResourceTab config={sectionConfig} />
        </TabPanel>
        <TabPanel id="objects" active={activeTab}>
          <ResourceTab config={objectConfig} />
        </TabPanel>
      </div>
    </ToastProvider>
  );
}

function TabPanel({ id, active, children }: { id: TabId; active: TabId; children: ReactNode }) {
  return (
    <div role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`} hidden={id !== active}>
      {children}
    </div>
  );
}
