/**
 * Генерация идентификаторов под изоляцией platform API (план Stage 3,
 * «Technical approach»): официальный модуль Expo `expo-crypto` даёт надёжный
 * UUID без собственного кода. Внедряется в features (IdGenerator) и подменяется
 * в тестах фиксированным значением.
 */

import * as Crypto from "expo-crypto";

/** Генерирует UUID (стандартный формат v4). */
export function createUuid(): string {
  return Crypto.randomUUID();
}
