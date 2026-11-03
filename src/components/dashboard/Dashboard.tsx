"use client";

import type { ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { DashboardFrame } from "@/components/dashboard/DashboardFrame";
import { StorageSummary } from "@/components/dashboard/StorageSummary";
import { Tabs, type TabItem } from "@/components/dashboard/Tabs";
import { lineDiagramConfig, manualConfig, objectConfig } from "@/components/records/configs";
import { ResourceTab } from "@/components/records/ResourceTab";
import type { TabId } from "@/components/records/types";
import { ToastProvider } from "@/components/ui/Toast";
import { useCollection } from "@/hooks/useCollection";

const TAB_IDS: TabId[] = ["line-diagrams", "objects", "manuals"];

function isTabId(value: string | null): value is TabId {
  return TAB_IDS.includes(value as TabId);
}

export function Dashboard() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab: TabId = isTabId(tabParam) ? tabParam : "line-diagrams";

  const lineDiagrams = useCollection(lineDiagramConfig.store).data;
  const objects = useCollection(objectConfig.store).data;
  const manuals = useCollection(manualConfig.store).data;
  const loaded = lineDiagrams && objects && manuals;
  const totalBytes = loaded ? lineDiagrams.totalBytes + objects.totalBytes + manuals.totalBytes : null;

  const tabs: TabItem<TabId>[] = [
    { id: "line-diagrams", label: lineDiagramConfig.label, icon: lineDiagramConfig.icon, count: lineDiagrams?.items.length },
    { id: "objects", label: objectConfig.label, icon: objectConfig.icon, count: objects?.items.length },
    { id: "manuals", label: manualConfig.label, icon: manualConfig.icon, count: manuals?.items.length },
  ];

  function selectTab(id: TabId) {
    // Native history updates sync with useSearchParams without a server round trip.
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", id);
    window.history.replaceState(null, "", `?${params.toString()}`);
  }

  return (
    <ToastProvider>
      <DashboardFrame meter={<StorageSummary totalBytes={totalBytes} />}>
        <Tabs tabs={tabs} activeId={activeTab} onChange={selectTab} />
        {/* Panels stay mounted so each tab keeps its search and page while hidden. */}
        <div className="mt-6">
          <TabPanel id="line-diagrams" active={activeTab}>
            <ResourceTab config={lineDiagramConfig} />
          </TabPanel>
          <TabPanel id="objects" active={activeTab}>
            <ResourceTab config={objectConfig} />
          </TabPanel>
          <TabPanel id="manuals" active={activeTab}>
            <ResourceTab config={manualConfig} />
          </TabPanel>
        </div>
      </DashboardFrame>
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
