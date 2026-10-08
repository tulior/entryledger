/**
 * Failure paths of `bun run subject`. These assert the property that matters
 * most for a handoff: a run that cannot complete leaves NO artifact behind, so
 * a consumer never mistakes a stale file for fresh work.
 */
import {test,expect} from 'bun:test';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const run=async(subject:string,env:Record<string,string>)=>{
  const dir=await mkdtemp(join(tmpdir(),'entryledger-run-'));
  const proc=Bun.spawn(['bun','run','scripts/run-subject.ts'],{
    cwd:process.cwd(),
    env:{...process.env,ARTICLE:subject,...env,ARTIFACTS:join(dir,'artifacts.json')},
    stdout:'pipe',stderr:'pipe'});
  const [out,err]=await Promise.all([new Response(proc.stdout).text(),new Response(proc.stderr).text()]);
  const code=await proc.exited;
  const artifacts=await readFile(join(dir,'artifacts.json'),'utf8').catch(()=>null);
  return {code,out,err,artifacts,dir};
};

test('no ARTICLE is a usage error, not a silent no-op',async()=>{
  const r=await run('',{});
  expect(r.code).toBe(2);
  expect(r.err).toMatch(/Usage/);
  expect(r.artifacts).toBeNull();
});

test('a missing research brief fails and writes no artifact',async()=>{
  const r=await run('Ferrari (car)',{BRIEF:'out/does-not-exist.json'});
  expect(r.code).toBe(1);
  expect(r.err).toMatch(/FAILED at stage: discover/);
  expect(r.artifacts).toBeNull();
});

test('a missing dossier fails and writes no artifact',async()=>{
  const r=await run('Ferrari (car)',
    {BRIEF:'examples/ferrari/research-brief.json',DOSSIER:'out/does-not-exist.json'});
  expect(r.code).toBe(1);
  expect(r.err).toMatch(/FAILED at stage: record/);
  expect(r.artifacts).toBeNull();
});

test('a structurally invalid dossier fails and writes no artifact',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'entryledger-bad-'));
  const bad=join(dir,'dossier.json');
  await writeFile(bad,JSON.stringify({origin:'research'}));
  try{
    const r=await run('Ferrari (car)',
      {BRIEF:'examples/ferrari/research-brief.json',DOSSIER:bad});
    expect(r.code).toBe(1);
    expect(r.err).toMatch(/FAILED at stage: validate/);
    expect(r.err).toMatch(/structural error/);
    expect(r.artifacts).toBeNull();
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('a stale artifact is destroyed before the run can fail',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'entryledger-stale-'));
  const artifacts=join(dir,'artifacts.json');
  await writeFile(artifacts,'["STALE","STALE BRIEF"]');
  const proc=Bun.spawn(['bun','run','scripts/run-subject.ts'],{
    cwd:process.cwd(),
    env:{...process.env,ARTICLE:'',BRIEF:'out/x.json',DOSSIER:'out/y.json',ARTIFACTS:artifacts},
    stdout:'pipe',stderr:'pipe'});
  await proc.exited;
  expect(await readFile(artifacts,'utf8').catch(()=>null)).toBeNull();
  await rm(dir,{recursive:true,force:true});
});
