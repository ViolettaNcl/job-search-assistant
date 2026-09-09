(() => {
  if (window.top !== window || !self.vjaFloatingPanel.allowed(location.href)) return;
  let host, frame, body, hidden = false, collapsed = false;
  async function mount() {
    if (host) { host.style.display = ''; hidden = false; return; }
    host = document.createElement('div');
    host.style.cssText = 'position:fixed;z-index:2147483646;display:block;max-width:100vw;';
    const shadow = host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = ':host{all:initial}section{width:min(420px,100vw);border:1px solid #ffffff99;border-radius:16px;overflow:hidden;background:#ffffffcc;backdrop-filter:blur(18px);box-shadow:0 12px 40px #14142d44;font:14px system-ui;color:#182136}header{display:flex;align-items:center;gap:8px;padding:10px;background:#eeedffda;cursor:grab;touch-action:none}strong{flex:1}button{border:0;border-radius:8px;background:#fff9;color:#252340;padding:6px 10px;cursor:pointer;font:inherit}iframe{display:block;width:100%;height:min(540px,calc(100vh - 55px));border:0;background:transparent}';
    const section = document.createElement('section');
    const bar = document.createElement('header');
    bar.tabIndex = 0; bar.setAttribute('aria-label', 'Переместить панель: перетащите или используйте стрелки');
    const title = document.createElement('strong'); title.textContent = 'Violetta · текущая вакансия';
    const minimize = document.createElement('button'); minimize.textContent = '−'; minimize.title = 'Свернуть / развернуть';
    const close = document.createElement('button'); close.textContent = '×'; close.title = 'Скрыть на этой странице';
    bar.append(title, minimize, close);
    body = document.createElement('div');
    frame = document.createElement('iframe'); frame.title = 'Violetta Job Operator';
    frame.src = chrome.runtime.getURL('popup.html') + '?floating=1';
    body.append(frame);section.append(bar, body);shadow.append(style, section);document.documentElement.append(host);
    let stored = {};try { stored = await chrome.storage.sync.get('vjaFloatingPosition'); } catch {}
    function move(x, y) { const p = self.vjaFloatingPanel.position(x, y, innerWidth, innerHeight, 420, collapsed ? 50 : 590);host.style.left = p.x + 'px';host.style.top = p.y + 'px'; }
    function save() { void chrome.storage.sync.set({ vjaFloatingPosition: { x: parseFloat(host.style.left), y: parseFloat(host.style.top) } }).catch(() => {}); }
    move(stored.vjaFloatingPosition?.x, stored.vjaFloatingPosition?.y);
    let drag;
    bar.addEventListener('pointerdown', e => { if (e.target.closest('button')) return;drag = { x: e.clientX - host.offsetLeft, y: e.clientY - host.offsetTop };bar.setPointerCapture(e.pointerId);e.preventDefault(); });
    bar.addEventListener('pointermove', e => { if (drag) move(e.clientX - drag.x, e.clientY - drag.y); });
    const finish = () => { if (drag) { drag = null;save(); } };
    bar.addEventListener('pointerup', finish);bar.addEventListener('pointercancel', finish);
    bar.addEventListener('keydown', e => { const d = {ArrowLeft:[-20,0],ArrowRight:[20,0],ArrowUp:[0,-20],ArrowDown:[0,20]}[e.key];if(d&&e.target===bar){e.preventDefault();move(host.offsetLeft+d[0],host.offsetTop+d[1]);save();} });
    minimize.addEventListener('click', () => {collapsed = !collapsed;body.hidden = collapsed;minimize.textContent = collapsed ? '+' : '−';});
    close.addEventListener('click', () => {host.style.display = 'none';hidden = true;});
    window.addEventListener('resize', () => move(host.offsetLeft, host.offsetTop));
  }
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (message?.type !== 'vjaToggleFloatingPanel') return false;
    if (host && !hidden) {host.style.display = 'none';hidden = true;respond({ok:true});return false;}
    mount().then(() => respond({ok:true})).catch(() => respond({ok:false}));return true;
  });
  if (self.vjaFloatingPanel.automatic(location.href)) void mount();
})();
