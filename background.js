const ALERTS = [
  { sec: 80,  title: 'Клієнт чекає 1:20', message: 'Час відповісти 🙂' },
  { sec: 110, title: 'Клієнт чекає вже 1:50!', message: 'Терміново дайте відповідь 🔥', urgent: true },
];
const WARN_SEC = ALERTS[0].sec;
const ALERT_SEC = ALERTS[1].sec;
const COLORS = { ok: '#2DA44E', warn: '#FF8A00', alert: '#E5322D' };

let ticker = null;

function resetTimer() {
  chrome.storage.local.remove(['startedAt', 'visible']);
  chrome.alarms.clearAll();
  chrome.action.setBadgeText({ text: '' });
}

chrome.runtime.onInstalled.addListener(resetTimer);
chrome.runtime.onStartup.addListener(resetTimer);

chrome.runtime.onInstalled.addListener(async () => {
  const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });
  for (const tab of tabs) {
    chrome.scripting
      .executeScript({ target: { tabId: tab.id }, files: ['content/content.js'] })
      .catch(() => {});
  }
});

async function isTimerRunning() {
  const data = await chrome.storage.local.get('startedAt');
  return Boolean(data.startedAt);
}

async function toggleTimer() {
  if (await isTimerRunning()) {
    resetTimer();
  } else {
    startTimer();
  }
}

function startTimer() {
  chrome.storage.local.set({ visible: true, startedAt: Date.now() });
}

chrome.action.onClicked.addListener(toggleTimer);
chrome.commands.onCommand.addListener((command) => {
  if (command === 'start-timer') startTimer();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && 'startedAt' in changes) schedule(changes.startedAt.newValue);
});

chrome.storage.local.get('startedAt').then(({ startedAt }) => runBadge(startedAt));

async function schedule(startedAt) {
  await chrome.alarms.clearAll();
  ALERTS.forEach((_, i) => chrome.notifications.clear(`timer-${i}`));

  if (startedAt) {
    ALERTS.forEach((a, i) => {
      const when = startedAt + a.sec * 1000;
      if (when > Date.now()) chrome.alarms.create(`alert-${i}`, { when });
    });
  }
  runBadge(startedAt);
}

chrome.alarms.onAlarm.addListener(({ name }) => {
  const i = Number(name.split('-')[1]);
  const a = ALERTS[i];
  if (!a) return;

  chrome.notifications.create(`timer-${i}`, {
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: a.title,
    message: a.message,
    priority: 2,
    requireInteraction: !!a.urgent,
  });
});

chrome.notifications.onClicked.addListener((id) => chrome.notifications.clear(id));

function badgeText(sec) {
  const m = Math.floor(sec / 60);
  const s = String(sec % 60).padStart(2, '0');
  if (m < 10) return `${m}:${s}`;
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h`;
}

function runBadge(startedAt) {
  clearTimeout(ticker);

  if (!startedAt) {
    chrome.action.setBadgeText({ text: '' });
    return;
  }

  const update = () => {
    const sec = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
    const color = sec >= ALERT_SEC ? COLORS.alert : sec >= WARN_SEC ? COLORS.warn : COLORS.ok;
    chrome.action.setBadgeText({ text: badgeText(sec) });
    chrome.action.setBadgeBackgroundColor({ color });
    chrome.action.setBadgeTextColor({ color: '#fff' });
    ticker = setTimeout(update, 1000 - ((Date.now() - startedAt) % 1000) + 15);
  };

  update();
}