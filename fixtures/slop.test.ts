import {test,expect} from 'bun:test';
import {readFile} from 'node:fs/promises';
import {validateDossier,type EvidenceVerifier} from '../contract.ts';
const read=async(path:string)=>JSON.parse(await readFile(path,'utf8'));
const unusedVerifier:EvidenceVerifier={
 async verify(){throw new Error('Verifier should not be called on structurally bad dossiers');},
 async reviewSource(){throw new Error('Verifier should not be called on structurally bad dossiers');},
 async reviewStatement(){throw new Error('Verifier should not be called on structurally bad dossiers');}
};
test('slop fixture fails evidence stance and orphan invariants',async()=>{
 const data=await read('fixtures/slop.json');
 const verdict=await validateDossier(data,unusedVerifier,{allowSyntheticFixture:true});
 expect(verdict.ok).toBe(false);
 if(!verdict.ok){
   expect(verdict.errors.map(e=>e.code)).toContain('BAD_EVIDENCE_STANCE');
   expect(verdict.errors.map(e=>e.code)).toContain('ORPHAN_EVIDENCE');
 }
});
