import {test,expect} from 'bun:test';
import {readFile} from 'node:fs/promises';
import {DossierSchema} from '../contract.ts';
/** Comparison is structural: key order is not part of schema meaning. */
const canon=(v:unknown):unknown=>Array.isArray(v)?v.map(canon):
  (v&&typeof v==='object'?Object.fromEntries(Object.entries(v as Record<string,unknown>)
    .sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>[k,canon(x)])):v);
test('committed strict IR matches native TypeBox JSON Schema',async()=>{
  const ir=JSON.parse(await readFile('dossier.schema.json','utf8'));
  expect(JSON.stringify(canon(ir))).toBe(JSON.stringify(canon(JSON.parse(JSON.stringify(DossierSchema)))));
});
test('evidence carries a URL for the consumer to check, not a receipt id',async()=>{
  const ir=JSON.parse(await readFile('dossier.schema.json','utf8'));
  const ev=ir.properties.evidence.items;
  expect(ev.required).toContain('url');
  expect(ev.required).toContain('quote');
  expect(ev.required).not.toContain('receiptId');
});
