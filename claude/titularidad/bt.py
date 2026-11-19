import json, math, numpy as np
F=json.load(open('fichas.json')); J={j['id']:j for j in json.load(open('jugadores.json'))}
rows=[]
teamweeks={}
P={}
for pid,f in F.items():
    j=J.get(int(pid)) or J.get(pid)
    if not j: continue
    tid=str(j['teamId']); 
    h={}
    for s in f.get('playerStats') or []:
        m=s['stats'].get('mins_played'); m=(m[0] if isinstance(m,list) else m) or 0
        h[s['weekNumber']]=m
        if m>0: teamweeks.setdefault(tid,set()).add(s['weekNumber'])
    P[pid]=dict(t=tid,pos=j['positionId'],v=float(j['marketValue'] or 0),h=h,st=j['playerStatus'])
# value rank within team-pos
from collections import defaultdict
g=defaultdict(list)
for pid,x in P.items(): g[(x['t'],x['pos'])].append((x['v'],pid))
for k,l in g.items():
    l.sort(reverse=True)
    for i,(v,pid) in enumerate(l): P[pid]['rk']=i; P[pid]['vrel']=v/max(1,l[0][0])
for pid,x in P.items():
    tw=sorted(teamweeks.get(x['t'],[]))
    for k in tw:
        if k<4 or k not in x['h']: continue
        prev=[w for w in tw if w<k]
        pres=[(w,x['h'][w]) for w in prev if w in x['h']]
        rows.append(dict(pid=pid,k=k,pos=x['pos'],y=int(x['h'][k]>=60),pres=pres,nprev=len(prev),rk=x['rk'],vrel=x['vrel'],v=x['v']))
print(len(rows), 'filas; positivos', sum(r['y'] for r in rows))
json.dump(rows,open('rows.json','w'))
