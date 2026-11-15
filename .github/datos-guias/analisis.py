#!/usr/bin/env python3
"""Las cifras de las guías (15 nov 2026): porteros (puntos-porteros), rachas de valor (valor-de-mercado) y suplentes (alineacion).
Lee datos/fichas.json y datos/valores.json de bajar.mjs. Equipos: el nombre corto de cada teamId lo da equipos.json (opcional)."""
import json, collections, statistics as st, os
F = json.load(open('datos/fichas.json')); V = json.load(open('datos/valores.json'))
E = json.load(open('datos/equipos.json')) if os.path.exists('datos/equipos.json') else {}
c = lambda x: f'{x:.1f}'.replace('.', ',')

# filas: un jugador en un partido
R = []
for x in F:
    j, f = x['j'], x['f']
    for s in (f or {}).get('playerStats', []):
        S = s.get('stats') or {}
        g = lambda k, i=0: (S.get(k) or [0, 0])[i]
        R.append(dict(team=j['teamId'], pos=int(j['positionId']), J=s['weekNumber'], pts=s.get('totalPoints') or 0, mins=g('mins_played'),
                      gc=g('goals_conceded'), saves=g('saves'), dazn=g('marca_points', 1)))
print(len(R), 'fichas de jornada,', len({x['j']['id'] for x in F if x['f']}), 'jugadores, jornadas', min(r['J'] for r in R), 'a', max(r['J'] for r in R))

# porteros: el titular de cada equipo y partido (el de más minutos, con 60 o más)
eq = collections.defaultdict(list)
for r in R:
    if r['pos'] == 1: eq[(r['team'], r['J'])].append(r)
T = [r for r in (max(v, key=lambda r: r['mins']) for v in eq.values()) if r['mins'] >= 60]
print('\nPORTEROS:', len(T), 'partidos; porterías a cero', sum(r['gc'] == 0 for r in T))
for k in range(4):
    xs = [r for r in T if min(r['gc'], 3) == k]; print(f'  {k}{"+" if k == 3 else ""} goles: {len(xs)} partidos, {c(st.mean(r["pts"] for r in xs))} puntos, DAZN {c(st.mean(r["dazn"] for r in xs))}')
for a, b in [(0, 1), (2, 3), (4, 5), (6, 99)]:
    xs = [r for r in T if a <= r['saves'] <= b]; print(f'  {a}-{b} paradas: {len(xs)} partidos, {c(st.mean(r["pts"] for r in xs))} puntos')
G = collections.defaultdict(list)
for r in T: G[r['team']].append(r)
for t, v in sorted(G.items(), key=lambda kv: -st.mean(r['pts'] for r in kv[1])):
    n = len(v); print(f'  {E.get(t, t)}: {sum(r["gc"] == 0 for r in v)} de {n}, {c(sum(r["saves"] for r in v) / n)} paradas, {c(sum(r["gc"] for r in v) / n)} encajados, {c(st.mean(r["pts"] for r in v))} puntos')

# suplentes: puntos por puesto según los minutos (sin los partidos con 0 minutos)
print('\nSUPLENTES:', sum(r['mins'] > 0 for r in R), 'partidos jugados')
for pos, nom in [(1, 'POR'), (2, 'DEF'), (3, 'MED'), (4, 'DEL')]:
    m = lambda a, b: [r['pts'] for r in R if r['pos'] == pos and a <= r['mins'] <= b]
    t, s2, s1 = m(60, 999), m(31, 59), m(1, 30)
    print(f'  {nom}: 60+ {c(st.mean(t))} ({len(t)}) · 31-59 {c(st.mean(s2)) if len(s2) > 5 else "-"} ({len(s2)}) · 1-30 {c(st.mean(s1)) if len(s1) > 5 else "-"} ({len(s1)})')

# rachas de valor desde el 14 de agosto
DESDE = '2026-08-14'
seq = [sorted((v['date'][:10], v['marketValue']) for v in (x['v'] or []) if v.get('marketValue')) for x in V]
def racha(k, dir=1, lo=0, hi=1e15):
    a = b = c2 = 0
    for s in seq:
        for i in range(k + 1, len(s) - 2):
            if s[i - k][0] < DESDE or not (lo <= s[i][1] < hi): continue
            if not all((s[t][1] - s[t - 1][1]) * dir > 0 for t in range(i - k + 1, i + 1)) or (s[i - k][1] - s[i - k - 1][1]) * dir > 0: continue
            a += 1
            if (s[i + 1][1] - s[i][1]) * dir > 0:
                b += 1; c2 += (s[i + 2][1] - s[i + 1][1]) * dir > 0
    return a, b, c2
cambios = sum(1 for s in seq for i in range(1, len(s)) if s[i][0] >= DESDE)
sube = sum(1 for s in seq for i in range(1, len(s)) if s[i][0] >= DESDE and s[i][1] > s[i - 1][1])
print(f'\nRACHAS: {len(V)} jugadores, {cambios} cambios, un día cualquiera sube el {c(sube / cambios * 100)} %')
for k in range(1, 6):
    a, b, c2 = racha(k); print(f'  {k} días subiendo: {a} casos, sigue {c(b / a * 100)} %, y el siguiente {c(c2 / b * 100)} %')
a, b, _ = racha(3, -1); print(f'  3 días bajando: sigue bajando el {c(b / a * 100)} %')
for lo, hi in [(0, 2e6), (2e6, 1e7), (1e7, 3e7), (3e7, 1e15)]:
    a, b, _ = racha(3, 1, lo, hi); print(f'  {lo / 1e6:g}-{hi / 1e6:g} M: sigue el {c(b / a * 100)} %')
L = []
for s in seq:
    n = 0
    for i in range(1, len(s)):
        if s[i][0] < DESDE: n = 0; continue
        if s[i][1] > s[i - 1][1]: n += 1
        elif n: L.append(n); n = 0
L3 = [x for x in L if x >= 3]
print(f'  rachas de 3+: mediana {st.median(L3)} días, llegan a 7 el {c(sum(x >= 7 for x in L3) / len(L3) * 100)} % y a 10 el {c(sum(x >= 10 for x in L3) / len(L3) * 100)} %')
fr = [[0, 0], [0, 0]]
for s in seq:
    for i in range(3, len(s) - 1):
        if s[i - 3][0] < DESDE: continue
        d = [s[t][1] - s[t - 1][1] for t in (i - 2, i - 1, i)]
        if not all(x > 0 for x in d): continue
        k = 0 if d[2] >= d[1] else 1 if d[2] < d[1] * 0.5 else None
        if k is not None: fr[k][0] += 1; fr[k][1] += s[i + 1][1] > s[i][1]
print(f'  si se acelera o iguala, sigue el {c(fr[0][1] / fr[0][0] * 100)} %; si cae a menos de la mitad, el {c(fr[1][1] / fr[1][0] * 100)} %')
