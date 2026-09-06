import type { TaskOccurrence } from "@/data/task";
import { createTask, createRecurringTasks, queryTasks, updateTask } from "@/data/taskRepository";
import type { CreateTaskInput, UpdateTaskInput } from "@/data/task";
import { scheduleTaskNotification, cancelTaskNotification } from "@/services/notifications/notificationService";

export interface TasksState {
  items: TaskOccurrence[];
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
}

const initialState: TasksState = { items: [], status: "idle", error: null };

export function tasksReducer(state = initialState, action: { type: string; payload?: unknown }): TasksState {
  switch (action.type) {
    case "tasks/loading": return { ...state, status: "loading", error: null };
    case "tasks/loaded": return { items: action.payload as TaskOccurrence[], status: "ready", error: null };
    case "tasks/failed": return { ...state, status: "error", error: String(action.payload ?? "事务加载失败") };
    default: return state;
  }
}

export const loadTasks = (options: { from?: number; to?: number; keyword?: string } = {}) => async (dispatch: (action: { type: string; payload?: unknown }) => void) => {
  dispatch({ type: "tasks/loading" });
  try {
    dispatch({ type: "tasks/loaded", payload: await queryTasks(options) });
  } catch (error) {
    dispatch({ type: "tasks/failed", payload: error instanceof Error ? error.message : "事务加载失败" });
  }
};

export const addTask = (input: CreateTaskInput) => async (dispatch: (action: { type: string; payload?: unknown }) => void) => {
  const task = await createTask(input);
  const notificationId = await scheduleTaskNotification(task);
  if (notificationId) await updateTask(task.id, { notificationId });
  await loadTasks()(dispatch);
};

export const addRecurringTask = (input: CreateTaskInput, until: number) => async (dispatch: (action: { type: string; payload?: unknown }) => void) => {
  const tasks = await createRecurringTasks(input, until);
  for (const task of tasks.slice(0, 64)) {
    const notificationId = await scheduleTaskNotification(task);
    if (notificationId) await updateTask(task.id, { notificationId });
  }
  await loadTasks()(dispatch);
};

export const editTask = (id: string, patch: UpdateTaskInput) => async (dispatch: (action: { type: string; payload?: unknown }) => void) => {
  if (patch.completed === true) { const repository = await import("@/data/taskRepository"); const current = await repository.getTask(id); await cancelTaskNotification(current?.notificationId ?? null); if (current?.content === "通风消毒记录" && current.recurrenceGroupId) await repository.cancelFutureIncomplete(current.recurrenceGroupId, current.eventAt + 1); }
  await updateTask(id, patch);
  await loadTasks()(dispatch);
};

export const removeTask = (id: string) => async (dispatch: (action: { type: string; payload?: unknown }) => void) => {
  const current = await import("@/data/taskRepository").then(({ getTask }) => getTask(id));
  await cancelTaskNotification(current?.notificationId ?? null);
  await import("@/data/taskRepository").then(({ deleteTask }) => deleteTask(id));
  await loadTasks()(dispatch);
};

export const stopRecurringTask = (groupId: string) => async (dispatch: (action: { type: string; payload?: unknown }) => void) => {
  await import("@/data/taskRepository").then(({ cancelFutureIncomplete }) => cancelFutureIncomplete(groupId));
  await loadTasks()(dispatch);
};
