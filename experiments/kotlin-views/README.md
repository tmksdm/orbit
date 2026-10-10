# Прототип: Kotlin + Android Views (изолированный)

Минимальное нативное Android-приложение для архитектурного исследования Orbit.
**Не часть приложения Orbit** — не входит в сборку, lint, typecheck, тесты.

Содержимое: экран (TextView+Button), локальное хранение (`SharedPreferences`),
планирование локального напоминания (`AlarmManager.setAndAllowWhileIdle` — неточный
alarm, не требует `SCHEDULE_EXACT_ALARM`), приём (`ReminderReceiver`), повторное
планирование после перезагрузки (`BootReceiver`, `BOOT_COMPLETED`).

## Сборка

```bash
# требуется Android SDK 34 + build-tools 34.0.0 + JDK 17+ + Gradle
sdk.dir=<ANDROID_SDK>   # в local.properties (не коммитится)
gradle :app:assembleDebug :app:assembleRelease
```

## Измеренные размеры APK (2026-10-10, песочница: Android SDK 34, build-tools 34.0.0, Gradle 8.7, R8)

| Артефакт | Байт | Размер |
|---|---|---|
| `app-debug.apk` | 3 179 111 | ≈ 3.18 МБ |
| `app-release-unsigned.apk` (R8, shrink) | **612 256** | **≈ 0.61 МБ** |
| `classes.dex` (из release) | 583 328 | ≈ 0.58 МБ |
| `resources.arsc` (из release) | 163 944 | ≈ 0.16 МБ |

Не измерено (нет устройства): холодный запуск, память, установленный размер,
фактическая доставка напоминаний при Doze/OEM.
