/**
 * Корневой layout: стек навигации с собственными шапками экранов (DESIGN.md
 * §4 — шапки рисуют экраны) и загрузка шрифтов Unbounded/Manrope (§10 —
 * решение этапа реализации: официальные пакеты Expo Google Fonts + expo-font).
 */
import { useCallback, useEffect } from "react";
import { AppState } from "react-native";
import { router, Stack, SplashScreen } from "expo-router";
import { useFonts } from "expo-font";
import { Unbounded_500Medium, Unbounded_600SemiBold, Unbounded_700Bold } from "@expo-google-fonts/unbounded";
import { Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold } from "@expo-google-fonts/manrope";
import { getNotificationServices, setupNotifications } from "../features/runtime";
import { useNotificationNavigation } from "../features/useNotificationNavigation";
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

  // Напоминания Stage 4 (§6.7): обработчик показа в foreground настраивается один
  // раз; согласование расписания запускается при старте и при возврате в foreground.
  // Ошибки sync не влияют на UI (§6.9) — проглатываются.
  useEffect(() => {
    setupNotifications();
    const sync = () => {
      getNotificationServices()
        .then((services) => services.syncNotifications())
        .catch(() => undefined);
    };
    sync();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        sync();
      }
    });
    return () => subscription.remove();
  }, []);

  // Навигация по нажатию на уведомление (§6.11, MAJOR-01): переход выполняется
  // только после готовности навигационного дерева (шрифты загружены — Layout
  // отдаёт <Stack>); хук не теряет первоначальный ответ и обрабатывает его
  // однократно. Нажатия при работающем приложении — через подписку. Не создаёт
  // взаимодействий и не меняет интервалы.
  const navReady = Boolean(loaded || error);
  const goHome = useCallback(() => {
    router.push("/");
  }, []);
  useNotificationNavigation(navReady, goHome);

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
