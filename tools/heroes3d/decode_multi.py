import sys, json, base64, os
log, outdir = sys.argv[1], sys.argv[2]; os.makedirs(outdir, exist_ok=True)
for l in open(log):
    if l.startswith('EXTRA '):
        d = json.loads(l[6:])
        for k, v in (d.get('pngs') or {}).items():
            if v: open(os.path.join(outdir, 'portrait_%s.png' % k), 'wb').write(base64.b64decode(v.split(',')[1])); print('wrote', k)
            else: print('MISSING', k)
    if l.startswith('EXTRAERR'): print(l.strip())
