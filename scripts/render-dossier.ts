/**
 * Render the two publication-shaped artifacts. Revalidates shape first, so a
 * malformed dossier can never produce output.
 */
import {validateDossier} from '../contract.ts';
import {renderArtifacts} from '../render.ts';
import {readFile,writeFile,mkdir,rm,rename} from 'node:fs/promises';

const path=process.argv[2];
if(!path)throw Error('Usage: bun run dossier:render ./out/dossier.json');
await rm('out/artifacts.json',{force:true}); // stale output must not survive failure
const report=validateDossier(JSON.parse(await readFile(path,'utf8')));
if(!report.ok)throw Error(JSON.stringify(report.errors));
const artifacts=renderArtifacts(report,{maxChars:5000});
await mkdir('out',{recursive:true});
const temp='out/artifacts.json.tmp-'+process.pid;
try{
  await writeFile(temp,JSON.stringify(artifacts,null,2)+'\n',{flag:'wx'});
  await rename(temp,'out/artifacts.json');
}finally{await rm(temp,{force:true});}
console.log('out/artifacts.json —',artifacts[1].length,'chars');
console.log('Content is NOT verified. The consumer must check every reference.');
