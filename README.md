# Marina Calcio – sito

Sito statico (GitHub Pages). I risultati stanno in `data.json`; classifica, ultima giornata,
calendario e prossima partita si calcolano da lì nel browser (`assets/app.js`).

## Pubblicare su GitHub Pages
1. Crea un repository e carica tutto il contenuto di questa cartella (compresa `.github`).
2. Settings → Pages → *Deploy from a branch* → `main` / `/ (root)`.
3. Dopo un minuto il sito è su `https://TUO-UTENTE.github.io/NOME-REPO/`.

## Aggiornamento dei risultati
- **A mano:** modifica `data.json` dal sito di GitHub (matita) e aggiungi una riga
  `{"g": 2, "h": "Marina", "a": "Alta Maremma", "hg": 0, "ag": 0}`. Nomi come nella classifica.
- **Automatico:** il workflow *Aggiorna risultati* (Actions) apre le pagine di gare.lnd.it con un
  browser headless e aggiorna `data.json` ogni ora nel weekend. Lancialo la prima volta con
  *Run workflow* e `debug = true`: se non legge nulla, scarica l'artifact `debug` e mandamelo
  per adattare il lettore.

Nota: rispetta i termini di uso del portale LND e non aumentare la frequenza delle richieste.
