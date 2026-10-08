/**
 * Продовая сборка сервисов приложения: открывает локальную БД (expo-sqlite)
 * и собирает use-cases над системными часами и `expo-crypto`.
 *
 * Единственное место, где сходятся нативные зависимости; экраны получают
 * сервисы через props с дефолтом из `getOrbitServices` — компонентные тесты
 * подставляют подмены, не касаясь нативных модулей (план Stage 3,
 * «Тестируемость»). БД открывается один раз на запуск приложения.
 */

import { openOrbitDatabase } from "../data";
import { systemClock } from "../services/clock";
import { createUuid } from "../services/uuid";
import { createOrbitServices, type OrbitServices } from "./orbitServices";

let cached: Promise<OrbitServices> | null = null;

/**
 * Открывает (один раз) БД и собирает сервисы.
 *
 * При успешном запуске инициализация единственная (промис кешируется). При
 * ошибке отклонённый промис в кеше НЕ остаётся (REVIEW-03): кеш сбрасывается,
 * поэтому следующий вызов повторяет попытку, а не возвращает навсегда ту же
 * ошибку.
 */
export function getOrbitServices(): Promise<OrbitServices> {
  if (cached === null) {
    cached = openOrbitDatabase()
      .then((data) =>
        createOrbitServices({
          contacts: data.contacts,
          interactions: data.interactions,
          recorder: data.recorder,
          clock: systemClock,
          createId: createUuid,
        }),
      )
      .catch((error: unknown) => {
        // Повторная попытка возможна: неудачная инициализация не кешируется.
        cached = null;
        throw error;
      });
  }
  return cached;
}
