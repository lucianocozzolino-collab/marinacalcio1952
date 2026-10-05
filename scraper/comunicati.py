"""Legge i comunicati ufficiali del CRT Toscana (sezione Giudice Sportivo) e salva su Supabase
i provvedimenti riferiti al Marina Calcio. Variabili: SUPABASE_URL, SUPABASE_SERVICE_KEY, DEBUG, START_DATE."""
import datetime as dt
import io
import logging
import os
import re
import sys

import requests
from pypdf import PdfReader

LIST_URLS = ["https://toscana.lnd.it/comunicati-regionali/?delegazione=comitato-regionale&stagione=2026/2027",
             "https://toscana.lnd.it/comunicati-regionali/page/2/?stagione=2026/2027"]
logging.getLogger("pypdf").setLevel(logging.ERROR)  # niente avvisi sui font
START = dt.date.fromisoformat(os.environ.get("START_DATE", "2026-09-19"))
DEBUG = os.environ.get("DEBUG", "").lower() == "true"
SB_URL = os.environ.get("SUPABASE_URL", "").strip().strip("'\"").rstrip("/")
SB_URL = SB_URL.removesuffix("/rest/v1")
SB_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "").strip().strip("'\"")
HEAD = {"User-Agent": "Mozilla/5.0 (MarinaCalcioBot; uso sportivo, richieste rade)"}

FIRST_TEAM = re.compile(r"^(ECCELLENZA|PROMOZIONE|PRIMA CATEGORIA|SECONDA CATEGORIA|TERZA CATEGORIA|COPPA (TOSCANA|ITALIA) (ECCELLENZA|PROMOZIONE|PRIMA|SECONDA|TERZA))")
COMP = re.compile(r"^(ECCELLENZA|PROMOZIONE|PRIMA CATEGORIA|SECONDA CATEGORIA|TERZA CATEGORIA|COPPA |JUNIORES|REGIONALE UNDER|UNDER \d|AMICHEVOLI|SERIE |CALCIO A)")
SUBCAT = {"SOCIETA": "societa", "DIRIGENTI": "dirigente", "ALLENATORI": "allenatore", "MASSAGGIATORI": "massaggiatore",
          "CALCIATORI ESPULSI": "calciatore", "CALCIATORI NON ESPULSI": "calciatore"}
DATE_G = re.compile(r"GARE DEL (\d{1,2})/\s*(\d{1,2})/(\d{4})")
FINO = re.compile(r"FINO AL (\d{1,2})/\s*(\d{1,2})/(\d{4})")
SANZ = re.compile(r"^(SQUALIFICA|INIBIZIONE|I AMMONIZIONE|AMMENDA)")
EURO = re.compile(r"^Euro\s+([\d.,]+)\s+(.+)$")
NAME = re.compile(r"([A-ZÀ-ÖØ-Þ][A-ZÀ-ÖØ-Þ'’.\- ]*?)\s*\(([^()]+)\)")


# Squadre del girone M di Seconda Categoria: nome nel comunicato (solo lettere, senza "A.S.D.") -> nome nel sito
GIRONE_M = {"ALTAMAREMMA": "Alta Maremma", "AMIATA": "Amiata", "CAMPAGNATICOARCILLE": "Campagnatico Arcille",
            "CAPALBIOCALCIO": "Capalbio", "CASTIGLIONESE": "Castiglionese", "CINIGIANO": "Cinigiano",
            "FONTEBLANDA": "Fonteblanda", "INTERCOMUNALESFIORA": "Intercomunale Santa Fiora",
            "MAGLIANOSANTANDREA": "Magliano Sant'Andrea", "MANCIANOMARSILIANA": "Manciano Marsiliana",
            "MARINACALCIO": "Marina", "MONTIERI": "Montieri", "PAGANICO": "Paganico", "RIBOLLA": "Ribolla",
            "SORANO": "Sorano", "STICCIANO": "Sticciano"}


def team_of(team, comp):
    """Nome sito della squadra se interessa: il Marina in qualsiasi competizione, le altre solo in Seconda Categoria."""
    k = re.sub(r"[^A-Z]", "", team.upper())
    k = k[:-3] if k.endswith("ASD") else k
    canon = GIRONE_M.get(k)
    if canon == "Marina" or (canon and comp.startswith("SECONDA CATEGORIA")):
        return canon
    return None


def is_marina(team):
    return team_of(team, "") == "Marina"


def mkdate(g, m, y):
    return dt.date(int(y), int(m), int(g)).isoformat()


def parse_gs(text, cu):
    """Ritorna (righe_marina, letti_totali) dalla sezione 'Decisioni Giudice Sportivo Territoriale'."""
    a = re.search(r"DECISIONI GIUDICE SPORTIVO TERRITORIALE\s*\n\s*Il Giudice Sportivo", text)
    if not a:
        return [], 0
    body = text[a.start():]
    b = re.search(r"DECISIONI DEL TRIBUNALE FEDERALE TERRITORIALE\s*\n\s*Il Tribunale", body)
    body = body[:b.start()] if b else body
    seduta = re.search(r"seduta del (\d{2})/(\d{2})/(\d{4})", body)
    seduta = mkdate(seduta[1], seduta[2], seduta[3]) if seduta else cu["data"]
    lines = [l.strip().replace("’", "'") for l in body.splitlines()]
    lines = [l for l in lines if l and not l.startswith("FIGC - LND")]

    rows, letti = [], 0
    comp, cat, sanz, fino, gara = "", "", "", None, seduta
    buf, pending = "", None

    def base(nome, squadra):
        t = "ammonizione" if sanz.startswith("I AMMONIZIONE") else "espulsione" if (cat == "calciatore" and ESP[0]) else \
            "ammenda" if sanz.startswith("AMMENDA") or cat == "societa" else "inibizione" if sanz.startswith("INIBIZIONE") else "squalifica"
        return {"cu_numero": cu["numero"], "cu_data": cu["data"], "cu_url": cu["url"], "competizione": comp,
                "prima_squadra": bool(FIRST_TEAM.match(comp)) and "FEMMINILE" not in comp, "gara_data": gara,
                "categoria": cat or "calciatore", "squadra": squadra, "nome": nome, "tipo": t, "sanzione": sanz.capitalize().replace("(ii infr)", "(II infr)"), "fino_al": fino, "motivo": ""}

    ESP = [False]

    def flush():
        nonlocal buf, pending, letti
        for m in NAME.finditer(buf):
            letti += 1
            sq = team_of(m[2], comp)
            if sq:
                r = base(m[1].strip(), sq)
                if "RECIDIVITA" in sanz:
                    r["motivo"] = "Recidività in ammonizione (II infrazione)"
                rows.append(r)
                pending = r
            else:
                pending = None
        buf = ""

    for l in lines:
        up = l.upper()
        low = any(c.islower() for c in l)
        e = EURO.match(l)
        if e:
            flush()
            letti += 1
            pending = None
            sq = team_of(e[2], comp)
            if sq:
                s0, c0 = sanz, cat
                sanz, cat = "AMMENDA", "societa"
                r = base(sq, sq)
                r["sanzione"] = "Ammenda € " + e[1]
                rows.append(r)
                pending = r
                sanz, cat = s0, c0
        elif not low and "(" not in l and ")" not in l and COMP.match(up):
            flush(); comp, cat, sanz, fino, gara, ESP[0] = l, "", "", None, seduta, False
        elif DATE_G.search(up) and not low:
            flush(); g = DATE_G.search(up); gara = mkdate(*g.groups())
        elif re.sub(r"[^A-Z ]", "", up).strip() in SUBCAT and not low:
            flush(); k = re.sub(r"[^A-Z ]", "", up).strip(); cat = SUBCAT[k]; ESP[0] = k == "CALCIATORI ESPULSI"; sanz, fino = "", None
        elif SANZ.match(up) and not low:
            flush(); sanz = l
            f = FINO.search(up)
            fino = mkdate(*f.groups()) if f else None
        elif low:
            flush()
            if pending is not None:
                pending["motivo"] = (pending["motivo"] + " " + l).strip()
            elif re.search(r"marina calcio", l, re.I):
                r = base("MARINA CALCIO", "Marina"); r.update(categoria="societa", tipo="altro", sanzione="Citata nel comunicato", motivo=l[:300])
                rows.append(r)
        elif pending is not None and re.fullmatch(r"[A-Z]\.[A-Z]\.+", l):
            pending["motivo"] = (pending["motivo"] + " " + l).strip()  # es. "D.G.." a capo
        else:
            pending = None
            buf += " " + l
    flush()
    return rows, letti


def sb(method, path, **kw):
    h = {"apikey": SB_KEY, "Content-Type": "application/json", "Prefer": "resolution=merge-duplicates,return=minimal"}
    if not SB_KEY.startswith("sb_"):  # le nuove chiavi "sb_secret_..." non sono JWT: vanno solo in apikey
        h["Authorization"] = "Bearer " + SB_KEY
    r = requests.request(method, f"{SB_URL}/rest/v1/{path}", headers=h, timeout=60, **kw)
    if not r.ok:
        sys.exit(f"Supabase ha risposto {r.status_code} su {path}: {r.text[:300]}")
    return r


def list_cu():
    found = {}
    for u in LIST_URLS:
        try:
            html = requests.get(u, headers=HEAD, timeout=60).text
        except Exception as e:
            print("lista non letta:", u, e)
            continue
        for m in re.finditer(r'https://toscana\.lnd\.it/wp-content/uploads/\d{4}/\d{2}/CU-CRT-(\d+)-DEL-(\d{2})-(\d{2})-(\d{4})[^"\s)\]]*\.pdf', html):
            n, d = int(m[1]), dt.date(int(m[4]), int(m[3]), int(m[2]))
            if d >= START:
                found[n] = {"numero": n, "data": d.isoformat(), "url": m[0]}
    return [found[k] for k in sorted(found)]


def main():
    if not SB_URL or not SB_KEY:
        sys.exit("Mancano SUPABASE_URL / SUPABASE_SERVICE_KEY")
    done = {r["numero"]: r for r in sb("GET", "cu_processati?select=numero,letti").json()}
    cus = list_cu()
    print("comunicati trovati:", [c["numero"] for c in cus])
    for cu in cus:
        if done.get(cu["numero"], {}).get("letti") is not None and cu["numero"] < max(c["numero"] for c in cus) - 1:
            continue
        try:
            pdf = requests.get(cu["url"], headers=HEAD, timeout=120)
            pdf.raise_for_status()
            text = "\n".join((p.extract_text() or "") for p in PdfReader(io.BytesIO(pdf.content)).pages)
        except Exception as e:
            print(f"CU {cu['numero']}: errore {e}")
            continue
        rows, letti = parse_gs(text, cu)
        print(f"CU {cu['numero']}: {letti} provvedimenti letti, {len(rows)} del girone M ({sum(r["squadra"] == "Marina" for r in rows)} del Marina)")
        if DEBUG or letti == 0:
            os.makedirs("debug", exist_ok=True)
            open(f"debug/CU-{cu['numero']}.txt", "w", encoding="utf-8").write(text)
        if rows:
            sb("POST", "provvedimenti?on_conflict=cu_numero,competizione,gara_data,nome,sanzione,squadra", json=rows)
        sb("POST", "cu_processati?on_conflict=numero", json=[{**{k: cu[k] for k in ("numero", "data", "url")},
                                                              "letti": letti, "trovati": len(rows),
                                                              "esaminato_il": dt.datetime.now(dt.timezone.utc).isoformat()}])


if __name__ == "__main__":
    main()
