import { Stack } from "expo-router";
import { useEffect } from "react";

import { StoreProvider } from "@/store/provider";
import { useAppDispatch } from "@/store/hooks";
import { initializeApp } from "@/store/bootstrap";

function AppBootstrap() {
  const dispatch = useAppDispatch();
  useEffect(() => { void dispatch(initializeApp()); }, [dispatch]);
  return <Stack screenOptions={{ headerTintColor: "#40574f", headerStyle: { backgroundColor: "#fffdf8" }, headerShadowVisible: false, headerBackTitle: "返回" }}>
    <Stack.Screen name="index" options={{ headerShown: false }} />
    <Stack.Screen name="search" options={{ title: "所有日程" }} />
    <Stack.Screen name="task/new" options={{ title: "新建日程" }} />
    <Stack.Screen name="task/[id]" options={{ title: "日程详情" }} />
  </Stack>;
}

export default function RootLayout() {
  return (
    <StoreProvider>
      <AppBootstrap />
    </StoreProvider>
  );
}
