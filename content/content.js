(() => {
  if (window.top !== window || !globalThis.chrome?.runtime?.id) return;

  document.querySelectorAll('[data-daria-timer]').forEach((el) => el.remove());
  let timerId = null;

  const WARN_SEC = 80;
  const ALERT_SEC = 110;

  const STATUS = {
    idle:  'Таймер не запущено',
    ok:    'Все під контролем',
    warn:  'Час відповісти',
    alert: 'Терміново!',
  };

  const host = document.createElement('div');
  host.style.cssText = 'all: initial; position: fixed; z-index: 2147483647; top: 16px; right: 16px; display: none;';
  host.dataset.dariaTimer = '';
  const root = host.attachShadow({ mode: 'closed' });

  const css = new CSSStyleSheet();
  css.replaceSync(`
    .card {
      --bg: #ffffff;
      --fg: #111113;
      --muted: rgba(17,17,19,.48);
      --soft: rgba(17,17,19,.72);
      --faint: rgba(17,17,19,.32);
      --line: rgba(17,17,19,.07);
      --btn: rgba(17,17,19,.05);
      --btn-hover: rgba(17,17,19,.10);
      --cat-bg: #f2f2f4;
      --shadow: 0 18px 40px rgba(17,17,26,.14), 0 2px 6px rgba(17,17,26,.06);
      --ok: #34C759;
      --warn: #F08A00;
      --alert: #FF3B30;

      width: 280px;
      box-sizing: border-box;
      padding: 14px 16px 16px;
      color: var(--fg);
      background: var(--bg);
      border: 1px solid var(--line);
      border-radius: 24px;
      box-shadow: var(--shadow);
      font-family: -apple-system, "SF Pro Display", "Segoe UI Variable Display", "Segoe UI", system-ui, sans-serif;
      user-select: none;
      transition: background .25s, color .25s, box-shadow .3s;
    }

    .card[data-theme="dark"] {
      --bg: linear-gradient(160deg, #1c1c1e 0%, #0b0b0c 100%);
      --fg: #ffffff;
      --muted: rgba(255,255,255,.5);
      --soft: rgba(255,255,255,.75);
      --faint: rgba(255,255,255,.35);
      --line: rgba(255,255,255,.08);
      --btn: rgba(255,255,255,.08);
      --btn-hover: rgba(255,255,255,.16);
      --cat-bg: #ffffff;
      --shadow: 0 18px 40px rgba(0,0,0,.35), 0 2px 6px rgba(0,0,0,.2);
      --warn: #FF9F0A;
      --alert: #FF453A;
    }

    .head { display: flex; align-items: center; gap: 10px; cursor: grab; }
    .head:active { cursor: grabbing; }
    .cat {
      width: 38px; height: 38px; flex: none;
      box-sizing: border-box; padding: 3px;
      object-fit: contain;
      background: var(--cat-bg);
      border-radius: 13px;
    }
    .title { font-size: 14px; font-weight: 600; line-height: 1.2; }
    .sub { font-size: 12px; color: var(--muted); margin-top: 2px; }

    .actions { margin-left: auto; display: flex; gap: 6px; }
    .btn {
      all: unset;
      width: 30px; height: 30px; flex: none;
      display: grid; place-items: center;
      border-radius: 50%;
      background: var(--btn);
      color: var(--soft);
      cursor: pointer;
      transition: background .15s, color .15s;
    }
    .btn:hover { background: var(--btn-hover); color: var(--fg); }
    .btn svg { width: 14px; height: 14px; }
    .sun { display: none; }
    .card[data-theme="dark"] .sun { display: block; }
    .card[data-theme="dark"] .moon { display: none; }

    .time {
      display: flex;
      margin: 18px 0 14px;
      font-size: 54px; font-weight: 700; line-height: 1;
      letter-spacing: -1.5px;
      font-variant-numeric: tabular-nums;
      transition: color .3s;
    }
    .time .d {
      position: relative;
      display: inline-block;
      overflow: hidden;
      padding: .08em 0;
      margin: -.08em 0;
    }
    .time .d > span { display: block; }
    .time .d .in  { animation: roll-in .42s cubic-bezier(.22,1,.36,1); }
    .time .d .out {
      position: absolute; left: 0; top: .08em;
      animation: roll-out .42s cubic-bezier(.22,1,.36,1) forwards;
    }
    .time .sep {
      display: inline-block;
      padding: 0 .02em;
      opacity: .55;
      transform: translateY(-.1em);
    }
    @keyframes roll-in {
      from { transform: translateY(70%); opacity: 0; filter: blur(3px); }
      to   { transform: none; opacity: 1; filter: none; }
    }
    @keyframes roll-out {
      from { transform: none; opacity: 1; filter: none; }
      to   { transform: translateY(-70%); opacity: 0; filter: blur(3px); }
    }
    @media (prefers-reduced-motion: reduce) {
      .time .d .in, .time .d .out { animation: none !important; }
      .time .d .out { display: none; }
    }

    .bar { height: 6px; border-radius: 3px; background: var(--line); overflow: hidden; }
    .bar i {
      display: block; height: 100%; width: 0;
      border-radius: inherit;
      background: linear-gradient(90deg, #FFB800, #FF6A00 55%, #FF2D55);
      transition: width 1s linear;
    }

    .foot { display: flex; align-items: center; gap: 8px; margin-top: 12px; font-size: 13px; color: var(--soft); }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--ok); transition: background .3s; }
    .limit { margin-left: auto; color: var(--faint); }

    .card[data-state="idle"]  .time { color: var(--faint); }
    .card[data-state="idle"]  .dot  { background: var(--faint); }
    .card[data-state="warn"]  .time,
    .card[data-state="warn"]  .status { color: var(--warn); }
    .card[data-state="warn"]  .dot  { background: var(--warn); }
    .card[data-state="alert"] .time,
    .card[data-state="alert"] .status { color: var(--alert); }
    .card[data-state="alert"] .dot  { background: var(--alert); }
    .card[data-state="alert"] { animation: pulse 1.2s ease-in-out infinite; }
    @keyframes pulse {
      0%, 100% { box-shadow: 0 0 0 2px rgba(255,59,48,.55), 0 18px 40px rgba(255,59,48,.28); }
      50%      { box-shadow: 0 0 0 6px rgba(255,59,48,.15), 0 18px 40px rgba(255,59,48,.18); }
    }
  `);
  root.adoptedStyleSheets = [css];

  const limit = `${Math.floor(ALERT_SEC / 60)}:${String(ALERT_SEC % 60).padStart(2, '0')}`;
  root.innerHTML = `
    <div class="card" data-state="idle" data-theme="light">
      <div class="head" title="Перетягнути">
        <img class="cat" alt="">
        <div>
          <div class="title">Клієнт чекає</div>
          <div class="sub">Daria’s timer</div>
        </div>
        <div class="actions">
          <button class="btn" data-a="theme" title="Змінити тему">
            <svg class="moon" viewBox="0 0 14 14" fill="currentColor">
              <path d="M12.2 8.6A5.4 5.4 0 0 1 5.4 1.8a5.4 5.4 0 1 0 6.8 6.8z"/>
            </svg>
            <svg class="sun" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
              <circle cx="7" cy="7" r="2.6" fill="currentColor" stroke="none"/>
              <path d="M7 1v1.4M7 11.6V13M1 7h1.4M11.6 7H13M2.8 2.8l1 1M10.2 10.2l1 1M2.8 11.2l1-1M10.2 3.8l1-1"/>
            </svg>
          </button>
          <button class="btn" data-a="close" title="Закрити і скинути">
            <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M3 3l8 8M11 3l-8 8"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="time"></div>
      <div class="bar"><i></i></div>
      <div class="foot">
        <span class="dot"></span>
        <span class="status"></span>
        <span class="limit">ліміт ${limit}</span>
      </div>
    </div>`;

  const card = root.querySelector('.card');
  const timeEl = root.querySelector('.time');
  const barEl = root.querySelector('.bar i');
  const statusEl = root.querySelector('.status');
  const catEl = root.querySelector('.cat');
  catEl.src = chrome.runtime.getURL('icons/icon128.png');
  catEl.onerror = () => catEl.remove();

  let startedAt = null;
  let shown = '';

  function cell(ch) {
    const wrap = document.createElement('span');
    wrap.className = ch === ':' ? 'sep' : 'd';
    const span = document.createElement('span');
    span.textContent = ch;
    wrap.append(span);
    return wrap;
  }

  function roll(wrap, ch) {
    const old = wrap.lastElementChild;
    old.className = 'out';
    setTimeout(() => old.remove(), 450);
    const span = document.createElement('span');
    span.className = 'in';
    span.textContent = ch;
    wrap.append(span);
  }

  function renderTime(text) {
    if (text === shown) return;
    const animate = host.style.display !== 'none' && text.length === shown.length;
    if (!animate) {
      timeEl.replaceChildren(...[...text].map(cell));
    } else {
      [...text].forEach((ch, i) => {
        if (ch !== shown[i]) roll(timeEl.children[i], ch);
      });
    }
    shown = text;
  }

  function setState(state) {
    const prev = card.dataset.state;
    card.dataset.state = state;
    statusEl.textContent = STATUS[state];
    if (prev !== state && (state === 'warn' || state === 'alert') && host.style.display !== 'none') {
      timeEl.animate(
        [{ transform: 'scale(1)' }, { transform: 'scale(1.08)' }, { transform: 'scale(1)' }],
        { duration: 450, easing: 'cubic-bezier(.22,1,.36,1)' },
      );
    }
  }

  function tick() {
    if (!chrome.runtime?.id) {
      clearTimeout(timerId);
      timerId = 'stopped';
      host.remove();
      return;
    }
    if (!startedAt) {
      renderTime('00:00');
      barEl.style.width = '0';
      setState('idle');
      return;
    }
    const sec = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
    const min = Math.floor(sec / 60);
    const h = Math.floor(min / 60);
    const mm = String(min % 60).padStart(2, '0');
    const ss = String(sec % 60).padStart(2, '0');
    renderTime(h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`);
    barEl.style.width = Math.min(100, (sec / ALERT_SEC) * 100) + '%';
    setState(sec >= ALERT_SEC ? 'alert' : sec >= WARN_SEC ? 'warn' : 'ok');
  }

  function scheduleTick() {
    if (timerId === 'stopped') return;
    clearTimeout(timerId);
    const elapsed = Date.now() - (startedAt ?? 0);
    timerId = setTimeout(() => {
      tick();
      scheduleTick();
    }, 1000 - (elapsed % 1000) + 15);
  }

  function apply(state) {
    if ('startedAt' in state) {
      startedAt = state.startedAt ?? null;
      scheduleTick();
    }
    if ('visible' in state) host.style.display = state.visible === true ? '' : 'none';
    if ('theme' in state) card.dataset.theme = state.theme === 'dark' ? 'dark' : 'light';
    if (state.pos) {
      const w = host.offsetWidth || 280;
      const h = host.offsetHeight || 170;
      const x = Math.min(Math.max(0, state.pos.x), innerWidth - w);
      const y = Math.min(Math.max(0, state.pos.y), innerHeight - h);
      host.style.left = x + 'px';
      host.style.top = y + 'px';
      host.style.right = 'auto';
    }
    tick();
  }

  root.addEventListener('click', (e) => {
    const action = e.target.closest('button')?.dataset.a;
    if (action === 'close') {
      chrome.storage.local.set({ visible: false, startedAt: null });
    } else if (action === 'theme') {
      chrome.storage.local.set({ theme: card.dataset.theme === 'dark' ? 'light' : 'dark' });
    }
  });

  const handle = root.querySelector('.head');
  handle.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    const rect = host.getBoundingClientRect();
    const dx = e.clientX - rect.left;
    const dy = e.clientY - rect.top;
    handle.setPointerCapture(e.pointerId);

    const move = (ev) => apply({ pos: { x: ev.clientX - dx, y: ev.clientY - dy } });
    const up = () => {
      handle.removeEventListener('pointermove', move);
      const r = host.getBoundingClientRect();
      chrome.storage.local.set({ pos: { x: Math.round(r.left), y: Math.round(r.top) } });
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up, { once: true });
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    const state = {};
    for (const [key, { newValue }] of Object.entries(changes)) state[key] = newValue;
    apply(state);
  });

  chrome.storage.local.get(['startedAt', 'visible', 'pos', 'theme']).then(apply);
  scheduleTick();

  document.documentElement.append(host);
})();
