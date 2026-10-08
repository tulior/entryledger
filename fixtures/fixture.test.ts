import {test,expect} from 'bun:test';
import {readFile} from 'node:fs/promises';
import {DossierStandardSchema} from '../contract.ts';
const load=async(path:string)=>JSON.parse(await readFile(path,'utf8'));
test('golden fixture matches strict schema',async()=>{
 const dossier=await load('fixtures/golden.json');
 const outcome=await DossierStandardSchema['~standard'].validate(dossier);
 expect('issues' in outcome).toBe(false);
});
test('negative fixture differs from golden evidence',async()=>{
 const good=await load('fixtures/golden.json');
 const bad=await load('fixtures/slop.json');
 expect(bad.evidence.length).toBeGreaterThan(good.evidence.length);
 expect(bad.evidence[0].stance).toBe('context');
});
