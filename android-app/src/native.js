// ---- Native bridge: only active inside the Android app (Capacitor). ----
// Saved data: kept in app storage (Preferences / SharedPreferences) so Android backup
// restores it on a new phone. localStorage stays as the page's synchronous copy.
// Reminders: phone notifications the evening before each dose, and 14 days before
// a new pen is needed when there is no spare. Photos: the Android photo picker.
window.PenNative = (function () {
  const C = window.Capacitor;
  const native = !!(C && C.isNativePlatform && C.isNativePlatform());
  const P = native ? C.Plugins : {};
  const KEY = 'ozempic-pen-planner-v2';
  const DOSE_HOUR = 19, PEN_HOUR = 9, WEEKS = 16;

  if (!native) return { ready: Promise.resolve(), afterBoot() {} };

  document.documentElement.classList.add('native-app');
  document.head.insertAdjacentHTML('beforeend', `<style>
    html.native-app body { padding-top: env(safe-area-inset-top); padding-bottom: env(safe-area-inset-bottom); }
    html.native-app #pasteBox { display: none; }
  </style>`);

  // Mirror every write of the tracker's key into Preferences.
  const setItem = Storage.prototype.setItem, removeItem = Storage.prototype.removeItem;
  Storage.prototype.setItem = function (k, v) {
    setItem.call(this, k, v);
    if (this === localStorage && k === KEY) { P.Preferences.set({ key: KEY, value: String(v) }).catch(() => {}); schedule(); }
  };
  Storage.prototype.removeItem = function (k) {
    removeItem.call(this, k);
    if (this === localStorage && k === KEY) { P.Preferences.remove({ key: KEY }).catch(() => {}); schedule(); }
  };

  // Restore before the app reads localStorage. Preferences wins; if only the
  // WebView has data (older build), copy it across.
  const ready = (async () => {
    try {
      const { value } = await P.Preferences.get({ key: KEY });
      const local = localStorage.getItem(KEY);
      if (value != null) setItem.call(localStorage, KEY, value);
      else if (local != null) await P.Preferences.set({ key: KEY, value: local });
    } catch (e) {}
  })();

  // ---- Reminders ----
  let timer = null;
  function schedule() { clearTimeout(timer); timer = setTimeout(() => reschedule().catch(() => {}), 800); }

  const at = (iso, h) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d, h, 0, 0); };
  const clicks = ug => fmtClicks(ugToClicks(ug, st));

  async function reschedule() {
    const LN = P.LocalNotifications;
    const pending = await LN.getPending();
    if (pending.notifications.length) await LN.cancel({ notifications: pending.notifications.map(n => ({ id: n.id })) });
    if (typeof st === 'undefined' || !st.setupDone) return;

    let perm = await LN.checkPermissions();
    if (perm.display === 'prompt' || perm.display === 'prompt-with-rationale') perm = await LN.requestPermissions();
    if (perm.display !== 'granted') return;

    const now = new Date(), today = todayISO();
    const sim = simulate(st, addDays(today, WEEKS * 7)).filter(e => e.date >= today);
    const list = [];
    sim.forEach((e, i) => {
      const when = at(addDays(e.date, -1), DOSE_HOUR);
      if (when > now) {
        const body = e.split
          ? `${clicks(e.oldUg)} clicks from pen ${e.oldPenNo}, then ${clicks(e.newUg)} clicks from new pen ${e.penNo}.`
          : `${clicks(e.oldUg || e.newUg)} clicks from pen ${e.penNo}${e.newPen ? ' (start a new pen)' : ''}.`;
        list.push({ id: 1000 + i, title: `Dose tomorrow, ${fmtNice(e.date)}`, body, schedule: { at: when, allowWhileIdle: true } });
      }
    });
    // 14-day heads-up when a new pen is needed and there is no spare.
    simulate(st, addDays(today, 52 * 7)).filter(e => e.newPen && e.sparesAfter < 0 && e.date > today).slice(0, 6).forEach((e, i) => {
      const when = at(addDays(e.date, -14), PEN_HOUR);
      if (when > now) list.push({ id: 2000 + i, title: 'Time to buy a pen',
        body: `Pen ${e.penNo} is needed on ${fmtNice(e.date)} and you have no spare.`, schedule: { at: when, allowWhileIdle: true } });
    });
    if (list.length) await LN.schedule({ notifications: list });
  }

  // ---- Photo: Android photo picker / camera instead of the WebView file input ----
  function hookPhoto() {
    const inp = document.getElementById('pPhoto');
    if (!inp || !P.Camera) return;
    inp.click = async () => {
      try {
        const ph = await P.Camera.getPhoto({ resultType: 'dataUrl', source: 'PROMPT', quality: 90, width: 1600, correctOrientation: true,
          promptLabelHeader: 'Your photo', promptLabelPhoto: 'Choose from gallery', promptLabelPicture: 'Take a photo' });
        const blob = await (await fetch(ph.dataUrl)).blob();
        const dt = new DataTransfer();
        dt.items.add(new File([blob], 'photo.' + (ph.format || 'jpeg'), { type: blob.type || 'image/jpeg' }));
        inp.files = dt.files;
        inp.dispatchEvent(new Event('change', { bubbles: true }));
      } catch (e) { /* cancelled */ }
    };
  }

  return { ready, afterBoot() { hookPhoto(); schedule(); } };
})();
