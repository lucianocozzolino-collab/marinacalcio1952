const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const say = t => { $('msg').textContent = t || ''; };
window.addEventListener('unhandledrejection', e => say('Errore: ' + ((e.reason && e.reason.message) || e.reason)));
const show = id => ['v-auth', 'v-wait', 'v-app'].forEach(x => { $(x).hidden = x !== id; });
const key = n => String(n).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f']/g, '').split(/\s+/).filter(Boolean).sort().join(' ');
const TEAMS = ["Alta Maremma","Amiata","Campagnatico Arcille","Capalbio","Castiglionese","Cinigiano","Fonteblanda","Intercomunale Santa Fiora","Magliano Sant'Andrea","Manciano Marsiliana","Marina","Montieri","Paganico","Ribolla","Sorano","Sticciano"];
const ROSTER_DEFAULT = [{"gruppo":"Giocatori","persone":[{"nome":"Davide Leandri","ruolo":"Portiere"},{"nome":"Moussa Leye","ruolo":"Portiere"},{"nome":"Andrea Guerriero","ruolo":"Difensore"},{"nome":"Edoardo Tozzi","ruolo":"Difensore"},{"nome":"Jacopo Trombini","ruolo":"Difensore"},{"nome":"Leonardo Caporali","ruolo":"Difensore"},{"nome":"Leonardo Ciacci","ruolo":"Difensore"},{"nome":"Lorenzo Gambineri","ruolo":"Difensore"},{"nome":"Niccolò Tropi","ruolo":"Difensore"},{"nome":"Andrea Coppolecchia","ruolo":"Centrocampista"},{"nome":"Daniele Comitale","ruolo":"Centrocampista"},{"nome":"Diego Cappelli","ruolo":"Centrocampista"},{"nome":"Gabriele Coppolecchia","ruolo":"Centrocampista"},{"nome":"Gabriele Ruggiero","ruolo":"Centrocampista"},{"nome":"Giacomo Briaschi","ruolo":"Centrocampista"},{"nome":"Matteo Menini","ruolo":"Centrocampista"},{"nome":"Niccolò Chinellato","ruolo":"Centrocampista"},{"nome":"Riccardo Naldi","ruolo":"Centrocampista"},{"nome":"Tommaso Balestri","ruolo":"Centrocampista"},{"nome":"Andrea Cervetti","ruolo":"Attaccante"},{"nome":"Danilo Maiorano","ruolo":"Attaccante"},{"nome":"Francesco Felici","ruolo":"Attaccante"},{"nome":"Matteo Felici","ruolo":"Attaccante"},{"nome":"Michele Corradi","ruolo":"Attaccante"},{"nome":"Nicola Sglavo","ruolo":"Attaccante"},{"nome":"Stefano Colli","ruolo":"Attaccante"}]},{"gruppo":"Staff tecnico","persone":[{"nome":"Gianluca Chinellato","ruolo":"Allenatore"},{"nome":"Paolo Chinellato","ruolo":"Direttore sportivo"},{"nome":"Luigi Forni","ruolo":"Preparatore atletico"},{"nome":"Marco Bertini","ruolo":"Preparatore portieri"},{"nome":"Pietro Corradi","ruolo":"Preparatore portieri"}]},{"gruppo":"Dirigenza","persone":[{"nome":"Mirko Di Gesaro","ruolo":"Presidente"},{"nome":"Gian Franco Ingrasciotta","ruolo":"Vicepresidente"},{"nome":"Teresa Fabbozzo","ruolo":"Segretario generale"},{"nome":"Alberto Ortaggi","ruolo":"Dirigente"},{"nome":"Roberto Cassani","ruolo":"Dirigente"},{"nome":"Daniele Rossi","ruolo":"Dirigente"},{"nome":"Leonardo Coccioloni","ruolo":"Dirigente"},{"nome":"Luciano Cozzolino","ruolo":"Dirigente"},{"nome":"Lorenzo Ingrasciotta","ruolo":"Dirigente"},{"nome":"Renato Ingrasciotta","ruolo":"Dirigente"}]}];
const RUOLO = { calciatore: 'Calciatore', allenatore: 'Allenatore', dirigente: 'Dirigente', massaggiatore: 'Massaggiatore', societa: 'Società' };
const fmt = d => d ? new Date(d + 'T12:00:00').toLocaleDateString('it-IT') : '—';

if (!window.CFG || CFG.url.startsWith('INCOLLA')) { say('Configurazione mancante: compila assets/config.js.'); throw new Error('config'); }
const sb = supabase.createClient(CFG.url, CFG.key);

async function init() {
  say('');
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return show('v-auth');
  const { data: p } = await sb.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
  if (!p) return show('v-auth');
  if (!p.approved) return show('v-wait');
  show('v-app');
  $('who').textContent = (p.nome || p.email) + (p.is_admin ? ' · amministratore' : '');
  try { await loadData(); } catch (e) { say('Errore nel caricamento dei dati: ' + e.message); }
  if (p.is_admin) loadUsers();
}

$('f-login').onsubmit = async e => {
  e.preventDefault();
  const { error } = await sb.auth.signInWithPassword({ email: $('l-email').value.trim(), password: $('l-pass').value });
  if (error) say('Accesso non riuscito: ' + error.message); else init();
};
$('f-reg').onsubmit = async e => {
  e.preventDefault();
  const { data, error } = await sb.auth.signUp({ email: $('r-email').value.trim(), password: $('r-pass').value, options: { data: { nome: $('r-nome').value.trim() } } });
  if (error) return say('Registrazione non riuscita: ' + error.message);
  say(data.session ? 'Registrazione inviata: attendi l\'approvazione dell\'amministratore.' : 'Registrazione inviata. Conferma l\'email (se ti è arrivato il messaggio) e attendi l\'approvazione dell\'amministratore.');
  if (data.session) init();
};
document.addEventListener('click', async e => {
  if (e.target.matches('[data-out]')) { await sb.auth.signOut(); init(); }
  const b = e.target.closest('[data-appr]');
  if (b) { await sb.from('profiles').update({ approved: b.dataset.appr === '1' }).eq('id', b.dataset.id); loadUsers(); }
});

let DATA = null;
async function loadData() {
  const [a, b, roster] = await Promise.all([
    sb.from('provvedimenti').select('*').eq('prima_squadra', true).order('gara_data', { ascending: false }),
    sb.from('cu_processati').select('*').order('numero', { ascending: false }),
    fetch('roster.json').then(r => r.ok ? r.json() : ROSTER_DEFAULT).catch(() => ROSTER_DEFAULT)
  ]);
  if (a.error || b.error) return say('Errore nel caricamento dei dati: ' + (a.error || b.error).message);
  DATA = { rows: a.data, cu: b.data, roster };
  render();
}

function render() {
  const { cu, roster } = DATA;
  const all = DATA.rows;
  const rows = all.filter(r => r.squadra === 'Marina');
  const by = {};
  rows.forEach(r => (by[r.categoria === 'societa' ? '#soc' : key(r.nome)] ||= []).push(r));
  const people = [], known = new Set();
  roster.forEach(g => g.persone.forEach(p => { const k = key(p.nome); known.add(k); people.push({ nome: p.nome, ruolo: p.ruolo, rows: by[k] || [] }); }));
  Object.keys(by).filter(k => k !== '#soc' && !known.has(k)).forEach(k => people.push({ nome: by[k][0].nome, ruolo: by[k][0].categoria + ' (non in elenco)', rows: by[k] }));
  people.push({ nome: 'Società Marina Calcio', ruolo: 'Società', rows: by['#soc'] || [] });

  const only = $('only').checked;
  $('tb').innerHTML = people.filter(p => !only || p.rows.length).map(p => {
    const am = p.rows.filter(r => r.tipo === 'ammonizione').length;
    const es = p.rows.filter(r => r.tipo === 'espulsione').length;
    const al = p.rows.length - am - es;
    const det = p.rows.length ? `<details><summary>${p.rows.length} voce${p.rows.length > 1 ? 'i' : ''}</summary><ul>${p.rows.map(r =>
      `<li>${fmt(r.gara_data)} · ${esc(r.competizione)} · ${esc(r.sanzione)}${r.motivo ? ' — ' + esc(r.motivo) : ''} <a href="${esc(r.cu_url)}" rel="noopener">CU ${r.cu_numero}</a></li>`).join('')}</ul></details>` : '<span class="z">—</span>';
    const c = v => v ? `<b>${v}</b>` : '<span class="z">0</span>';
    return `<tr${p.rows.length ? ' class="us"' : ''}><td>${esc(p.nome)}</td><td>${esc(p.ruolo)}</td><td class="n">${c(am)}</td><td class="n">${c(es)}</td><td class="n">${c(al)}</td><td>${det}</td></tr>`;
  }).join('');

  const last = cu[0];
  const gir = all.filter(r => r.competizione.startsWith('SECONDA CATEGORIA'));
  $('kpi').innerHTML = `<div class="card"><b>${rows.length}</b>provvedimenti a carico del Marina Calcio</div>
    <div class="card"><b>${gir.length}</b>provvedimenti nel girone M</div>
    <div class="card"><b>${cu.length}</b>comunicati esaminati${last ? ' (ultimo: CU ' + last.numero + ' del ' + fmt(last.data) + ')' : ''}</div>`;
  renderTeams(all);
  $('cu').innerHTML = cu.map(c => `<tr><td><a href="${esc(c.url)}" rel="noopener">CU ${c.numero}</a></td><td>${fmt(c.data)}</td><td class="n">${c.letti ?? '—'}</td><td class="n">${c.trovati ?? 0}</td></tr>`).join('');
}
$('only').onchange = () => DATA && render();

function renderTeams(all) {
  const gir = all.filter(r => r.competizione.startsWith('SECONDA CATEGORIA'));
  const of = t => gir.filter(r => r.squadra === t);
  $('sum').innerHTML = TEAMS.map(t => {
    const r = of(t), c = k => r.filter(x => k(x.categoria)).length;
    const cal = c(k => k === 'calciatore'), st = c(k => ['allenatore', 'dirigente', 'massaggiatore'].includes(k)), am = c(k => k === 'societa');
    const n = v => v ? `<b>${v}</b>` : '<span class="z">0</span>';
    return `<tr${t === 'Marina' ? ' class="us"' : ''}><td>${esc(t)}</td><td class="n">${n(cal)}</td><td class="n">${n(st)}</td><td class="n">${n(am)}</td><td class="n">${n(r.length)}</td></tr>`;
  }).join('');
  $('teams').innerHTML = TEAMS.map(t => {
    const r = of(t);
    const body = r.length ? `<div class="scroll"><table><thead><tr><th>Nome</th><th>Ruolo</th><th>Provvedimento</th><th>Gara</th><th>Motivo</th><th>CU</th></tr></thead><tbody>${r.map(x =>
      `<tr><td>${esc(x.categoria === 'societa' ? 'Società' : x.nome)}</td><td>${RUOLO[x.categoria] || esc(x.categoria)}</td><td>${x.tipo === 'espulsione' ? 'Espulso · ' : ''}${esc(x.sanzione)}</td><td>${fmt(x.gara_data)}</td><td>${esc(x.motivo || '—')}</td><td><a href="${esc(x.cu_url)}" rel="noopener">CU ${x.cu_numero}</a></td></tr>`).join('')}</tbody></table></div>` : '';
    return `<details class="tm"${r.length ? ' open' : ''}><summary><b>${esc(t)}</b> <span class="z">· ${r.length ? r.length + (r.length > 1 ? ' provvedimenti' : ' provvedimento') : 'nessun provvedimento'}</span></summary>${body}</details>`;
  }).join('');
}

async function loadUsers() {
  $('admin').hidden = false;
  const { data, error } = await sb.from('profiles').select('*').order('created_at', { ascending: false });
  if (error) return;
  $('users').innerHTML = data.map(u => `<tr><td>${esc(u.nome || '')}</td><td>${esc(u.email)}</td><td>${u.approved ? 'Approvato' : '<b>In attesa</b>'}${u.is_admin ? ' · admin' : ''}</td>
    <td>${u.is_admin ? '' : `<button class="${u.approved ? 'sec' : ''}" data-id="${u.id}" data-appr="${u.approved ? 0 : 1}">${u.approved ? 'Revoca' : 'Approva'}</button>`}</td></tr>`).join('');
}
sb.auth.onAuthStateChange(() => {});
init();
