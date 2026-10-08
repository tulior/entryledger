#!/usr/bin/env bash
# Reproducible verification log for the renderer fail-closed change (L).
# Run from the repo root: bash work/verify.sh 2>&1 | tee work/verify.log
set -u
cd "$(dirname "$0")/.."
export NODE_TLS_REJECT_UNAUTHORIZED=0

# Bun may be absent in a fresh sandbox; say so plainly rather than emitting a log
# full of "command not found" that looks like a passing run.
if ! command -v bun >/dev/null 2>&1; then
  echo 'FATAL: bun is not on PATH. Install it (npm i -g bun) and re-run.' >&2
  exit 127
fi
echo "bun: $(bun --version)"

banner(){ printf '\n===== %s =====\n' "$1"; }

banner '1. typecheck (tsc --noEmit)'
bun run check 2>&1; echo "exit=$?"

banner '2. committed JSON Schema still matches the TypeBox definition'
bun run schema:verify 2>&1; echo "exit=$?"

banner '3. full offline suite'
bun test 2>&1 | tail -6; echo "exit=${PIPESTATUS[0]}"

banner '4. MUTATION TEST - guard temporarily disabled, suite must fail'
cp render.ts /tmp/render.ts.keep
python3 - <<'PY'
import pathlib,sys
p=pathlib.Path('render.ts'); s=p.read_text()
# Target the guard as it exists NOW. If this string is absent the mutation is a
# silent no-op and this whole check would report a false pass, so fail loudly.
target="  if(lostLoadBearing.length) throw lossError(lostLoadBearing,audit.chars,audit.maxChars);"
if target not in s:
    sys.exit('MUTATION TARGET NOT FOUND - guard text changed; update verify.sh')
p.write_text(s.replace(target,"  void lostLoadBearing;",1))
print('  guard disabled')
PY
bun test 2>&1 | grep -E '^\(fail\)|^ [0-9]+ (pass|fail)' | sed 's/^/  /'
cp /tmp/render.ts.keep render.ts && rm -f /tmp/render.ts.keep
echo "  (guard restored)"

banner '5. suite green again after restore'
bun test 2>&1 | tail -5

banner '6. real dossier: check x3 (proves quotes are counter-free and stable)'
for i in 1 2 3; do
bun run dossier:check ./out/dossier.json 2>&1 | python3 -c "
import sys,json
t=sys.stdin.read(); t=t[t.index('{'):t.rindex('}')+1]
d=json.loads(t); r=d.get('render',{}); inc=r.get('included',[])
print('ok:',d['ok'],'| claims:',d['claims'],'| sources:',d['sources'])
print('brief:',r.get('chars'),'/',r.get('maxChars'),'chars')
print('categories rendered: %d/13 -> %s'%(len(inc),', '.join(inc)))
print('lost categories:', r.get('lostCategories') or 'none')
print('dropped (partial, inside surviving categories):')
for x in r.get('dropped',[]): print('   %-22s %-18s %dc'%(x['category'],x['id'],x['chars']))
print('warnings:', ', '.join(w['code'] for w in d.get('warnings',[])))
"
sleep 5
done

banner '7. real dossier: render (publication gate)'
bun run dossier:render ./out/dossier.json 2>&1 | grep -v '^\$'

banner '8. artifact contract holds'
bun -e "
const a=require('./out/artifacts.json');
console.log('is two-string array:', Array.isArray(a)&&a.length===2&&a.every(x=>typeof x==='string'));
console.log('title:', JSON.stringify(a[0]));
console.log('brief chars:', a[1].length, '(cap 5000)');
console.log('has inline citations:', /\[[Ss]\d+:/.test(a[1]));
console.log('all 13 category headers present:',
  ['IDENTITY','DISAMBIGUATION','SCOPE','DEFINITION','CHRONOLOGY','PEOPLE_ORGANIZATIONS',
   'RELATIONSHIPS','CHARACTERISTICS','SIGNIFICANCE','RECEPTION','CONTROVERSIES',
   'LIMITATIONS','EDITORIAL_CAUTIONS'].every(h=>a[1].includes(h)));
"

banner '9. MUTATION TEST - expiry gate removed, EVIDENCE_EXPIRED must fail'
cp verifier/fetch.ts /tmp/fetch.keep
python3 - <<'PY'
import pathlib
p=pathlib.Path('verifier/fetch.ts'); s=p.read_text()
s=s.replace("        return Number.isFinite(age)&&age>staleness?'expired':'absent';","        return 'expired';",1)
p.write_text(s)
PY
bun test 2>&1 | grep -E '^\(fail\)|^ [0-9]+ (pass|fail)' | sed 's/^/  /'
cp /tmp/fetch.keep verifier/fetch.ts && rm -f /tmp/fetch.keep
echo "  (expiry gate restored)"

banner '10. MUTATION TEST - coverage guard removed, CATEGORY_OMITTED must fail'
cp render.ts /tmp/render.keep
python3 - <<'PY'
import pathlib
p=pathlib.Path('render.ts'); s=p.read_text()
s=s.replace("  if(lostLoadBearing.length) throw lossError(lostLoadBearing,audit.chars,audit.maxChars);\n","",1)
p.write_text(s)
PY
bun test 2>&1 | grep -E '^\(fail\)|^ [0-9]+ (pass|fail)' | sed 's/^/  /'
cp /tmp/render.keep render.ts && rm -f /tmp/render.keep
echo "  (coverage guard restored)"

banner '11. suite green after both restores'
bun test 2>&1 | tail -4
