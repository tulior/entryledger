import {test,expect} from 'bun:test';
import {readFile} from 'node:fs/promises';
import {DossierSchema} from '../contract.ts';

test('committed strict IR matches native TypeBox JSON Schema',async()=>{
 const ir=JSON.parse(await readFile('dossier.schema.json','utf8'));
 const generated=JSON.parse(JSON.stringify(DossierSchema));
 expect(ir).toEqual(generated);
});
