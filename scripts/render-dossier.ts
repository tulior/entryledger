import {validateDossier} from '../contract.ts';
import {createReceiptVerifier} from '../verifier/fetch.ts';
import {renderArtifacts} from '../render.ts';
import {readFile,writeFile,mkdir,rm,rename} from 'node:fs/promises';

const path=process.argv[2];
if(!path)throw Error('Usage: bun run dossier:render ./out/dossier.json');
await rm('out/artifacts.json',{force:true}); // stale success must not survive failure
const dossier=JSON.parse(await readFile(path,'utf8'));
const report=await validateDossier(dossier,createReceiptVerifier());
if(!report.ok)throw Error(JSON.stringify(report.errors));
const artifacts=renderArtifacts(report,{maxChars:5000});
await mkdir('out',{recursive:true});
const temp='out/artifacts.json.tmp-'+process.pid;
try{
  await writeFile(temp,JSON.stringify(artifacts,null,2)+'\n',{flag:'wx'});
  await rename(temp,'out/artifacts.json');
}finally{await rm(temp,{force:true});}
console.log('out/artifacts.json');
