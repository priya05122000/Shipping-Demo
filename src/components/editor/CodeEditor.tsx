"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { editor } from "monaco-editor";
import { loadMonaco } from "@/lib/monaco";

const OPTIONS: editor.IStandaloneEditorConstructionOptions = {
  model: null,
  automaticLayout: true,
  // Hovers and suggestions aren't clipped by the rounded card around the editor.
  fixedOverflowWidgets: true,
  fontSize: 13,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  tabSize: 2,
  renderWhitespace: "selection",
  padding: { top: 8 },
};

interface CodeEditorProps {
  /** The file to show. Each open file has its own model, which keeps its text and undo history. */
  model: editor.ITextModel | null;
  /** Called after every edit. */
  onChange: () => void;
}

/** A Monaco editor showing one model at a time. Switching back to a model restores its cursor and scroll position. */
export function CodeEditor({ model, onChange }: CodeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const viewStates = useRef(new WeakMap<editor.ITextModel, editor.ICodeEditorViewState>());
  // Bumped when an editor is created, so the model effect below runs against it.
  const [instance, setInstance] = useState(0);
  const handleChange = useEffectEvent(onChange);

  // Created and disposed in one effect, so the editor is rebuilt when Next shows this page again after hiding it.
  // Models aren't owned by the editor and outlive it, so unsaved edits survive that too.
  useEffect(() => {
    let cancelled = false;
    const states = viewStates.current;
    loadMonaco().then(
      (monaco) => {
        if (cancelled || !containerRef.current) return;
        const created = monaco.editor.create(containerRef.current, OPTIONS);
        created.onDidChangeModelContent(() => handleChange());
        editorRef.current = created;
        setInstance((n) => n + 1);
      },
      () => {}, // The workspace shows why Monaco didn't load.
    );
    return () => {
      cancelled = true;
      const current = editorRef.current;
      editorRef.current = null;
      if (!current) return;
      rememberViewState(current, states);
      current.dispose();
    };
  }, []);

  useEffect(() => {
    const current = editorRef.current;
    if (!current || current.getModel() === model) return;
    rememberViewState(current, viewStates.current);
    current.setModel(model);
    if (!model) return;
    const state = viewStates.current.get(model);
    if (state) current.restoreViewState(state);
    current.focus();
  }, [model, instance]);

  return <div ref={containerRef} className="absolute inset-0" />;
}

function rememberViewState(
  current: editor.IStandaloneCodeEditor,
  states: WeakMap<editor.ITextModel, editor.ICodeEditorViewState>,
) {
  const shown = current.getModel();
  const state = current.saveViewState();
  if (shown && state) states.set(shown, state);
}
