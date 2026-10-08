/**
 * Fails if the committed dossier.schema.json differs from the TypeBox source
 * of truth. Comparison is structural, not byte-based: key order is not part of
 * the schema's meaning, so reordering alone must not fail the build.
 *
 * Usage: bun scripts/verify-schema.ts
 */
import {DossierSchema} from '../contract.ts';
import {readFile} from 'node:fs/promises';

type Json=unknown;
/** Order-insensitive canonical form used for comparison and diffing. */
const canon=(v:Json):Json=>{
  if(Array.isArray(v))return v.map(canon);
  if(v&&typeof v==='object')
    return Object.fromEntries(Object.entries(v as Record<string,Json>)
      .sort(([a],[b])=>a.localeCompare(b)).map(([k,val])=>[k,canon(val)]));
  return v;
};
const path=process.argv[2]??'dossier.schema.json';
let committed:Json;
try{ committed=JSON.parse(await readFile(path,'utf8')); }
catch(e){ console.error(`::error::cannot read ${path}: ${(e as Error).message}`); process.exit(1); }
const generated=JSON.parse(JSON.stringify(DossierSchema)) as Json;
const a=JSON.stringify(canon(committed),null,2), b=JSON.stringify(canon(generated),null,2);
if(a===b){ console.log(`${path} matches the TypeBox definition.`); process.exit(0); }
console.error(`::error::${path} has drifted from the TypeBox definition.`);
console.error('Regenerate it with: bun run schema:export > '+path);
// Report the first differing line pair to make the drift actionable.
const al=a.split('\n'), bl=b.split('\n');
for(let i=0;i<Math.max(al.length,bl.length);i++)
  if(al[i]!==bl[i]){
    console.error(`first difference at canonical line ${i+1}:`);
    console.error(`  committed: ${al[i]??'<missing>'}`);
    console.error(`  generated: ${bl[i]??'<missing>'}`);
    break;
  }
process.exit(1);
