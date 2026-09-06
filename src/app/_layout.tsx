import { Stack } from "expo-router";
import { useEffect } from "react";

import { StoreProvider } from "@/store/provider";
import { useAppDispatch } from "@/store/hooks";
import { initializeApp } from "@/store/bootstrap";

function AppBootstrap() {
  const dispatch = useAppDispatch();
  useEffect(() => { void dispatch(initializeApp()); }, [dispatch]);
  return <Stack />;
}

export default function RootLayout() {
  return (
    <StoreProvider>
      <AppBootstrap />
    </StoreProvider>
  );
}
