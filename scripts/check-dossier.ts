/**
 * Shape and internal-consistency check. Performs NO network access and makes no
 * judgement about whether the content is true: the consumer verifies that.
 */
import {validateDossier} from '../contract.ts';
import {readFile} from 'node:fs/promises';

const path=process.argv[2];
if(!path)throw Error('Usage: bun run dossier:check ./out/dossier.json');
const report=validateDossier(JSON.parse(await readFile(path,'utf8')));
if(!report.ok){
  console.error(JSON.stringify({ok:false,errors:report.errors,warnings:report.warnings},null,2));
  process.exitCode=1;
}else{
  console.log(JSON.stringify({ok:true,claims:report.dossier.claims.length,
    sources:report.dossier.sources.length,
    note:'Structure is valid. Content is NOT verified; verify before publication.',
    warnings:report.warnings},null,2));
}
