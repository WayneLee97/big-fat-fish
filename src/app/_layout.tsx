import { Stack } from "expo-router";

import { StoreProvider } from "@/store/provider";

export default function RootLayout() {
  return (
    <StoreProvider>
      <Stack />
    </StoreProvider>
  );
}
