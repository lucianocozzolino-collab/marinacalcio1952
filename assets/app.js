// foto-schede: rosa e societa con le foto (assets/giocatori/nome-cognome.jpg).
// I nomi si leggono dalle liste scritte in index.html: se le modifichi li' la pagina le segue.
(() => {
  const slug = n => n.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const ini = n => { const t = n.split(/\s+/); return (t[0][0] + (t.length > 1 ? t[t.length - 1][0] : '')).toUpperCase(); };
  const esc = s => s.replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const css = document.createElement('style');
  css.textContent = `.pg{display:grid;gap:14px;grid-template-columns:repeat(auto-fill,minmax(150px,1fr))}
.pl{position:relative;margin:0;aspect-ratio:4/5;border-radius:12px;overflow:hidden;background:#111;border:1px solid var(--line)}
.pl .ini{position:absolute;inset:0;display:grid;place-items:center;font:800 56px "Barlow Condensed",sans-serif;color:var(--buoy)}
.pl img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#000}
.pl figcaption{position:absolute;left:0;right:0;bottom:0;padding:26px 10px 9px;color:#fff;font:600 18px/1.1 "Barlow Condensed",sans-serif;background:linear-gradient(transparent,rgba(0,0,0,.82))}
.pl img ~ figcaption{display:none}
.pl small{display:block;margin-top:3px;font:500 13px/1.2 Barlow,sans-serif;opacity:.85}`;
  document.head.appendChild(css);
  // con la foto il nome e' gia' stampato sulla figurina: la didascalia compare solo se la foto manca
  const card = (n, r) => `<figure class="pl"><span class="ini" aria-hidden="true">${ini(n)}</span><img src="assets/giocatori/${slug(n)}.jpg" alt="${esc(n)}${r ? ', ' + esc(r) : ''}" loading="lazy" onerror="this.remove()"><figcaption>${esc(n)}${r ? '<small>' + esc(r) + '</small>' : ''}</figcaption></figure>`;
  try { // rosa
    const sec = document.querySelector('#squadra .wrap');
    const groups = sec ? [...sec.querySelectorAll('h3.grp')].map(h => [h.textContent.trim(), [...h.nextElementSibling.querySelectorAll('li')].map(li => li.textContent.trim())]).filter(([, n]) => n.length) : [];
    if (groups.length) sec.innerHTML = '<h2>La rosa</h2>' + groups.map(([t, ns]) => `<h3 class="grp">${esc(t)}</h3><div class="pg">${ns.map(n => card(n)).join('')}</div>`).join('');
  } catch (e) { /* resta l'elenco con i nomi */ }
  try { // staff tecnico e dirigenza
    const grid = document.querySelector('#societa .grid');
    if (grid) {
      let sponsor = '';
      const groups = [...grid.querySelectorAll('.card')].map(c => [c.querySelector('h3').textContent.trim(),
        [...c.querySelectorAll('dt')].flatMap(dt => {
          const dd = dt.nextElementSibling.textContent.trim();
          if (/sponsor/i.test(dt.textContent)) { sponsor = dd; return []; }
          const role = dt.textContent.trim().replace(/^Dirigenti$/, 'Dirigente').replace(/^Preparatori dei portieri$/, 'Preparatore portieri');
          return dd.split(/,\s*/).map(n => [n.trim(), role]);
        })]).filter(([, l]) => l.length);
      if (groups.length) grid.outerHTML = groups.map(([t, l]) => `<h3 class="grp" style="margin-top:26px">${esc(t)}</h3><div class="pg">${l.map(([n, r]) => card(n, r)).join('')}</div>`).join('')
        + (sponsor && !/diventa/i.test(sponsor) ? `<p style="margin:22px 0 0;color:var(--mute)">Main sponsor: <b style="color:var(--ink)">${esc(sponsor)}</b></p>` : '');
    }
  } catch (e) { /* resta la versione con i nomi */ }
  try { // "Diventa sponsor" apre la pagina di contatto
    const w = document.querySelector('#societa .wrap');
    const b = w && w.querySelector('a.btn');
    if (b) b.setAttribute('href', 'sponsor.html');
    else if (w) w.insertAdjacentHTML('beforeend', '<p style="margin-top:22px"><a class="btn" href="sponsor.html">Diventa sponsor</a></p>');
  } catch (e) {}
  try { // figurina del main sponsor accanto al logo (assets/giocatori/michele-guasti.jpg)
    const w = document.querySelector('.sponsor .wrap');
    const nome = (w && w.dataset && w.dataset.nome) || 'Michele Guasti';
    if (w && !w.querySelector('.pl')) w.insertAdjacentHTML('beforeend', `<div style="width:140px">${card(nome, 'Main sponsor')}</div>`);
  } catch (e) {}
})();

// news: riquadro della Pagina Facebook (si aggiorna da solo) + post Instagram scelti dall'amministratore (tabella "news" su Supabase)
(async () => {
  const grid = document.querySelector('#news .grid'); if (!grid) return;
  const IG = 'https://www.instagram.com/marinacalcio1952/';
  const FB = 'https://www.facebook.com/61591621145514'; // indirizzo della Pagina Facebook (deve essere pubblica)
  const fb = `<div style="min-width:0"><iframe title="Ultime novità dalla Pagina Facebook del Marina Calcio" src="https://www.facebook.com/plugins/page.php?href=${encodeURIComponent(FB)}&amp;tabs=timeline&amp;width=500&amp;height=640&amp;small_header=true&amp;adapt_container_width=true&amp;hide_cover=true&amp;show_facepile=false" width="500" height="640" style="border:0;overflow:hidden;max-width:100%;background:#fff;border-radius:10px" scrolling="no" loading="lazy" allow="encrypted-media; clipboard-write; picture-in-picture; web-share"></iframe><p style="margin:8px 0 0"><a href="${FB}" rel="noopener">Apri la Pagina Facebook</a></p></div>`;
  const cta = `<article class="card"><h3>Le novità sono su Instagram</h3><p>Foto, risultati e aggiornamenti della squadra sul profilo ufficiale.</p><p><a class="btn" href="${IG}" rel="noopener">Seguici su Instagram</a></p></article>`;
  grid.innerHTML = cta + fb;
  try {
    if (!window.CFG) await new Promise(res => { const s = document.createElement('script'); s.src = 'assets/config.js?v=3'; s.onload = res; s.onerror = res; document.head.appendChild(s); });
    if (!window.CFG || String(CFG.url).startsWith('INCOLLA')) return;
    const r = await fetch(`${CFG.url}/rest/v1/news?select=url&visibile=eq.true&order=creato_il.desc&limit=6`, { headers: { apikey: CFG.key } });
    if (!r.ok) return;
    const posts = (await r.json()).filter(p => /^https:\/\/www\.instagram\.com\/(p|reel)\/[\w-]+\/$/.test(p.url));
    if (!posts.length) return;
    grid.style.gridTemplateColumns = 'repeat(auto-fit,minmax(min(100%,326px),1fr))';
    grid.innerHTML = posts.map(p => `<div style="min-width:0"><blockquote class="instagram-media" data-instgrm-permalink="${p.url}?utm_source=ig_embed&amp;utm_campaign=loading" data-instgrm-version="14" style="background:#fff;border:1px solid var(--line);border-radius:10px;margin:0;max-width:540px;min-width:0;width:100%"><a href="${p.url}" rel="noopener">Vedi il post su Instagram</a></blockquote></div>`).join('') + fb
      + `<p style="grid-column:1/-1;margin:6px 0 0"><a class="btn" href="${IG}" rel="noopener">Tutti i post su Instagram</a></p>`;
    const s = document.createElement('script'); s.async = true; s.src = 'https://www.instagram.com/embed.js'; document.body.appendChild(s);
  } catch (e) { /* resta il link al profilo */ }
})();

// partita: scheda "prossima partita" con stemmi, effetti e conto alla rovescia (stemmi in assets/loghi/nome-squadra.png)
(() => {
  const slug = n => n.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const ini = n => n.split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  window.__crest = img => { const ex = (img.dataset.ex || '').split(',').filter(Boolean); const nx = ex.shift(); if (!nx) return img.remove(); img.dataset.ex = ex.join(','); img.src = img.dataset.base + nx; };
  const css = document.createElement('style');
  css.textContent = `.board.mb{display:block;position:relative;overflow:hidden;text-align:center;color:#fff;padding:26px 22px 22px;border-radius:18px 18px 0 0;
background:radial-gradient(120% 150% at 50% 0%,rgba(245,196,0,.18),transparent 58%),linear-gradient(160deg,#27271e,#11110e);
box-shadow:0 0 0 1px rgba(245,196,0,.38),0 26px 70px -22px rgba(245,196,0,.4);animation:mbIn .8s cubic-bezier(.2,.8,.2,1) both}
.board.mb::before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(115deg,transparent 0 46px,rgba(245,196,0,.055) 46px 92px);pointer-events:none}
.board.mb::after{content:"";position:absolute;top:0;bottom:0;left:-60%;width:38%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.11),transparent);transform:skewX(-20deg);animation:mbShine 7s ease-in-out 1.5s infinite;pointer-events:none}
.mb>*{position:relative;z-index:1}
.mb-chips{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:20px}
.mb-chip{font:600 15px "Barlow Condensed",sans-serif;letter-spacing:.04em;padding:4px 14px;border-radius:999px;background:rgba(245,196,0,.14);color:var(--buoy);border:1px solid rgba(245,196,0,.38)}
.mb-teams{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:18px}
.mb-team{display:grid;justify-items:center;gap:14px;min-width:0}
.mb-crest{position:relative;width:116px;height:116px;border-radius:50%;background:#fff;display:grid;place-items:center;box-shadow:0 14px 30px rgba(0,0,0,.55),0 0 0 4px rgba(255,255,255,.9);animation:mbFloat 5.5s ease-in-out infinite;transition:transform .35s}
.mb-team:last-child .mb-crest{animation-delay:-2.7s}
.mb-team.us .mb-crest{box-shadow:0 14px 30px rgba(0,0,0,.55),0 0 0 4px var(--buoy),0 0 42px rgba(245,196,0,.5)}
.mb-crest:hover{transform:scale(1.08) rotate(-4deg)}
.mb-crest img{width:80%;height:80%;object-fit:contain}
.mb-ini{position:absolute;font:800 40px "Barlow Condensed",sans-serif;color:#111}
.mb-crest img ~ .mb-ini{display:none}
.mb-name{font:800 clamp(24px,4.6vw,42px)/1 "Barlow Condensed",sans-serif;overflow-wrap:anywhere}
.mb-vs{width:60px;height:60px;border-radius:50%;display:grid;place-items:center;font:800 25px "Barlow Condensed",sans-serif;color:#111;background:linear-gradient(135deg,#ffe066,#F5C400 60%,#d9a400);animation:mbPulse 2.6s ease-out infinite}
.mb-info{display:flex;justify-content:center;flex-wrap:wrap;gap:8px 24px;margin-top:24px;padding-top:16px;border-top:1px solid rgba(255,255,255,.14);color:#EDE9D5;font-size:16px}
.mb-info span{display:inline-flex;align-items:center;gap:8px}
.mb-info svg{width:18px;height:18px;flex:none;stroke:var(--buoy);fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.mb-count{display:flex;justify-content:center;gap:10px;margin-top:18px;min-height:64px}
.mb-count div{min-width:66px;padding:9px 10px;border-radius:12px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.13)}
.mb-count b{display:block;font:800 30px/1 "Barlow Condensed",sans-serif;color:var(--buoy);font-variant-numeric:tabular-nums}
.mb-count small{font-size:12px;color:#BDB89F}
.mb-live{align-self:center;font:800 26px "Barlow Condensed",sans-serif;color:var(--buoy);animation:mbPulseT 1.4s ease-in-out infinite}
@keyframes mbIn{from{opacity:0;transform:translateY(20px)}}
@keyframes mbFloat{50%{transform:translateY(-7px)}}
@keyframes mbShine{0%,55%{left:-60%}100%{left:135%}}
@keyframes mbPulse{0%{box-shadow:0 0 0 0 rgba(245,196,0,.55)}100%{box-shadow:0 0 0 20px rgba(245,196,0,0)}}
@keyframes mbPulseT{50%{opacity:.45}}
@media (max-width:600px){.mb-teams{grid-template-columns:1fr;gap:12px}.mb-crest{width:96px;height:96px}.mb-vs{width:48px;height:48px;font-size:20px}.mb-count div{min-width:58px}}
@media (prefers-reduced-motion:reduce){.board.mb,.board.mb::after,.mb-crest,.mb-vs,.mb-live{animation:none}}`;
  document.head.appendChild(css);
  const ICON = { cal: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
    clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    pin: '<svg viewBox="0 0 24 24"><path d="M12 21s7-6.2 7-11a7 7 0 0 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>' };
  const crest = n => n === 'Marina'
    ? '<div class="mb-crest"><img alt="" src="assets/logo.png"></div>'
    : `<div class="mb-crest"><img alt="" data-base="assets/loghi/${slug(n)}." data-ex="svg,webp,jpg" src="assets/loghi/${slug(n)}.png" onerror="__crest(this)"><span class="mb-ini" aria-hidden="true">${esc(ini(n))}</span></div>`;
  let timer;
  window.__board = ({ g, h, a, t, day, venue }) => {
    const el = document.querySelector('.board'); if (!el) return;
    const when = new Date(`${day}T${t}:00`);
    const dateTxt = when.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    el.className = 'board mb';
    el.setAttribute('aria-label', `Prossima partita: ${h} contro ${a}`);
    el.innerHTML = `<div class="mb-chips"><span class="mb-chip">Seconda Categoria · ${g}ª giornata</span><span class="mb-chip">${h === 'Marina' ? 'In casa' : 'In trasferta'}</span></div>
<div class="mb-teams"><div class="mb-team${h === 'Marina' ? ' us' : ''}">${crest(h)}<div class="mb-name">${esc(h)}</div></div><div class="mb-vs" aria-hidden="true">VS</div><div class="mb-team${a === 'Marina' ? ' us' : ''}">${crest(a)}<div class="mb-name">${esc(a)}</div></div></div>
<div class="mb-info"><span>${ICON.cal}${esc(dateTxt)}</span><span>${ICON.clock}ore ${esc(t)}</span>${venue ? `<span>${ICON.pin}Campo ${esc(venue)}</span>` : ''}</div>
<div class="mb-count" id="mb-count"></div>`;
    clearInterval(timer);
    const box = (v, l) => `<div><b>${String(v).padStart(2, '0')}</b><small>${l}</small></div>`;
    const tick = () => {
      const c = document.getElementById('mb-count'); if (!c) return clearInterval(timer);
      const ms = when - new Date();
      if (ms > 0) { const s = Math.floor(ms / 1000); c.innerHTML = box(Math.floor(s / 86400), 'giorni') + box(Math.floor(s % 86400 / 3600), 'ore') + box(Math.floor(s % 3600 / 60), 'minuti') + box(s % 60, 'secondi'); }
      else if (ms > -2 * 3600e3) c.innerHTML = '<span class="mb-live">Si gioca ora</span>';
      else { c.innerHTML = ''; clearInterval(timer); }
    };
    tick(); timer = setInterval(tick, 1000);
  };
})();

(async () => {
const $ = id => document.getElementById(id);
const TEAMS = ["Alta Maremma","Amiata","Campagnatico Arcille","Capalbio","Castiglionese","Cinigiano","Fonteblanda","Intercomunale Santa Fiora","Magliano Sant'Andrea","Manciano Marsiliana","Marina","Montieri","Paganico","Ribolla","Sorano","Sticciano"];
const DATES = ["2026-09-20","2026-09-27","2026-10-04","2026-10-11","2026-10-18","2026-10-25","2026-11-01","2026-11-08","2026-11-15","2026-11-22","2026-11-29","2026-12-06","2026-12-13","2026-12-20","2027-01-03","2027-01-10","2027-01-17","2027-01-24","2027-01-31","2027-02-07","2027-02-14","2027-02-21","2027-02-28","2027-03-07","2027-03-14","2027-04-04","2027-04-11","2027-04-18","2027-04-25","2027-05-02"];
const VENUE = {"Alta Maremma":"Cecchi Gori, Roccatederighi","Amiata":"Campolmi, Abbadia San Salvatore","Campagnatico Arcille":"Arcille, Campagnatico","Capalbio":"Tronchetti, Capalbio","Castiglionese":"Valdrighi, Castiglione della Pescaia","Cinigiano":"Parco La Croce, Cinigiano","Fonteblanda":"Armenti, Fonteblanda","Intercomunale Santa Fiora":"Santa Fiora","Magliano Sant'Andrea":"S.Andrea in Civilesco, Magliano in Toscana","Manciano Marsiliana":"Niccolai, Manciano","Marina":"Cherubini, Il Cristo (Marina di Grosseto)","Montieri":"Montieri","Paganico":"Uzielli, Civitella Paganico","Ribolla":"Scirea, Ribolla","Sorano":"Stadio dei Pini, Sorano","Sticciano":"Baretti, Sticciano Scalo"};
let d;
try { const r = await fetch('data.json', {cache: 'no-store'}); if (!r.ok) return; d = await r.json(); } catch (e) { return; }
const R = d.results || [];
let C = {};
try { const rc = await fetch('campi.json', {cache: 'no-store'}); if (rc.ok) C = await rc.json(); } catch (e) {}
if (!R.length) return;
const fmt = iso => new Date(iso + 'T12:00:00').toLocaleDateString('it-IT', {weekday:'long', day:'numeric', month:'long', year:'numeric'});
const dt = g => fmt(DATES[g-1]);
const info = (g, h, a) => (d.matches || []).find(x => x.g === g && x.h === h && x.a === a) || {};
const cap = s => s.toLowerCase().replace(/(^|[\s.'(-])(\p{L})/gu, (m, x, y) => x + y.toUpperCase()).replace(/ (In|Di|Del|Della|Da) /g, c => c.toLowerCase());
const S = {};
TEAMS.forEach(n => S[n] = {n, pt:0, g:0, v:0, x:0, p:0, gf:0, gs:0});
for (const m of R) {
  const a = S[m.h], b = S[m.a]; if (!a || !b) continue;
  a.g++; b.g++; a.gf += m.hg; a.gs += m.ag; b.gf += m.ag; b.gs += m.hg;
  if (m.hg > m.ag) { a.v++; a.pt += 3; b.p++; }
  else if (m.hg < m.ag) { b.v++; b.pt += 3; a.p++; }
  else { a.x++; b.x++; a.pt++; b.pt++; }
}
const rows = Object.values(S).sort((x, y) => y.pt - x.pt || (y.gf - y.gs) - (x.gf - x.gs) || y.gf - x.gf || x.n.localeCompare(y.n, 'it'));
$('std-body').innerHTML = rows.map((t, i) => `<tr${t.n === 'Marina' ? ' class="us"' : ''}><td>${i+1}</td><td>${t.n}</td><td>${t.pt}</td><td>${t.g}</td><td>${t.v}</td><td>${t.x}</td><td>${t.p}</td></tr>`).join('');
const last = Math.max(...R.map(m => m.g));
$('res-title').textContent = last + 'ª giornata';
$('res-date').textContent = dt(last) + ', Seconda Categoria girone M.';
$('res-list').innerHTML = R.filter(m => m.g === last).map(m => `<div><span>${m.h}</span><b>${m.hg} – ${m.ag}</b><span>${m.a}</span></div>`).join('');
$('std-note').textContent = 'Dopo la ' + last + 'ª giornata.';
$('res-note').textContent = d.updated ? 'Aggiornato il ' + new Date(d.updated).toLocaleString('it-IT', {dateStyle:'long', timeStyle:'short'}) : '';
let next = null;
[...$('cal-body').rows].forEach(tr => {
  tr.className = '';
  const g = +tr.cells[0].textContent;
  const [h, a] = tr.cells[3].textContent.split(' – ').map(s => s.replace(/ \(.*\)$/, ''));
  const m = R.find(x => x.g === g && x.h === h && x.a === a);
  if (m) tr.cells[3].innerHTML = `${h} – ${a} <b>(${m.hg}–${m.ag})</b>`;
  else { const i = info(g, h, a); const day = i.date || DATES[g-1]; if (!next && new Date(day + 'T23:59:59') >= new Date()) { next = {g, h, a, t: i.time || tr.cells[2].textContent, day, venue: i.venue ? cap(i.venue) : (VENUE[h] || '')}; tr.className = 'us'; } }
});
if (next) {
  if (window.__board) window.__board({ ...next, venue: C[next.g] || next.venue });
  else {
  $('b-h').textContent = next.h; $('b-a').textContent = next.a;
  $('b-meta').textContent = `${fmt(next.day)}, ore ${next.t} · Campo ${C[next.g] || next.venue} · Seconda Categoria, ${next.g}ª giornata`;
  }
}
})();
