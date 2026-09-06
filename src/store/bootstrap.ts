import { getDatabase } from "@/data/database";
import { ensureMediaDirectories } from "@/services/media/fileStorage";
import { loadTasks } from "./tasks";
import { cleanupOldOperationLogs } from "@/data/operationLog";
import { ensureBuiltinTasks } from "@/data/builtinTasks";
import { findMissingSchoolMilestone } from "@/services/calendar/schoolMilestone";
import { reconcileNotifications } from "@/services/notifications/notificationCoordinator";

export const initializeApp = () => async (dispatch: (action: { type: string; payload?: unknown }) => void) => {
  dispatch({ type: "app/initializing" });
  try {
    await getDatabase();
    await ensureMediaDirectories();
    await ensureBuiltinTasks();
    await loadTasks()(dispatch);
    await cleanupOldOperationLogs();
    dispatch({ type: "app/milestonePrompt", payload: await findMissingSchoolMilestone() });
    await reconcileNotifications();
    dispatch({ type: "app/ready" });
  } catch (error) {
    dispatch({ type: "app/failed", payload: error instanceof Error ? error.message : "本地数据初始化失败" });
  }
};
