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
import unicodedata
import base64

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
URL = "https://gare.lnd.it/competizione/toscana?campionato=2C&giornata={g}&girone=M&leg=first&stagione=2026"
LOGHI = ROOT / "assets" / "loghi"
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

MESI = {"GEN": 1, "FEB": 2, "MAR": 3, "APR": 4, "MAG": 5, "GIU": 6, "LUG": 7, "AGO": 8, "SET": 9, "OTT": 10, "NOV": 11, "DIC": 12}
DATE_RE = re.compile(r"^(\d{1,2}) ([A-Z]{3}) (\d{4})$")
TIME_RE = re.compile(r"ORE\s*(\d{1,2}):(\d{2})")


def team_of(line):
    return ALIAS.get(norm(line).strip())


def parse_blocks(text):
    """Legge i blocchi 'data - ora - campo - casa - risultato - ospite' (anche per le partite da giocare)."""
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    starts = [i for i, l in enumerate(lines) if DATE_RE.match(l.upper())]
    end_all = next((i for i, l in enumerate(lines) if l.upper() == "CLASSIFICA"), len(lines))
    out = []
    for k, i in enumerate(starts):
        j = starts[k + 1] if k + 1 < len(starts) else end_all
        blk = lines[i:j]
        d = DATE_RE.match(blk[0].upper())
        if not d or d[2] not in MESI:
            continue
        iso = f"{int(d[3]):04d}-{MESI[d[2]]:02d}-{int(d[1]):02d}"
        ore = next((n for n, l in enumerate(blk) if TIME_RE.search(l.upper())), None)
        if ore is None:
            continue
        t = TIME_RE.search(blk[ore].upper())
        teams = [n for n, l in enumerate(blk) if n > ore and team_of(l)]
        if len(teams) < 2:
            continue
        hi, ai = teams[-2], teams[-1]
        venue = blk[ore + 1] if ore + 1 < hi else None
        nums = [int(l) for l in blk[hi + 1:ai] if l.isdigit()]
        m = {"h": team_of(blk[hi]), "a": team_of(blk[ai]), "date": iso, "time": f"{int(t[1]):02d}:{t[2]}",
             "venue": venue, "hg": None, "ag": None}
        if len(nums) == 2:
            m["hg"], m["ag"] = nums
        if m["h"] != m["a"]:
            out.append(m)
    return out

def slug(n):
    n = unicodedata.normalize("NFD", n.lower()).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", n).strip("-")


JS_IMGS = """() => [...document.querySelectorAll('img')].map(i => {
  let t = '', n = i;
  for (let k = 0; k < 4 && n; k++, n = n.parentElement) { const s = (n.innerText || '').trim(); if (s && s.length < 70) { t = s; break; } }
  return {src: i.currentSrc || i.src || '', alt: i.alt || '', title: i.title || '', text: t};
})"""
EXT = {"image/png": "png", "image/svg+xml": "svg", "image/webp": "webp", "image/jpeg": "jpg"}


def grab_logos(page, ctx, done, cands):
    """Scarica gli stemmi delle squadre del girone dalla pagina gia' aperta (una volta sola per squadra)."""
    for im in page.evaluate(JS_IMGS):
        cands.append(im)
        fields = [im["alt"], im["title"]] + im["text"].splitlines()
        team = next((ALIAS.get(norm(f).strip()) for f in fields if ALIAS.get(norm(f).strip())), None)
        if not team or team == "Marina" or team in done or not im["src"]:
            continue
        try:
            if im["src"].startswith("data:image/"):
                head, b64 = im["src"].split(",", 1)
                body, ctype = base64.b64decode(b64), head[5:].split(";")[0]
            else:
                r = ctx.request.get(im["src"], timeout=30000)
                if not r.ok:
                    continue
                body, ctype = r.body(), (r.headers.get("content-type") or "").split(";")[0]
        except Exception as e:
            print("logo non scaricato:", team, e)
            continue
        ext = EXT.get(ctype)
        if not ext or not 200 < len(body) < 400_000:
            continue
        LOGHI.mkdir(parents=True, exist_ok=True)
        (LOGHI / f"{slug(team)}.{ext}").write_bytes(body)
        done.add(team)
        print("logo salvato:", team, ext)


def main():
    data_file = ROOT / "data.json"
    old = json.loads(data_file.read_text("utf-8")) if data_file.exists() else {"results": []}
    known = {(r["g"], r["h"], r["a"]): r for r in old["results"]}
    info = {(r["g"], r["h"], r["a"]): r for r in old.get("matches", [])}
    today = dt.date.today()
    rounds = [g for g in range(1, 31) if dt.date.fromisoformat(DATES[g - 1]) <= today + dt.timedelta(days=7)]
    debug = ROOT / "debug"
    found_any = False
    done_logos = {n for n in TEAMS if n != "Marina" and any(LOGHI.glob(slug(n) + ".*"))}
    cands = []

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
            if len(done_logos) < len(TEAMS) - 1:
                try:
                    grab_logos(page, ctx, done_logos, cands)
                except Exception as e:
                    print("loghi:", e)
            blocks = parse_blocks(text)
            res = {(b["h"], b["a"]): (b["hg"], b["ag"]) for b in blocks if b["hg"] is not None} if blocks else parse(text)
            print(f"giornata {g}: {len(blocks)} partite, {len(res)} risultati")
            for b in blocks:
                info[(g, b["h"], b["a"])] = {"g": g, "h": b["h"], "a": b["a"], "date": b["date"], "time": b["time"], "venue": b["venue"]}
            if DEBUG or not res:
                debug.mkdir(exist_ok=True)
                (debug / f"giornata_{g}.txt").write_text(text, "utf-8")
                (debug / f"giornata_{g}_net.json").write_text(json.dumps(net, ensure_ascii=False)[:2000000], "utf-8")
            for (h, a), (hg, ag) in res.items():
                known[(g, h, a)] = {"g": g, "h": h, "a": a, "hg": hg, "ag": ag}
                found_any = True
            page.close()
        browser.close()
    if DEBUG and cands:
        debug.mkdir(exist_ok=True)
        (debug / "loghi_candidati.json").write_text(json.dumps(cands[:200], ensure_ascii=False, indent=1), "utf-8")
    print("stemmi presenti:", len(done_logos), "su", len(TEAMS) - 1)

    results = sorted(known.values(), key=lambda r: (r["g"], r["h"]))
    matches = sorted(info.values(), key=lambda r: (r["g"], r["h"]))
    if results != old["results"] or matches != old.get("matches", []):
        data_file.write_text(json.dumps({"updated": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
                                         "results": results, "matches": matches}, ensure_ascii=False, indent=1), "utf-8")
        print("data.json aggiornato")
    elif not found_any:
        print("Nessun risultato letto: controlla gli artifact 'debug' del workflow.")


if __name__ == "__main__":
    main()
