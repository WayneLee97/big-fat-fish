export type TaskKind = "normal" | "leave" | "school_milestone";
export type LeavePeriod = 0 | 1 | 2;
export type RecurrencePreset = "none" | "daily" | "weekly" | "monthly" | "monthEnd";

export interface TaskOccurrence {
  id: string;
  kind: TaskKind;
  content: string;
  eventAt: number;
  eventDate: string;
  timezone: string;
  notifyEnabled: boolean;
  remindAt: number | null;
  notificationId: string | null;
  images: string[];
  recordings: string[];
  completionSupported: boolean;
  completed: boolean;
  completedAt: number | null;
  studentName: string | null;
  leaveDate: string | null;
  leavePeriod: LeavePeriod | null;
  status: "active" | "cancelled";
  recurrenceRule: string | null;
  recurrenceGroupId: string | null;
  createdAt: number;
  updatedAt: number;
  version: number;
}

export type CreateTaskInput = Pick<
  TaskOccurrence,
  | "kind"
  | "content"
  | "eventAt"
  | "eventDate"
  | "notifyEnabled"
  | "remindAt"
  | "images"
  | "recordings"
  | "completionSupported"
  | "studentName"
  | "leaveDate"
  | "leavePeriod"
  | "recurrenceRule"
  | "recurrenceGroupId"
>;

export type UpdateTaskInput = Partial<
  Pick<
    TaskOccurrence,
    | "content"
    | "eventAt"
    | "eventDate"
    | "notifyEnabled"
    | "remindAt"
    | "notificationId"
    | "completionSupported"
    | "completed"
    | "completedAt"
    | "studentName"
    | "leaveDate"
    | "leavePeriod"
    | "recurrenceRule"
    | "status"
  >
>;
