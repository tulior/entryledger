import { test, expect } from 'bun:test';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {DossierSchema,DossierStandardSchema,validateDossier,type ReceiptVerifier,type Dossier,type ValidatedDossier} from './contract.ts';
import {renderArtifacts, auditRender} from './render.ts';

const at='2026-10-08T00:00:00Z';
const p=(v:string)=>({precision:'day' as const,value:v});
const quote1='Kestrel Atlas is a fictional project used in software contract tests.';
const quote2='The atlas consists of annotated maps of imaginary bird migrations.';
const quote3='The mock release date is 2025-06-12.';
const quote4='This example is fabricated for testing and is not a historical subject.';
const quote5='The design helps illustrate evidence trails, not historical significance.';

/** Controlled synthetic corpus, never real-world sources or publishing evidence. */
export const receipts:Record<string,{url:string,locator:string,body:string}>={
  rec1:{url:'https://example.org/atlas/mock-announcement',locator:'§1',body:quote1+' '+quote2+' '+quote3},
  rec2:{url:'https://example.org/atlas/mock-review',locator:'§2',body:quote4+' '+quote5}
};
export const synthVerifier:ReceiptVerifier={
  // Receipt authentication only: the quotation must occur in the stored source
  // text. Whether it supports the claim is the researching agent's judgement.
  async verify(source,evidence){
    const r=receipts[evidence.receiptId];
    if(!r||r.url!==source.url||r.locator!==evidence.locator)return 'invalid';
    return r.body.includes(evidence.quote)?'authentic':'absent';
  }
};

export const fixture:Dossier={
  origin:'synthetic_fixture',subjectEntityId:'kestrel',
  article:{title:'Kestrel Atlas (fictional test project)',alternatives:['Kestrel Atlas'],
    scope:'standalone_candidate',scopeClaimIds:['identity'],disambiguationClaimIds:[]},
  entities:[{id:'kestrel',kind:'work',name:'Kestrel Atlas',aliases:[]}],
  sources:[
    {id:'project',url:'https://example.org/atlas/mock-announcement',
     title:'Mock announcement',authors:['Synthetic Author'],publisher:'Mock Project',
     kind:'primary',published:p('2025-06-12'),accessed:at,
     quality:{assessment:'low',rationale:'Synthetic primary fixture',
       independenceRationale:'Not independent',editorialOversight:false,
       coverage:'substantial',limitations:['Fictional test data']}},
    {id:'review',url:'https://example.org/atlas/mock-review',
     title:'Mock external review',authors:['Invented Reviewer'],publisher:'Mock Review',
     kind:'independent_secondary',published:p('2025-06-13'),accessed:at,
     quality:{assessment:'low',rationale:'Synthetic secondary fixture',
       independenceRationale:'Fictionally separate authorship',editorialOversight:false,
       coverage:'passing',limitations:['Not a real publication']}}
  ],
  evidence:[
    {id:'ev1',sourceId:'project',receiptId:'rec1',quote:quote1,locator:'§1',stance:'supports',challengesClaimIds:[],observedAt:at},
    {id:'ev2',sourceId:'project',receiptId:'rec1',quote:quote2,locator:'§1',stance:'supports',challengesClaimIds:[],observedAt:at},
    {id:'ev3',sourceId:'project',receiptId:'rec1',quote:quote3,locator:'§1',stance:'supports',challengesClaimIds:[],observedAt:at},
    {id:'ev4',sourceId:'review',receiptId:'rec2',quote:quote4,locator:'§2',stance:'supports',challengesClaimIds:[],observedAt:at},
    {id:'ev5',sourceId:'review',receiptId:'rec2',quote:quote5,locator:'§2',stance:'supports',challengesClaimIds:[],observedAt:at}
  ],
  claims:[
    {id:'identity',category:'identity',subjectEntityId:'kestrel',predicate:'is',
      proposition:'Kestrel Atlas is a fictional test project.',qualifiers:[],editorialRisk:'critical',
      status:'verified',evidenceIds:['ev1'],verification:'direct'},
    {id:'definition',category:'definition',subjectEntityId:'kestrel',predicate:'consists_of',
      proposition:'It consists of maps of imaginary bird migrations.',qualifiers:[],editorialRisk:'high',
      status:'verified',evidenceIds:['ev2'],verification:'direct'},
    {id:'release',category:'chronology',subjectEntityId:'kestrel',predicate:'mock_release',
      proposition:'Its illustrative release date is 12 June 2025.',eventDate:p('2025-06-12'),
      qualifiers:[],editorialRisk:'normal',status:'verified',evidenceIds:['ev3'],verification:'direct'},
    {id:'limit',category:'limitations',subjectEntityId:'kestrel',predicate:'not_real',
      proposition:'This is invented test data, not a real historical subject.',
      qualifiers:[],editorialRisk:'critical',status:'verified',evidenceIds:['ev4'],verification:'direct'},
    {id:'sig',category:'significance',subjectEntityId:'kestrel',predicate:'interpreted_as',
      proposition:'It illustrates evidence trails, not historical importance.',
      qualifiers:[],editorialRisk:'normal',status:'interpretation',
      attributedTo:{type:'source',sourceId:'review'},evidenceIds:['ev5'],
      uncertainty:'Illustrative source, not independent real-world confirmation'}
  ],
  researchActions:[{id:'search1',question:'Is standalone encyclopedic coverage warranted?',
    method:'search',performedAt:at,outcome:'Synthetic examples cannot establish notability.',
    sourceIds:[],resolved:false}],
  coverage:[
    ...(['identity','definition','chronology','significance','limitations'] as const).map(category=>
      ({category,state:'covered' as const,reason:'Represented by a claim',attemptIds:[],blocking:false})),
    ...(['disambiguation','scope','people_organizations','relationships','characteristics',
      'reception','controversies'] as const).map(category=>
      ({category,state:'not_applicable' as const,reason:'Not relevant to the toy fixture',attemptIds:[],blocking:false})),
    {category:'editorial_cautions',state:'covered',reason:'Risk guidance present',attemptIds:[],blocking:false}
  ],
  editorialRules:[{id:'warn_fixture',severity:'critical',directive:'avoid',
    text:'Do not present this synthetic fixture as a genuine historical subject.',
    groundedClaimIds:['limit']}],
  notability:{assessment:'insufficient',rationale:'No real independent reporting supports a standalone article.',
    independentSourceIds:[],researchActionIds:['search1']},
  presentation:{requiredClaimIds:['identity','limit','definition'],
    requiredRuleIds:['warn_fixture'],weights:[
      {claimId:'release',utility:60},{claimId:'sig',utility:30}]}
};


async function validatedFixture(){
  const report=await validateDossier(fixture,synthVerifier,{allowSyntheticFixture:true});
  expect(report.ok).toBe(true);
  if(!report.ok) throw Error(JSON.stringify(report.errors));
  return report;
}

async function ready(data:Dossier=fixture){
 const report=await validateDossier(data,synthVerifier,{allowSyntheticFixture:true});
 expect(report.ok).toBe(true);
 if(!report.ok)throw Error(JSON.stringify(report.errors));
 return report;
}
test('canonical TypeBox schema is strict native JSON Schema 2020-12',()=>{
 const schema=JSON.parse(JSON.stringify(DossierSchema));
 expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
 expect(schema.additionalProperties).toBe(false);
 expect(schema.required).toContain('entities');
 expect(schema.required).toContain('claims');
 expect(JSON.stringify(schema)).not.toContain('schemaVersion');
 expect(JSON.stringify(schema)).not.toContain('~standard');
});
test('Standard Schema validates direct LLM JSON without conversion',async()=>{
 const json=JSON.parse(JSON.stringify(fixture));
 const checked=await DossierStandardSchema['~standard'].validate(json);
 expect('issues' in checked).toBe(false);
 if(!('value' in checked))throw Error('Not validated');
 expect(checked.value).toEqual(json);
 expect((await validateDossier(json,synthVerifier,{allowSyntheticFixture:true})).ok).toBe(true);
});
test('strict schema rejects unrecognized properties and missing arrays',async()=>{
 const extra=structuredClone(fixture) as typeof fixture & {legacy?:boolean};
 extra.legacy=true;
 expect('issues' in await DossierStandardSchema['~standard'].validate(extra)).toBe(true);
 const missing=structuredClone(fixture);
 delete (missing.entities[0] as Partial<typeof missing.entities[number]>).aliases;
 expect('issues' in await DossierStandardSchema['~standard'].validate(missing)).toBe(true);
});
test('renderer emits exactly two deterministic evidence-backed artifacts',async()=>{
 const report=await ready();
 const pair=renderArtifacts(report);
 expect(pair).toHaveLength(2);
 expect(pair[0]).toBe('Kestrel Atlas (fictional test project)');
 expect(pair[1].length).toBeLessThanOrEqual(5000);
 expect(pair[1]).toMatch(/LIMITATIONS: .*\[S2:§2\]/);
 expect(pair[1]).toContain('NOTABILITY: insufficient');
 expect(pair[1]).toContain('SOURCES:');
 expect(renderArtifacts(report)).toEqual(pair);
 expect(Object.isFrozen(report.dossier)).toBe(true);
});
test('forged success reports cannot authorize rendering',()=>{
 expect(()=>renderArtifacts({ok:true,dossier:fixture,warnings:[]} as never)).toThrow(/UNVALIDATED_DOSSIER/);
});
test('synthetic data cannot authorize publication',async()=>{
 const result=await validateDossier(fixture,synthVerifier);
 expect(result.ok).toBe(false);
 if(!result.ok)expect(result.errors.some(e=>e.code==='SYNTHETIC_NOT_PUBLISHABLE')).toBe(true);
});
test('unauthenticated quotes are rejected',async()=>{
 const data=structuredClone(fixture);
 data.evidence[0]!.quote='Unrelated content not contained in the trusted receipt.';
 const result=await validateDossier(data,synthVerifier,{allowSyntheticFixture:true});
 expect(result.ok).toBe(false);
 if(!result.ok)expect(result.errors.some(e=>e.code==='UNVERIFIED_EVIDENCE')).toBe(true);
});
test('quotation authenticity is enforced, but entailment is the agent\'s judgement',async()=>{
 // Deliberate limitation, stated as a test so it cannot be forgotten:
 // rewriting a proposition while leaving its quotation intact still passes,
 // because the contract authenticates the quote against the live page and
 // nothing else. Deciding that the quote supports the proposition is the
 // researching agent's responsibility.
 const data=structuredClone(fixture);
 data.claims[0]!.proposition='A real project documented by historians.';
 expect((await validateDossier(data,synthVerifier,{allowSyntheticFixture:true})).ok).toBe(true);
 // What IS enforced: the quotation must exist on the source page.
 const forged=structuredClone(fixture);
 forged.evidence[0]!.quote='A sentence that appears on no source page at all.';
 const result=await validateDossier(forged,synthVerifier,{allowSyntheticFixture:true});
 expect(result.ok).toBe(false);
 if(!result.ok)expect(result.errors.some(e=>e.code==='UNVERIFIED_EVIDENCE')).toBe(true);
});
test('dangling references are rejected',async()=>{
 const data=structuredClone(fixture);
 data.claims[0]!.subjectEntityId='missing';
 const result=await validateDossier(data,synthVerifier,{allowSyntheticFixture:true});
 expect(result.ok).toBe(false);
 if(!result.ok)expect(result.errors.some(e=>e.code==='DANGLING_REFERENCE')).toBe(true);
});
test('invalid real calendar days fail semantic validation',async()=>{
 const data=structuredClone(fixture);
 data.sources[0]!.published={precision:'day',value:'2025-02-30'};
 const result=await validateDossier(data,synthVerifier,{allowSyntheticFixture:true});
 expect(result.ok).toBe(false);
 if(!result.ok)expect(result.errors.some(e=>e.code==='INVALID_CALENDAR_DATE')).toBe(true);
});
test('mandatory editorial information never silently truncates',async()=>{
 const report=await ready();
 expect(()=>renderArtifacts(report,{maxChars:500})).toThrow(/MANDATORY_OVERFLOW/);
});

// --- evidence expiry: drift is not fabrication --------------------------
/** The highest-value change in this patch. A quotation that was genuinely on the
 *  page when captured, and whose stored receipt still proves it, must not be
 *  reported with the same code as a fabricated one. */
test('a quotation that drifted off the page is expired, not absent',async()=>{
 const {createReceiptVerifier,receiptId,sha256}=await import('./verifier/fetch.ts');
 const dir=await mkdtemp(join(tmpdir(),'entryledger-expiry-'));
 const url='https://example.org/atlas/mock-announcement';
 const quote='subscribe 106,214';
 const captured='Audience counters: subscribe 106,214 as of the capture date.';
 const drifted='Audience counters: subscribe 106,215 as of the capture date.';
 const id=receiptId(url,quote);
 // Captured months ago: by now the counter on the live page has moved on.
 await writeFile(join(dir,id+'.json'),JSON.stringify({url,
  fetchedAt:'2026-01-05T00:00:00Z',rawTextHash:sha256(captured),rawText:captured}));
 const source={id:'project',url,title:'t',authors:[],publisher:'p',kind:'primary',
  accessed:'2026-10-08T00:00:00Z',quality:{assessment:'low',rationale:'r',
  independenceRationale:'i',editorialOversight:false,coverage:'passing',limitations:[]}};
 const evidence={id:'ev1',sourceId:'project',receiptId:id,quote,locator:'§1',
  stance:'supports',challengesClaimIds:[],observedAt:'2026-10-08T00:00:00Z'};
 const verifier=createReceiptVerifier({receiptsDir:dir,
  fetchPage:async()=>({url,title:'',rawText:drifted})});
 // Present in the receipt, gone from the live page: drift.
 expect(await verifier.verify(source as never,evidence as never)).toBe('expired');
 // Still on the live page: ordinary authentication.
 const still=createReceiptVerifier({receiptsDir:dir,fetchPage:async()=>({url,title:'',rawText:captured})});
 expect(await still.verify(source as never,evidence as never)).toBe('authentic');
 // Never on the page in the first place: a genuine absence, distinct again.
 const other='this was never on the page at all';
 const oid=receiptId(url,other);
 await writeFile(join(dir,oid+'.json'),JSON.stringify({url,
  fetchedAt:'2026-01-05T00:00:00Z',rawTextHash:sha256('unrelated text'),rawText:'unrelated text'}));
 expect(await verifier.verify(source as never,{...evidence,receiptId:oid,quote:other} as never))
  .toBe('absent');
 // The security property: a FRESH receipt cannot buy the softer diagnosis. The
 // receipt is written by the agent under test, so it may not exonerate it.
 await writeFile(join(dir,id+'.json'),JSON.stringify({url,
  fetchedAt:new Date().toISOString(),rawTextHash:sha256(captured),rawText:captured}));
 expect(await verifier.verify(source as never,evidence as never)).toBe('absent');
});
test('drift is reported as EVIDENCE_EXPIRED, never as UNVERIFIED_EVIDENCE',async()=>{
 const drifting:ReceiptVerifier={async verify(s,e){
  return e.quote===quote2?'expired':await synthVerifier.verify(s,e);
 }};
 const data=structuredClone(fixture);
 data.evidence[1]!.quote=quote2;
 const result=await validateDossier(data,drifting,{allowSyntheticFixture:true});
 expect(result.ok).toBe(false);
 if(!result.ok){
  const codes=result.errors.map(e=>e.code);
  expect(codes).toContain('EVIDENCE_EXPIRED');
  expect(codes).not.toContain('UNVERIFIED_EVIDENCE');
  const message=result.errors.find(e=>e.code==='EVIDENCE_EXPIRED')!.message;
  expect(message).toContain('do not shorten the quotation');
 }
});

// --- renderer coverage integrity -----------------------------------------
/** A dossier carrying many long, low-utility claims in one category, so the
 *  character cap has to drop some of them. */
function bloatedFixture(category:'significance'|'reception',count:number):Dossier{
 const d=structuredClone(fixture);
 for(let i=1;i<=count;i++){
  const id=`b${i}`;
  d.claims.push({id,category,subjectEntityId:'kestrel',predicate:'synthetic',
   proposition:`Synthetic filler claim ${i}: ${'padding text '.repeat(30)}`,
   qualifiers:['Qualified by a long synthetic note. '.repeat(10)],
   editorialRisk:'normal',status:'verified',evidenceIds:['ev5'],verification:'direct'});
  d.presentation.weights.push({claimId:id,utility:5});
 }
 d.coverage=d.coverage.map(c=>c.category===category
  ?{...c,state:'covered' as const,reason:'Covered by a synthetic claim'} : c);
 return d;
}
/** Smallest cap the mandatory content fits into, so no test hard-codes a character
 *  count that upstream wording changes would invalidate. */
function mandatoryFloor(report:ValidatedDossier):number{
 for(let max=500;max<=5000;max+=10){
  try{ auditRender(report,{maxChars:max}); return max; }catch(e){
   if(!/MANDATORY_OVERFLOW/.test(String((e as Error).message)))throw e;
  }
 }
 throw Error('mandatory content never fit');
}
test('losing a load-bearing category is refused; losing an ordinary one is not',async()=>{
 // The base fixture already requires definition, limitations and the caution rule,
 // so at a tight cap only the optional chronology and significance claims go.
 const report=await ready();
 const cap=mandatoryFloor(report)+20;
 const audit=auditRender(report,{maxChars:cap});
 expect(audit.lostCategories).toEqual(['chronology','significance']);
 expect(audit.dropped.map(x=>x.id).sort()).toContain('release');
 expect(audit.artifacts[1]).not.toContain('CHRONOLOGY:');
 expect(()=>renderArtifacts(report,{maxChars:cap})).not.toThrow();
 // Now make the definition optional: the same squeeze becomes fatal.
 const loose=structuredClone(fixture);
 loose.presentation.requiredClaimIds=['identity','limit'];
 const looseReport=await ready(loose);
 const looseCap=mandatoryFloor(looseReport)+20;
 let message='';
 try{renderArtifacts(looseReport,{maxChars:looseCap});}catch(e){message=(e as Error).message;}
 expect(message).toMatch(/CATEGORY_OMITTED/);
 expect(message).toContain('definition');
 // And there is no option to publish past it.
 expect(()=>renderArtifacts(looseReport,{maxChars:looseCap,strictCoverage:false} as never))
  .toThrow(/CATEGORY_OMITTED/);
});
test('dropping some claims inside a surviving category is not a failure',async()=>{
 const report=await ready(bloatedFixture('reception',10));
 const audit=auditRender(report);
 expect(audit.lostCategories).toEqual([]);
 expect(audit.dropped.length).toBeGreaterThan(0);
 expect(audit.included).toContain('reception');
 expect(audit.chars).toBeLessThanOrEqual(5000);
 expect(()=>renderArtifacts(report)).not.toThrow();
});
test('a dossier that fits reports no loss at all',async()=>{
 const report=await ready();
 const audit=auditRender(report);
 expect(audit.lostCategories).toEqual([]);
 expect(audit.dropped).toEqual([]);
 expect(audit.chars).toBeLessThanOrEqual(5000);
 expect(audit.artifacts[1]).toContain('DEFINITION:');
});
test('forged success reports cannot authorize auditing',()=>{
 expect(()=>auditRender({ok:true,dossier:fixture,warnings:[]} as never))
  .toThrow(/UNVALIDATED_DOSSIER/);
});
