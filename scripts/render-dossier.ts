import {validateDossier} from '../contract.ts';
import {createReceiptVerifier} from '../verifier/fetch.ts';
import {renderArtifacts} from '../render.ts';
import {readFile,writeFile,mkdir} from 'node:fs/promises';

const path=process.argv[2];
if(!path)throw Error('Usage: bun run dossier:render ./out/dossier.json');
const dossier=JSON.parse(await readFile(path,'utf8'));
const report=await validateDossier(dossier,createReceiptVerifier());
if(!report.ok)throw Error(JSON.stringify(report.errors));
const artifacts=renderArtifacts(report,{maxChars:5000});
await mkdir('out',{recursive:true});
await writeFile('out/artifacts.json',JSON.stringify(artifacts,null,2)+'\n');
console.log('out/artifacts.json');
