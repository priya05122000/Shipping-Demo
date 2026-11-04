export type ViewMode = "2d" | "3d";

export interface ViewerState {
  sectionId: string;
  selectedItemId: string | null;
  view: ViewMode;
}

export type ViewerAction =
  | { type: "open-section"; sectionId: string }
  | { type: "select-item"; itemId: string | null }
  | { type: "set-view"; view: ViewMode };

export function initialViewerState(sectionId: string): ViewerState {
  return { sectionId, selectedItemId: null, view: "2d" };
}

export function viewerReducer(state: ViewerState, action: ViewerAction): ViewerState {
  switch (action.type) {
    case "open-section":
      // A selection belongs to one drawing, so switching drawings clears it.
      return action.sectionId === state.sectionId ? state : { ...state, sectionId: action.sectionId, selectedItemId: null };
    case "select-item":
      return { ...state, selectedItemId: action.itemId };
    case "set-view":
      return { ...state, view: action.view };
  }
}
