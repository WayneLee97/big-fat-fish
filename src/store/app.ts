import type { AnyAction } from "redux";

export interface AppState {
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  pendingMilestone: import("@/services/calendar/schoolMilestone").SchoolMilestone | null;
}

const initialState: AppState = { status: "idle", error: null, pendingMilestone: null };

export function appReducer(state = initialState, action: AnyAction): AppState {
  switch (action.type) {
    case "app/initializing": return { ...state, status: "loading", error: null };
    case "app/ready": return { ...state, status: "ready", error: null };
    case "app/milestonePrompt": return { ...state, pendingMilestone: action.payload };
    case "app/milestoneDismissed": return { ...state, pendingMilestone: null };
    case "app/failed": return { ...state, status: "error", error: action.payload };
    default: return state;
  }
}
