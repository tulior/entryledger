import {validateDossier} from '../contract.ts';
import {createReceiptVerifier} from '../verifier/fetch.ts';
import {readFile} from 'node:fs/promises';

const path=process.argv[2];
if(!path)throw Error('Usage: bun run dossier:check ./out/dossier.json');
const dossier=JSON.parse(await readFile(path,'utf8'));
const report=await validateDossier(dossier,createReceiptVerifier());
if(!report.ok){
  console.error(JSON.stringify({ok:false,errors:report.errors,warnings:report.warnings},null,2));
  process.exitCode=1;
}else{
  console.log(JSON.stringify({ok:true,claims:report.dossier.claims.length,
    sources:report.dossier.sources.length,warnings:report.warnings}));
}
