import {test,expect} from 'bun:test';
import {readFile} from 'node:fs/promises';
import {validateDossier,type ReceiptVerifier} from '../contract.ts';
const read=async(path:string)=>JSON.parse(await readFile(path,'utf8'));
const unusedVerifier:ReceiptVerifier={
 async verify(){throw new Error('Verifier should not be called on structurally bad dossiers');}
};
test('slop fixture fails support and orphan invariants',async()=>{
 const data=await read('fixtures/slop.json');
 const verdict=await validateDossier(data,unusedVerifier,{allowSyntheticFixture:true});
 expect(verdict.ok).toBe(false);
 if(!verdict.ok){
   // ev1 is stance='context' yet backs a verified identity claim: a verified
   // claim must rest on at least one supporting evidence record.
   expect(verdict.errors.map(e=>e.code)).toContain('UNSUPPORTED_VERIFIED_CLAIM');
   expect(verdict.errors.map(e=>e.code)).toContain('ORPHAN_EVIDENCE');
 }
});
