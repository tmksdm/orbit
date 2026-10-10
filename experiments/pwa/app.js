// Orbit PWA prototype: local storage + attempt to schedule a local notification without a backend.
const KEY = 'orbit.pwa.contacts';
const logEl = document.getElementById('log');
const countEl = document.getElementById('count');
function log(m) { logEl.textContent += m + '\n'; }
function contacts() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } }
function render() { countEl.textContent = 'Контактов: ' + contacts().length; }
document.getElementById('add').addEventListener('click', () => {
  const c = contacts();
  c.push({ id: crypto.randomUUID(), name: 'Контакт ' + (c.length + 1), createdAt: Date.now() });
  localStorage.setItem(KEY, JSON.stringify(c));
  render();
  log('Сохранено локально. Всего: ' + c.length);
});
document.getElementById('schedule').addEventListener('click', async () => {
  if (!('Notification' in window)) { log('Notification API недоступен.'); return; }
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') { log('Разрешение не выдано: ' + perm); return; }
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) { log('Service worker не зарегистрирован.'); return; }
  // Notification Triggers (showTrigger / TimestampTrigger) — экспериментальный API, в Chrome не поставляется.
  try {
    if ('TimestampTrigger' in window) {
      const t = new window.TimestampTrigger(Date.now() + 3 * 24 * 60 * 60 * 1000);
      await reg.showNotification('Orbit', { body: 'Пора связаться', showTrigger: t });
      log('Запланировано через showTrigger (TimestampTrigger).');
    } else {
      log('showTrigger/TimestampTrigger НЕ поддерживается этим браузером: ' +
          'локальное уведомление по расписанию без backend и без открытой страницы НЕВОЗМОЖНО.');
      await reg.showNotification('Orbit', { body: 'Уведомление показано только потому, что приложение открыто.' });
      log('Показано немедленное уведомление (только пока страница активна).');
    }
  } catch (e) { log('Ошибка: ' + String(e)); }
});
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').then(() => log('Service worker зарегистрирован.')).catch(e => log('SW: ' + e));
}
render();
