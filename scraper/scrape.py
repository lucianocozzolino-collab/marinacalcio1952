"""Legge i risultati del girone M dal portale ufficiale LND (gare.lnd.it) e aggiorna data.json.

La pagina si costruisce con JavaScript, quindi usiamo un browser headless (Playwright).
Dal testo visibile cerchiamo "SQUADRA n - n SQUADRA" per le 16 squadre del girone.
Con DEBUG=true salva testo e risposte JSON delle pagine in debug/ per poter aggiustare il lettore.
"""
import datetime as dt
import json
import os
import pathlib
import re

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
URL = "https://gare.lnd.it/competizione/toscana?campionato=2C&giornata={g}&girone=M&leg=first&stagione=2026"
DEBUG = os.environ.get("DEBUG", "").lower() == "true"

DATES = ["2026-09-20", "2026-09-27", "2026-10-04", "2026-10-11", "2026-10-18", "2026-10-25", "2026-11-01",
         "2026-11-08", "2026-11-15", "2026-11-22", "2026-11-29", "2026-12-06", "2026-12-13", "2026-12-20",
         "2027-01-03", "2027-01-10", "2027-01-17", "2027-01-24", "2027-01-31", "2027-02-07", "2027-02-14",
         "2027-02-21", "2027-02-28", "2027-03-07", "2027-03-14", "2027-04-04", "2027-04-11", "2027-04-18",
         "2027-04-25", "2027-05-02"]

# nome mostrato nel sito -> varianti del nome sul portale (senza punteggiatura, maiuscolo)
TEAMS = {
    "Alta Maremma": ["ALTA MAREMMA"],
    "Amiata": ["AMIATA"],
    "Campagnatico Arcille": ["CAMPAGNATICO ARCILLE", "CAMPAGNATICO"],
    "Capalbio": ["CAPALBIO CALCIO", "CAPALBIO"],
    "Castiglionese": ["CASTIGLIONESE"],
    "Cinigiano": ["CINIGIANO"],
    "Fonteblanda": ["FONTEBLANDA"],
    "Intercomunale Santa Fiora": ["INTERCOMUNALE S FIORA", "INTERCOMUNALE SFIORA", "INTERCOMUNALE SANTA FIORA", "INTERCOMUNALE"],
    "Magliano Sant'Andrea": ["MAGLIANO SANTANDREA", "MAGLIANO SANT ANDREA", "MAGLIANO"],
    "Manciano Marsiliana": ["MANCIANOMARSILIANA", "MANCIANO MARSILIANA", "MANCIANO"],
    "Marina": ["MARINA CALCIO", "MARINA"],
    "Montieri": ["MONTIERI"],
    "Paganico": ["PAGANICO"],
    "Ribolla": ["RIBOLLA"],
    "Sorano": ["SORANO"],
    "Sticciano": ["AQUILE STICCIANO", "STICCIANO"],
}
ALIAS = {a: name for name, al in TEAMS.items() for a in al}
N = "|".join(re.escape(a) for a in sorted(ALIAS, key=len, reverse=True))
P1 = re.compile(rf"(?<![A-Z0-9])({N})\s+(\d{{1,2}})\s*-\s*(\d{{1,2}})\s+({N})(?![A-Z0-9])")
P2 = re.compile(rf"(?<![A-Z0-9])({N})\s+({N})\s+(\d{{1,2}})\s*-\s*(\d{{1,2}})(?!\d)")
P3 = re.compile(rf"(?<![A-Z0-9])({N})\s+(\d{{1,2}})\s+({N})\s+(\d{{1,2}})(?![A-Z0-9\d])")


def norm(text):
    t = text.upper().replace("–", "-").replace("—", "-")
    t = re.sub(r"[^A-Z0-9\-]+", " ", t)
    t = re.sub(r"\b(A S D|ASD)\b", " ", t)
    return re.sub(r"\s+", " ", t)


def parse(text):
    t = norm(text)
    out = {(ALIAS[m[1]], ALIAS[m[4]]): (int(m[2]), int(m[3])) for m in P1.finditer(t)}
    if not out:  # layout alternativi, solo se il principale non trova nulla
        out = {(ALIAS[m[1]], ALIAS[m[2]]): (int(m[3]), int(m[4])) for m in P2.finditer(t)}
    if not out:
        out = {(ALIAS[m[1]], ALIAS[m[3]]): (int(m[2]), int(m[4])) for m in P3.finditer(t)}
    seen, clean = set(), {}
    for (h, a), sc in out.items():  # una squadra gioca una sola partita a giornata
        if h != a and h not in seen and a not in seen:
            clean[(h, a)] = sc
            seen.update((h, a))
    return clean


def main():
    data_file = ROOT / "data.json"
    old = json.loads(data_file.read_text("utf-8")) if data_file.exists() else {"results": []}
    known = {(r["g"], r["h"], r["a"]): r for r in old["results"]}
    today = dt.date.today()
    rounds = [g for g in range(1, 31) if dt.date.fromisoformat(DATES[g - 1]) <= today + dt.timedelta(days=1)]
    debug = ROOT / "debug"
    found_any = False

    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(locale="it-IT", viewport={"width": 1400, "height": 2000})
        for g in rounds:
            page = ctx.new_page()
            net = []

            def on_response(r):
                try:
                    if "json" in (r.headers.get("content-type") or ""):
                        net.append({"url": r.url, "body": r.text()[:200000]})
                except Exception:
                    pass

            page.on("response", on_response)
            try:
                page.goto(URL.format(g=g), wait_until="networkidle", timeout=60000)
                page.wait_for_timeout(1500)
                text = page.inner_text("body")
            except Exception as e:
                print(f"giornata {g}: errore {e}")
                page.close()
                continue
            res = parse(text)
            print(f"giornata {g}: {len(res)} risultati")
            if DEBUG or not res:
                debug.mkdir(exist_ok=True)
                (debug / f"giornata_{g}.txt").write_text(text, "utf-8")
                (debug / f"giornata_{g}_net.json").write_text(json.dumps(net, ensure_ascii=False)[:2000000], "utf-8")
            for (h, a), (hg, ag) in res.items():
                known[(g, h, a)] = {"g": g, "h": h, "a": a, "hg": hg, "ag": ag}
                found_any = True
            page.close()
        browser.close()

    results = sorted(known.values(), key=lambda r: (r["g"], r["h"]))
    if results != old["results"]:
        data_file.write_text(json.dumps({"updated": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
                                         "results": results}, ensure_ascii=False, indent=1), "utf-8")
        print("data.json aggiornato")
    elif not found_any:
        print("Nessun risultato letto: controlla gli artifact 'debug' del workflow.")


if __name__ == "__main__":
    main()
