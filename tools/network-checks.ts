/**
 * Live checks that need the network. Not a *.test.ts file, so `bun test` never
 * runs them in CI. Execute explicitly:
 *
 *   bun run tools/network-checks.ts
 *
 * Assumes: outbound HTTPS works, DNS resolves, and the listed pages are up.
 */
import {dumpPage,newBudget,BudgetExceeded,spent} from '../research/page.ts';

const assert=(label:string,ok:boolean,extra='')=>{
  console.log(`  ${ok?'OK  ':'FAIL'}  ${label}${extra?'  '+extra:''}`);
  if(!ok)process.exitCode=1;
};

console.log('retrieval budget:');
{
  const b=newBudget({maxFetches:1});
  await dumpPage('https://en.wikipedia.org/wiki/Ferrari',{},b).catch(()=>{});
  let msg='';
  try{ await dumpPage('https://en.wikipedia.org/wiki/Enzo_Ferrari',{},b); }
  catch(e){ msg=(e as Error).message; }
  assert('fetch ceiling is enforced',/Retrieval budget exhausted/.test(msg),msg.slice(0,48));
}
{
  const b=newBudget({maxBytes:1000});
  let msg='';
  try{ await dumpPage('https://en.wikipedia.org/wiki/Ferrari',{},b); }
  catch(e){ msg=(e as Error).message; }
  assert('byte ceiling is enforced',/Retrieval budget exhausted/.test(msg),msg.slice(0,48));
}
{
  const b=newBudget({deadlineMs:0});
  let msg='';
  try{ await dumpPage('https://en.wikipedia.org/wiki/Ferrari',{},b); }
  catch(e){ msg=(e as Error).message; }
  assert('wall-clock ceiling is enforced',/Retrieval budget exhausted/.test(msg),msg.slice(0,48));
}

console.log('public-destination restriction:');
for(const [url,shouldFail] of [
  ['https://localtest.me/',true],          // rebinding name for 127.0.0.1
  ['https://127.0.0.1.nip.io/',true],
  ['https://127.0.0.1/',true],
  ['https://[::1]/',true],
  ['https://example.com/',false],
] as const){
  let failed=false;
  try{ await dumpPage(url); }catch{ failed=true; }
  assert(url.padEnd(30), failed===shouldFail, failed?'refused':'fetched');
}

console.log('quotable text:');
{
  const b=newBudget();
  const d=await dumpPage('https://en.wikipedia.org/wiki/Ferrari',{},b);
  const used=spent(b);
  assert('page returns extractable text',d.chars>1000,`${d.chars}c, ${used.fetches} fetches, ${used.bytes}B`);
  console.log('  (copy quotes from text like this)');
  const i=d.text.indexOf('is an Italian luxury');
  console.log('  '+JSON.stringify(d.text.slice(i,i+78)));
}
console.log(process.exitCode?'\nSOME CHECKS FAILED':'\nall network checks passed');
