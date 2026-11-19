import json, numpy as np
from sklearn.linear_model import LogisticRegression
F=json.load(open('fichas.json'))
rows=json.load(open('rows.json'))
# minutos reales de la semana objetivo
mk={}
for pid,f in F.items():
    for s in f.get('playerStats') or []:
        m=s['stats'].get('mins_played'); mk[(pid,s['weekNumber'])]=(m[0] if isinstance(m,list) else m) or 0
def lab(m): return 1.0 if m>=50 else 0.5 if m>=45 else 0.0
def fx(r):
    m=[min(mm,90)/90 for w,mm in r['pres']]
    m3=sum(m[-3:])/len(m[-3:]) if m else 0
    ms=sum(m)/len(m) if m else 0
    b=[1 if mm>=50 else 0 for w,mm in r['pres']]; r5=sum(b[-5:])/len(b[-5:]) if b else None
    return [m3,ms,r['vrel']], (r5 if len(b)>=3 else None)
A=[];Y=[];K=[];CUR=[]
for r in rows:
    f,c=fx(r); A.append(f); Y.append(lab(mk[(r['pid'],r['k'])])); K.append(r['k']); CUR.append(np.nan if c is None else c)
A=np.array(A);Y=np.array(Y);K=np.array(K);CUR=np.array(CUR)
def fit(sel):
    X2=np.vstack([A[sel],A[sel]]); y2=np.r_[np.ones(sel.sum()),np.zeros(sel.sum())]; w=np.r_[Y[sel],1-Y[sel]]
    return LogisticRegression(C=1.0,max_iter=3000).fit(X2,y2,sample_weight=w)
def brier(p,y): return float(np.mean((p-y)**2))
tr=K<=9; te=K>=10
lr=fit(tr); p=lr.predict_proba(A)[:,1]
m=te&~np.isnan(CUR)
print('target titular(>=50): test brier modelo %.4f  app-r5 %.4f (n=%d)'%(brier(p[m],Y[m]),brier(np.clip(CUR[m],0,.98),Y[m]),m.sum()))
lr=fit(np.ones_like(tr,bool)); print('coef final',np.round(lr.coef_[0],3),round(lr.intercept_[0],3))
p=lr.predict_proba(A)[:,1]
bins=np.linspace(0,1,11); idx=np.clip(np.digitize(p,bins)-1,0,9)
for b in range(10):
    s=idx==b
    if s.sum(): print('  %.1f n=%4d pred %.2f real %.2f'%(bins[b],s.sum(),p[s].mean(),Y[s].mean()))
for x in [[1,1,1],[0.9,0.85,1],[0.9,0.85,0.5],[0.6,0.6,0.7],[0.3,0.3,0.5],[0,0.05,0.3],[0,0,1],[0,0,0.1]]:
    print(x, round(float(lr.predict_proba([x])[0,1]),3))
print('---')
s=(A[:,1]==0); print('nunca juega: n',s.sum(),'real',Y[s].mean())
s=(A[:,0]==0)&(A[:,1]>0); print('0 en 3 ultimas pero algo antes: n',s.sum(),'real',Y[s].mean(), 'pred', p[s].mean())
s=(A[:,0]>=0.95); print('90 en las 3: n',s.sum(),'real',Y[s].mean(),'pred',p[s].mean())
A=np.c_[A, (A[:,1]==0).astype(float), (A[:,0]==0).astype(float)]
lr=fit(tr); p=lr.predict_proba(A)[:,1]; print('con nunca/cero3: test brier %.4f'%brier(p[m],Y[m]))
lr=fit(np.ones_like(tr,bool)); print('coef final',np.round(lr.coef_[0],3),round(lr.intercept_[0],3)); p=lr.predict_proba(A)[:,1]
idx=np.clip(np.digitize(p,bins)-1,0,9)
for b in range(10):
    s=idx==b
    if s.sum(): print('  %.1f n=%4d pred %.2f real %.2f'%(bins[b],s.sum(),p[s].mean(),Y[s].mean()))
print('--- subgrupos')
for lo,hi in [(0,0.25),(0.25,0.5),(0.5,0.75),(0.75,1.01)]:
    s=(A[:,0]>=0.9)&(A[:,2]>=lo)&(A[:,2]<hi); print('m3>=.9 vrel %.2f-%.2f n=%d real %.2f pred %.2f'%(lo,hi,s.sum(),Y[s].mean(),p[s].mean()))
for lo,hi in [(0,0.25),(0.25,0.5),(0.5,0.75),(0.75,1.01)]:
    s=(A[:,0]<=0.1)&(A[:,1]>0)&(A[:,2]>=lo)&(A[:,2]<hi); print('m3<=.1 vrel %.2f-%.2f n=%d real %.2f pred %.2f'%(lo,hi,s.sum(),Y[s].mean() if s.sum() else 0,p[s].mean() if s.sum() else 0))
