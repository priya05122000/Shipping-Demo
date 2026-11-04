import loader from "@monaco-editor/loader";
import type * as MonacoApi from "monaco-editor";

export type Monaco = typeof MonacoApi;

/** Copied from node_modules on install (scripts/copy-monaco.mjs), so the editor loads from this server, not a CDN. */
const MONACO_PATH = "/monaco/vs";

let loading: Promise<Monaco> | null = null;

/** Loads Monaco in the browser, once, set up for the child app's code. */
export function loadMonaco(): Promise<Monaco> {
  if (!loading) {
    loader.config({ paths: { vs: MONACO_PATH } });
    loading = (loader.init() as unknown as Promise<Monaco>).then(
      (monaco) => {
        configure(monaco);
        return monaco;
      },
      () => {
        throw new Error(
          "Couldn't load the code editor. Run `npm install` (it copies the editor to public/monaco), then reload the page.",
        );
      },
    );
  }
  return loading;
}

function configure(monaco: Monaco) {
  const { typescript } = monaco;
  for (const defaults of [typescript.typescriptDefaults, typescript.javascriptDefaults]) {
    defaults.setCompilerOptions({
      ...defaults.getCompilerOptions(),
      target: typescript.ScriptTarget.ESNext,
      module: typescript.ModuleKind.ESNext,
      jsx: typescript.JsxEmit.ReactJSX,
      allowNonTsExtensions: true,
    });
    // The editor can't see the child's node_modules or path aliases, so every import would be a type error.
    // Keep syntax errors only; the child's own build (`tsc -b`) does the real type check.
    defaults.setDiagnosticsOptions({ noSemanticValidation: true, noSyntaxValidation: false });
  }
}
