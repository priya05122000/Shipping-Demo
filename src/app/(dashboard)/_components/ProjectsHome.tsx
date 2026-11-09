"use client";

import { useEffect, useMemo, useState } from "react";
import { projectConfig } from "@/components/records/configs";
import { RecordFormModal } from "@/components/records/RecordFormModal";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { AlertIcon, PlusIcon, SearchIcon, ShipIcon } from "@/components/ui/icons";
import { SearchInput } from "@/components/ui/SearchInput";
import { useToast } from "@/components/ui/Toast";
import { useCollection } from "@/hooks/useCollection";
import { projectStore } from "@/lib/collections";
import type { Project } from "@/types/records";
import { ProjectCard, ProjectCardSkeleton } from "./ProjectCard";

type ModalState = { type: "add" } | { type: "edit" | "delete"; id: string } | null;

const PANEL =
  "overflow-hidden rounded-2xl bg-white shadow-[0_0_0_1px_rgb(15_23_42/0.08),0_2px_4px_rgb(15_23_42/0.06),0_8px_24px_rgb(15_23_42/0.10),0_20px_40px_-12px_rgb(15_23_42/0.20)]";

/** The projects page: one card per ship, and adding, editing and deleting ships. */
export function ProjectsHome() {
  const toast = useToast();
  const { data: snapshot, error: loadError } = useCollection(projectStore);
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState<ModalState>(null);
  const [deleting, setDeleting] = useState(false);

  // Section and object counts change inside a ship's pages, so fetch them afresh on coming back here.
  useEffect(() => {
    void projectStore.reload();
  }, []);

  const items = snapshot?.items;
  // Newest first (items are stored in creation order).
  const filtered = useMemo(() => {
    const list = [...(items ?? [])].reverse();
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((p) => [p.name, p.id, p.imoNumber ?? "", p.vesselType ?? ""].some((v) => v.toLowerCase().includes(q)));
  }, [items, query]);

  // Look ships up by ID from the live list so dialogs reflect the latest data.
  const active = modal && modal.type !== "add" ? items?.find((p) => p.id === modal.id) : undefined;
  const close = () => setModal(null);

  function handleSaved(project: Project, mode: "add" | "edit") {
    close();
    if (mode === "add") setQuery("");
    toast.success(mode === "add" ? "Ship added" : "Ship updated", `${project.id} · ${project.name}`);
  }

  async function handleDelete() {
    if (!active || deleting) return;
    const target = active;
    setDeleting(true);
    try {
      await projectStore.remove(target.id);
      toast.success("Ship deleted", `${target.id} · ${target.name}`);
      close();
    } catch (error) {
      toast.error("Couldn't delete ship", error instanceof Error ? error.message : undefined);
    } finally {
      setDeleting(false);
    }
  }

  const addButton = (
    <Button onClick={() => setModal({ type: "add" })} disabled={!snapshot}>
      <PlusIcon className="size-4" /> New ship
    </Button>
  );

  return (
    <section aria-labelledby="projects-heading">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 id="projects-heading" className="text-xl font-semibold tracking-tight text-slate-950">
            Ships
            {snapshot && (
              <span className="ml-2 rounded-full bg-white px-2 py-0.5 align-middle text-xs font-medium text-slate-500 tabular-nums ring-1 ring-slate-200 ring-inset">
                {snapshot.items.length}
              </span>
            )}
          </h1>
          <p className="mt-1 text-sm text-slate-500">Each ship is a project with its own sections, objects and manuals.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <SearchInput
            value={query}
            onChange={setQuery}
            label="Search ships"
            placeholder="Search by name, ID, IMO or type…"
          />
          {addButton}
        </div>
      </div>

      <div className="mt-6">
        {!snapshot && loadError ? (
          <div className={PANEL}>
            <EmptyState
              icon={<AlertIcon className="size-6 text-red-500" />}
              title="Couldn't load ships"
              description={loadError}
              action={
                <Button variant="secondary" onClick={() => void projectStore.reload()}>
                  Try again
                </Button>
              }
            />
          </div>
        ) : !snapshot ? (
          <ProjectGridSkeleton />
        ) : snapshot.items.length === 0 ? (
          <div className={PANEL}>
            <EmptyState
              icon={<ShipIcon className="size-6" />}
              title="No ships yet"
              description="Add your first ship to get started. Each one gets its own folder in the child app."
              action={addButton}
            />
          </div>
        ) : filtered.length === 0 ? (
          <div className={PANEL}>
            <EmptyState
              icon={<SearchIcon className="size-6" />}
              title="No matching ships"
              description={`No ships match “${query.trim()}”. Try a different name, ID or IMO number.`}
              action={
                <Button variant="secondary" onClick={() => setQuery("")}>
                  Clear search
                </Button>
              }
            />
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onEdit={() => setModal({ type: "edit", id: project.id })}
                onDelete={() => setModal({ type: "delete", id: project.id })}
              />
            ))}
          </ul>
        )}
      </div>

      {modal?.type === "add" && <RecordFormModal config={projectConfig} onClose={close} onSaved={handleSaved} />}
      {modal?.type === "edit" && active && (
        <RecordFormModal config={projectConfig} record={active} onClose={close} onSaved={handleSaved} />
      )}
      <ConfirmDialog
        open={modal?.type === "delete" && Boolean(active)}
        title="Delete ship?"
        message={
          active && (
            <>
              <span className="font-medium text-slate-900">
                {active.id} · {active.name}
              </span>{" "}
              {projectConfig.deleteWarning(active)} This can&apos;t be undone.
            </>
          )
        }
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={close}
      />
    </section>
  );
}

export function ProjectGridSkeleton() {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Loading ships">
      {Array.from({ length: 3 }, (_, i) => (
        <ProjectCardSkeleton key={i} />
      ))}
    </ul>
  );
}
