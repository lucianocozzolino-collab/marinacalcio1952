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
.pl img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center 20%}
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
        + (sponsor ? `<p style="margin:22px 0 0;color:var(--mute)">Main sponsor: <b style="color:var(--ink)">${esc(sponsor)}</b></p>` : '');
    }
  } catch (e) { /* resta la versione con i nomi */ }
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
  $('b-h').textContent = next.h; $('b-a').textContent = next.a;
  $('b-meta').textContent = `${fmt(next.day)}, ore ${next.t} · Campo ${C[next.g] || next.venue} · Seconda Categoria, ${next.g}ª giornata`;
}
})();
