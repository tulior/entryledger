import {validateDossier} from '../contract.ts';
import {createReceiptVerifier} from '../verifier/fetch.ts';
import {auditRender} from '../render.ts';
import {readFile} from 'node:fs/promises';

const path=process.argv[2];
if(!path)throw Error('Usage: bun run dossier:check ./out/dossier.json');
const dossier=JSON.parse(await readFile(path,'utf8'));
const report=await validateDossier(dossier,createReceiptVerifier());
if(!report.ok){
  console.error(JSON.stringify({ok:false,errors:report.errors,warnings:report.warnings},null,2));
  process.exitCode=1;
}else{
  // Report renderability at check time, where the agent iterates, so a brief that
  // cannot be packed without losing a category is visible before publishing.
  const warnings=[...report.warnings];
  let render:unknown=null;
  try{
    const audit=auditRender(report,{maxChars:5000});
    render={chars:audit.chars,maxChars:audit.maxChars,included:audit.included,
      dropped:audit.dropped,lostCategories:audit.lostCategories};
    if(audit.lostCategories.length)
      warnings.push({code:'CATEGORY_OMITTED',path:'render',
        message:`dossier:render will refuse to publish: ${audit.lostCategories.join(', ')} `+
          `would be dropped entirely. Shorten propositions, qualifiers and locators.`,
        severity:'warning' as const});
  }catch(e){ render={unrenderable:String((e as Error).message)}; }
  console.log(JSON.stringify({ok:true,claims:report.dossier.claims.length,
    sources:report.dossier.sources.length,render,warnings},null,2));
}
