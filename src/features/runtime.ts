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

/** Открывает (один раз) БД и собирает сервисы. */
export function getOrbitServices(): Promise<OrbitServices> {
  if (cached === null) {
    cached = openOrbitDatabase().then((data) =>
      createOrbitServices({
        contacts: data.contacts,
        interactions: data.interactions,
        recorder: data.recorder,
        clock: systemClock,
        createId: createUuid,
      }),
    );
  }
  return cached;
}
