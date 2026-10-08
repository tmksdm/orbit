/**
 * Экран добавления контакта (план Stage 3, F2; DESIGN.md §6.2, поправка 1).
 * Стратегия — обязательный ЯВНЫЙ выбор (решение 3), значения по умолчанию нет;
 * после валидного сохранения — возврат в список (DESIGN.md §7). Бизнес-правил
 * не содержит: создание контакта — use-case/domain. Клавиатура: при открытой
 * клавиатуре футер остаётся видимым за счёт стандартного режима «resize»
 * окна на Android (DESIGN.md §10 — решение этапа реализации).
 */
import { useCallback, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ContactStrategy } from "../domain/types";
import {
  OrbitValidationError,
  type OrbitServices,
} from "../features/orbitServices";
import { getOrbitServices } from "../features/runtime";
import { PrimaryButton } from "../ui/Buttons";
import { ScreenBar } from "../ui/ScreenBar";
import { colors, fontSize, radius, ripple } from "../ui/tokens";

const STRATEGY_OPTIONS: readonly {
  value: ContactStrategy;
  title: string;
  description: string;
}[] = [
  {
    value: "maintain",
    title: "Не потерять связь",
    description:
      "Спокойный ритм, чтобы не быть навязчивым. Интервал может постепенно расти и никогда не сокращается ради сближения.",
  },
  {
    value: "grow",
    title: "Сближаться",
    description:
      "Постепенное сближение, но только по взаимности: интервал сокращается лишь тогда, когда инициатива идёт от другого человека и общение прошло хорошо.",
  },
];

interface AddContactScreenProps {
  /** Подмена сервисов в компонентных тестах; по умолчанию — продовая сборка. */
  readonly services?: () => Promise<OrbitServices>;
}

export default function AddContactScreen({
  services = getOrbitServices,
}: AddContactScreenProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [strategy, setStrategy] = useState<ContactStrategy | null>(null);
  const [nameTouched, setNameTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const nameInvalid = nameTouched && name.trim().length === 0;
  const canSave = name.trim().length > 0 && strategy !== null && !submitting;

  const save = useCallback(async () => {
    if (submitting) return;
    if (strategy === null) {
      // Решение 3: сохранение без явного выбора стратегии недопустимо.
      setFormError("Выберите одну из стратегий.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const svc = await services();
      await svc.addContact({
        name,
        note: note.length > 0 ? note : undefined,
        strategy,
      });
      router.back(); // §7: после валидного сохранения — возврат в список
    } catch (e) {
      setFormError(
        e instanceof OrbitValidationError
          ? e.message
          : "Не удалось сохранить. Попробуйте ещё раз.",
      );
      setSubmitting(false);
    }
  }, [services, name, note, strategy, router, submitting]);

  return (
    <View style={styles.screen}>
      <View style={{ paddingTop: insets.top }}>
        <ScreenBar
          title="Новый контакт"
          subtitle="Добавление контакта"
          onBack={() => router.back()}
        />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.field}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>Имя</Text>
            <Text style={styles.req}>обязательно</Text>
          </View>
          <TextInput
            value={name}
            onChangeText={setName}
            onBlur={() => setNameTouched(true)}
            placeholder="Например, Марина Соколова"
            placeholderTextColor="rgba(107,114,128,0.8)"
            style={[styles.input, nameInvalid && styles.inputError]}
          />
          {nameInvalid && (
            <Text style={styles.error}>
              Укажите имя — без него контакт не сохранить.
            </Text>
          )}
        </View>

        <View style={styles.field}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>Заметка</Text>
            <Text style={styles.opt}>необязательно</Text>
          </View>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="О чём стоит помнить при общении"
            placeholderTextColor="rgba(107,114,128,0.8)"
            multiline
            style={[styles.input, styles.textarea]}
          />
        </View>

        <View style={styles.field}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>Стратегия связи</Text>
            <Text style={styles.req}>обязательно</Text>
          </View>
          <Text style={styles.helper}>
            Стратегия задаёт ритм общения. Выбор нельзя пропустить —
            автоматического значения нет.
          </Text>
          {formError !== null && <Text style={styles.error}>{formError}</Text>}
          <View style={styles.strategies}>
            {STRATEGY_OPTIONS.map((option) => {
              const active = strategy === option.value;
              return (
                <Pressable
                  key={option.value}
                  testID={`strategy-${option.value}`}
                  onPress={() => setStrategy(option.value)}
                  android_ripple={ripple}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                  style={[styles.strategy, active && styles.strategyActive]}
                >
                  <View
                    style={[styles.indicator, active && styles.indicatorActive]}
                  >
                    {active && <View style={styles.indicatorDot} />}
                  </View>
                  <View style={styles.strategyTexts}>
                    <Text style={styles.strategyTitle}>{option.title}</Text>
                    <Text style={styles.strategyDesc}>{option.description}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <View
        style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 14) }]}
      >
        <PrimaryButton label="Сохранить" disabled={!canSave} onPress={save} />
        {!canSave && (
          <Text style={styles.hint}>Укажите имя и выберите стратегию</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    flex: 1,
  },
  body: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 24,
    gap: 20,
  },
  field: {
    gap: 6,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  label: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: fontSize.small,
    fontWeight: "600",
    color: colors.ink,
  },
  req: {
    fontFamily: "Manrope_500Medium",
    fontSize: fontSize.tiny,
    fontWeight: "500",
    color: colors.due,
  },
  opt: {
    fontFamily: "Manrope_500Medium",
    fontSize: fontSize.tiny,
    fontWeight: "500",
    color: colors.muted,
  },
  input: {
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    fontFamily: "Manrope_400Regular",
    fontSize: fontSize.body,
    color: colors.ink,
  },
  textarea: {
    minHeight: 84,
    lineHeight: fontSize.body * 1.5,
    textAlignVertical: "top",
  },
  inputError: {
    borderColor: colors.dueLine,
  },
  error: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: fontSize.small,
    fontWeight: "600",
    color: colors.due,
  },
  helper: {
    fontFamily: "Manrope_400Regular",
    fontSize: fontSize.small,
    color: colors.muted,
  },
  strategies: {
    gap: 10,
    marginTop: 6,
  },
  strategy: {
    flexDirection: "row",
    gap: 12,
    padding: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  strategyActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  indicator: {
    width: 20,
    height: 20,
    marginTop: 2,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  indicatorActive: {
    borderColor: colors.accent,
  },
  indicatorDot: {
    width: 10,
    height: 10,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  strategyTexts: {
    flex: 1,
    gap: 4,
  },
  strategyTitle: {
    fontFamily: "Manrope_700Bold",
    fontSize: fontSize.body,
    fontWeight: "700",
    color: colors.ink,
  },
  strategyDesc: {
    fontFamily: "Manrope_400Regular",
    fontSize: fontSize.small,
    lineHeight: fontSize.small * 1.45,
    color: colors.muted,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  hint: {
    fontFamily: "Manrope_400Regular",
    fontSize: fontSize.tiny,
    color: colors.muted,
    textAlign: "center",
    marginTop: 8,
  },
});
