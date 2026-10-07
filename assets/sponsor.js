const $ = id => document.getElementById(id);
const f = $('f'), msg = $('msg');
if (!window.CFG || String(CFG.url).startsWith('INCOLLA')) {
  f.hidden = true; msg.textContent = 'Il modulo non è ancora attivo: scrivici dalla sezione Contatti del sito.';
} else {
  const sb = supabase.createClient(CFG.url, CFG.key);
  f.onsubmit = async e => {
    e.preventDefault();
    if ($('web').value) return;                       // campo trappola per i robot
    const btn = f.querySelector('button'); btn.disabled = true; msg.textContent = 'Invio in corso…';
    const { error } = await sb.from('richieste_contatto').insert({
      tipo: 'sponsor', nome: $('nome').value.trim(), email: $('email').value.trim(),
      telefono: $('tel').value.trim() || null, messaggio: $('msgtxt').value.trim() });
    if (error) { btn.disabled = false; msg.textContent = 'Invio non riuscito: controlla i dati e riprova, oppure scrivici dalla sezione Contatti.'; return; }
    f.hidden = true; $('ok').hidden = false; msg.textContent = '';
  };
}
