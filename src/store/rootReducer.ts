import { combineReducers } from "redux";

import { appReducer } from "./app";
import { tasksReducer } from "./tasks";

export const rootReducer = combineReducers({ app: appReducer, tasks: tasksReducer });
