import {test,expect} from 'bun:test';
import {readFile} from 'node:fs/promises';
import {validateDossier} from '../contract.ts';
const read=async(p:string)=>JSON.parse(await readFile(p,'utf8'));
test('golden fixture is a well-formed synthetic dossier',async()=>{
  const r=validateDossier(await read('fixtures/golden.json'),{allowSyntheticFixture:true});
  expect(r.ok).toBe(true);
  if(!r.ok)console.log(r.errors.map(e=>e.code+':'+e.path).join(' | '));
});
test('negative fixture fails and differs from golden evidence',async()=>{
  const slop=await read('fixtures/slop.json');
  const golden=await read('fixtures/golden.json');
  expect(JSON.stringify(slop.evidence)).not.toBe(JSON.stringify(golden.evidence));
  const r=validateDossier(slop,{allowSyntheticFixture:true});
  expect(r.ok).toBe(false);
});
