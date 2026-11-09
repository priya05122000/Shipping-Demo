"use client";

import { useEffect, useMemo, useState } from "react";
import { RecordFormModal } from "@/components/records/RecordFormModal";
import { RecordTable, TableSkeleton } from "@/components/records/RecordTable";
import type { ResourceConfig } from "@/components/records/types";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { AlertIcon, PlusIcon, SearchIcon } from "@/components/ui/icons";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";
import { useToast } from "@/components/ui/Toast";
import { useCollection } from "@/hooks/useCollection";
import type { BaseRecord } from "@/types/records";
import { RecordViewModal } from "./RecordViewModal";

const PAGE_SIZE = 10;
/** How often the list is reloaded while `config.refreshWhile` says so. */
const REFRESH_MS = 3000;

type ModalState =
  { type: "add" } | { type: "view" | "edit" | "delete"; id: string } | null;

export function ResourceTab<T extends BaseRecord>({
  config,
}: {
  config: ResourceConfig<T>;
}) {
  const toast = useToast();
  const { data: snapshot, error: loadError } = useCollection(config.store);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<ModalState>(null);
  const [deleting, setDeleting] = useState(false);

  const items = snapshot?.items;

  // E.g. while sections' code is being generated on the server.
  const refreshing = Boolean(items && config.refreshWhile?.(items));
  const { store } = config;
  useEffect(() => {
    if (!refreshing) return;
    const timer = setInterval(() => void store.reload(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [refreshing, store]);

  // Newest first (items are stored in creation order).
  const filtered = useMemo(() => {
    const list = [...(items ?? [])].reverse();
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (r) => r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q),
    );
  }, [items, query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  // Clamp instead of resetting state, e.g. after deleting the last record on the last page.
  const currentPage = Math.min(page, pageCount);
  const pageItems = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  // Look records up by ID from the live list so modals reflect the latest data.
  const active =
    modal && modal.type !== "add"
      ? items?.find((r) => r.id === modal.id)
      : undefined;
  const close = () => setModal(null);

  function handleSaved(record: T, mode: "add" | "edit") {
    close();
    if (mode === "add") {
      setQuery("");
      setPage(1);
    }
    toast.success(
      mode === "add" ? `${config.label} added` : `${config.label} updated`,
      `${record.id} · ${record.name}`,
    );
  }

  async function handleDelete() {
    if (!active || deleting) return;
    const target = active;
    setDeleting(true);
    try {
      await config.store.remove(target.id);
      toast.success(`${config.label} deleted`, `${target.id} · ${target.name}`);
      close();
    } catch (error) {
      toast.error(
        `Couldn't delete ${config.singular}`,
        error instanceof Error ? error.message : undefined,
      );
    } finally {
      setDeleting(false);
    }
  }

  const Icon = config.icon;
  const addButton = (
    <Button onClick={() => setModal({ type: "add" })} disabled={!snapshot}>
      <PlusIcon className="size-4" /> Add {config.label}
    </Button>
  );

  return (
    <section
      aria-labelledby={`${config.id}-heading`}
      className="overflow-hidden rounded-2xl bg-white shadow-[0_0_0_1px_rgb(15_23_42/0.08),0_2px_4px_rgb(15_23_42/0.06),0_8px_24px_rgb(15_23_42/0.10),0_20px_40px_-12px_rgb(15_23_42/0.20)]"
    >
      <div className="flex flex-col gap-4 border-b border-slate-100 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-linear-to-br from-indigo-500 to-violet-600 text-white shadow-md ring-1 shadow-indigo-500/25 ring-white/20 ring-inset">
            <Icon className="size-5" />
          </div>
          <h2
            id={`${config.id}-heading`}
            className="text-lg font-semibold tracking-tight text-slate-950"
          >
            {config.label}s
            {snapshot && (
              <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 align-middle text-xs font-medium text-slate-500 tabular-nums ring-1 ring-slate-200/70 ring-inset">
                {snapshot.items.length}
              </span>
            )}
          </h2>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <SearchInput
            value={query}
            onChange={(value) => {
              setQuery(value);
              setPage(1);
            }}
            label={`Search ${config.singular}s`}
            placeholder="Search by name or ID…"
          />
          {addButton}
        </div>
      </div>

      {!snapshot && loadError ? (
        <EmptyState
          icon={<AlertIcon className="size-6 text-red-500" />}
          title={`Couldn't load ${config.singular}s`}
          description={loadError}
          action={
            <Button
              variant="secondary"
              onClick={() => void config.store.reload()}
            >
              Try again
            </Button>
          }
        />
      ) : !snapshot ? (
        <TableSkeleton />
      ) : snapshot.items.length === 0 ? (
        <EmptyState
          icon={<Icon className="size-6" />}
          title={`No ${config.singular}s yet`}
          description={`Add your first ${config.singular} to get started. Files are saved in the child app's folder.`}
          action={addButton}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<SearchIcon className="size-6" />}
          title="No matching records"
          description={`No ${config.singular}s match “${query.trim()}”. Try a different name or ID.`}
          action={
            <Button variant="secondary" onClick={() => setQuery("")}>
              Clear search
            </Button>
          }
        />
      ) : (
        <>
          <RecordTable
            records={pageItems}
            columns={config.columns}
            singular={config.singular}
            onView={(r) => setModal({ type: "view", id: r.id })}
            onEdit={(r) => setModal({ type: "edit", id: r.id })}
            onDelete={(r) => setModal({ type: "delete", id: r.id })}
          />
          <Pagination
            page={currentPage}
            pageSize={PAGE_SIZE}
            total={filtered.length}
            onPageChange={setPage}
          />
        </>
      )}

      {modal?.type === "add" && (
        <RecordFormModal
          config={config}
          onClose={close}
          onSaved={handleSaved}
        />
      )}
      {modal?.type === "edit" && active && (
        <RecordFormModal
          config={config}
          record={active}
          onClose={close}
          onSaved={handleSaved}
        />
      )}
      {modal?.type === "view" && active && (
        <RecordViewModal
          config={config}
          record={active}
          onClose={close}
          onEdit={() => setModal({ type: "edit", id: active.id })}
          onDelete={() => setModal({ type: "delete", id: active.id })}
        />
      )}
      <ConfirmDialog
        open={modal?.type === "delete" && Boolean(active)}
        title={`Delete ${config.singular}?`}
        message={
          active && (
            <>
              <span className="font-medium text-slate-900">
                {active.id} · {active.name}
              </span>{" "}
              {config.deleteWarning(active)} This can&apos;t be undone.
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
