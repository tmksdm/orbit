/**
 * Корневой layout: стек навигации с собственными шапками экранов (DESIGN.md
 * §4 — шапки рисуют экраны) и загрузка шрифтов Unbounded/Manrope (§10 —
 * решение этапа реализации: официальные пакеты Expo Google Fonts + expo-font).
 */
import { useEffect } from "react";
import { Stack, SplashScreen } from "expo-router";
import { useFonts } from "expo-font";
import { Unbounded_500Medium, Unbounded_600SemiBold, Unbounded_700Bold } from "@expo-google-fonts/unbounded";
import { Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold } from "@expo-google-fonts/manrope";
import { colors } from "../ui/tokens";

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Unbounded_500Medium,
    Unbounded_600SemiBold,
    Unbounded_700Bold,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
  });

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [loaded, error]);

  if (!loaded && !error) {
    return null;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    />
  );
}
