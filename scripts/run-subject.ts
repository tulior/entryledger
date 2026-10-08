/**
 * The whole research-to-handoff run, as one agent-runnable command.
 *
 *   ARTICLE="Ferrari (car)" bun run subject
 *
 * This is a WORKLIST, not an agent. It cannot search the web and it does not
 * decide what is true. It exists so an autonomous agent has one entry point
 * with explicit, bounded stages and explicit failure:
 *
 *   1. inspect   read AGENT.md, the committed IR and the research brief
 *   2. discover  search the web for candidate sources (agent's capability)
 *   3. inspect   dump each candidate page, copy exact quotations from the text
 *   4. record    write out/dossier.json against dossier.schema.json
 *   5. validate  bun run dossier:check  (offline; structure only)
 *   6. render    bun run dossier:render (offline; atomic, exactly two strings)
 *
 * Stages 1, 4 and the judgement calls are the agent's. Stages 2-3 need a web
 * search tool this repository does not and will not bundle. Stage 5-6 are
 * deterministic and cannot be argued with.
 *
 * Every stage that fails stops the run with a non-zero exit and removes any
 * stale out/artifacts.json, so a failed run can never leave a plausible-looking
 * artifact behind for the consumer to trust.
 */
import {validateDossier} from '../contract.ts';
import {renderArtifacts} from '../render.ts';
import {readFile,writeFile,mkdir,rm,rename} from 'node:fs/promises';

const article=(process.env.ARTICLE??'').trim();
const briefPath=process.env.BRIEF??'out/research-brief.json';
const dossierPath=process.env.DOSSIER??'out/dossier.json';
const artifactsPath=process.env.ARTIFACTS??'out/artifacts.json';

// A stale artifact must never outlive ANY failed run, including the usage
// error below. This therefore runs before every exit path.
await rm(artifactsPath,{force:true});

if(!article){
  console.error('Usage: ARTICLE="<subject>" bun run subject');
  process.exit(2);
}

const fail=(stage:string,detail:unknown):never=>{
  console.error(`\nFAILED at stage: ${stage}`);
  console.error(typeof detail==='string'?detail:JSON.stringify(detail,null,2));
  console.error(`\nNo artifact was written. ${artifactsPath} has been removed if it existed.`);
  process.exit(1);
};

/* -- 1. inspect ---------------------------------------------------------- */
console.log(`# Subject: ${article}\n`);
const ir=JSON.parse(await readFile('dossier.schema.json','utf8'));
console.log(`## Stage 1/6 inspect`);
console.log(`  IR: ${ir.properties.claims.items ? '13 categories, 5 claim stances' : 'unreadable'}`);
console.log(`  Read AGENT.md for the research rules and the brief contract.`);

/* -- 2/3. discover + inspect --------------------------------------------- */
const briefPathExists=await readFile(briefPath,'utf8').then(()=>true).catch(()=>false);
if(!briefPathExists)
  fail('discover',
    `No research brief at ${briefPath}. Search the web for candidate sources and `+
    `record them there before running again, e.g.\n`+
    `  [{"url":"...","role":"independent_secondary","why":"..."}]\n`+
    `This command does not search the web for you.`);
const brief=JSON.parse(await readFile(briefPath,'utf8'));
if(!Array.isArray(brief)||!brief.length)
  fail('discover',`${briefPath} must be a non-empty array of {url, role, why}.`);
console.log(`\n## Stage 2/6 discover`);
console.log(`  ${brief.length} candidate source(s) from ${briefPath}`);
for(const [i,s] of brief.entries())
  console.log(`   ${String(i+1).padStart(2)}. [${s.role??'unclassified'}] ${s.url}`);

console.log(`\n## Stage 3/6 inspect (requires network; budget applies)`);
const {dumpPage,newBudget,BudgetExceeded,spent}=await import('../research/page.ts');
const budget=newBudget();
const dumps:Record<string,unknown>={};
for(const [i,s] of brief.entries()){
  try{
    const d=await dumpPage(s.url,{},budget);
    dumps[s.url]=d;
    console.log(`   ${String(i+1).padStart(2)}. ${d.chars}c  ${d.url}`);
  }catch(e:any){
    if(e instanceof BudgetExceeded)fail('inspect',e.message);
    // An unreachable source is a research finding, not a crash: it becomes a
    // coverage gap the consumer sees. Never let a 403 masquerade as a source.
    console.log(`   ${String(i+1).padStart(2)}. UNREACHABLE  ${s.url}  (${e.message.slice(0,60)})`);
    dumps[s.url]={url:s.url,error:e.message};
  }
}
const used=spent(budget);
console.log(`  retrieval: ${used.fetches} fetches, ${used.bytes} bytes, ${(used.ms/1000).toFixed(1)}s`);

/* -- 4. record ----------------------------------------------------------- */
console.log(`\n## Stage 4/6 record`);
let raw:unknown;
try{ raw=JSON.parse(await readFile(dossierPath,'utf8')); }
catch{ fail('record',
    `No dossier at ${dossierPath}. Write it against dossier.schema.json using the `+
    `page text dumped above. Every Evidence.quote must appear verbatim in a `+
    `dumped page, never in a search snippet.`); }

/* -- 5. validate --------------------------------------------------------- */
console.log(`\n## Stage 5/6 validate (offline)`);
const report=validateDossier(raw);
if(!report.ok){
  console.error(JSON.stringify(report.errors,null,2));
  fail('validate',`${report.errors.length} structural error(s). Fix the dossier; `+
    `do not weaken the contract to make it pass.`);
  throw new Error('unreachable');   // fail() exits, this only narrows the type
}
for(const w of report.warnings)
  console.log(`  warning ${w.code} @ ${w.path}: ${w.message}`);

/* -- 6. render ----------------------------------------------------------- */
console.log(`\n## Stage 6/6 render (offline)`);
const artifacts=renderArtifacts(report,{maxChars:5000});
await mkdir('out',{recursive:true});
const tmp=artifactsPath+'.tmp-'+process.pid;
try{
  await writeFile(tmp,JSON.stringify(artifacts,null,2)+'\n',{flag:'wx'});
  await rename(tmp,artifactsPath);           // atomic: never a partial artifact
}finally{await rm(tmp,{force:true});}

console.log(`\n${artifactsPath} : ${artifacts[1].length}/5000 chars`);
console.log(`  [0] ${artifacts[0]}`);
console.log(`\nSTRUCTURE ACCEPTED. This is NOT verified fact. The consumer must`);
console.log(`verify every reference before using this to write anything.`);
