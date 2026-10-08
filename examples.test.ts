import { test, expect } from 'bun:test';
import {DossierSchema,DossierStandardSchema,validateDossier,type EvidenceVerifier,type Dossier} from './contract.ts';
import {renderArtifacts} from './render.ts';

const at='2026-10-08T00:00:00Z';
const p=(v:string)=>({precision:'day' as const,value:v});
const quote1='Kestrel Atlas is a fictional project used in software contract tests.';
const quote2='The atlas consists of annotated maps of imaginary bird migrations.';
const quote3='The mock release date is 2025-06-12.';
const quote4='This example is fabricated for testing and is not a historical subject.';
const quote5='The design helps illustrate evidence trails, not historical significance.';

/** Controlled synthetic corpus, never real-world sources or publishing evidence. */
const receipts:Record<string,{url:string,locator:string,body:string}>={
  rec1:{url:'https://example.org/atlas/mock-announcement',locator:'§1',body:quote1+' '+quote2+' '+quote3},
  rec2:{url:'https://example.org/atlas/mock-review',locator:'§2',body:quote4+' '+quote5}
};
const verifier:EvidenceVerifier={
  async reviewSource(source){return Object.values(receipts).some(r=>r.url===source.url);},
  async reviewStatement(statement,status,evidence){
    // Synthetic, fixed reviewed facts: this is only an integration test oracle.
    return new Set([
      'Kestrel Atlas is a fictional test project.',
      'It consists of maps of imaginary bird migrations.',
      'Its illustrative release date is 12 June 2025.',
      'This is invented test data, not a real historical subject.',
      'It illustrates evidence trails, not historical importance.'
    ]).has(statement)&&evidence.length>0;
  },
  async verify(source,evidence){
    const r=receipts[evidence.receiptId];
    return !!r&&r.url===source.url&&r.locator===evidence.locator&&r.body.includes(evidence.quote);
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
  const report=await validateDossier(fixture,verifier,{allowSyntheticFixture:true});
  expect(report.ok).toBe(true);
  if(!report.ok) throw Error(JSON.stringify(report.errors));
  return report;
}

async function ready(){
 const report=await validateDossier(fixture,verifier,{allowSyntheticFixture:true});
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
 expect((await validateDossier(json,verifier,{allowSyntheticFixture:true})).ok).toBe(true);
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
 const result=await validateDossier(fixture,verifier);
 expect(result.ok).toBe(false);
 if(!result.ok)expect(result.errors.some(e=>e.code==='SYNTHETIC_NOT_PUBLISHABLE')).toBe(true);
});
test('unauthenticated quotes are rejected',async()=>{
 const data=structuredClone(fixture);
 data.evidence[0]!.quote='Unrelated content not contained in the trusted receipt.';
 const result=await validateDossier(data,verifier,{allowSyntheticFixture:true});
 expect(result.ok).toBe(false);
 if(!result.ok)expect(result.errors.some(e=>e.code==='UNVERIFIED_EVIDENCE')).toBe(true);
});
test('unreviewed claims cannot be declared verified',async()=>{
 const data=structuredClone(fixture);
 data.claims[0]!.proposition='A real project documented by historians.';
 const result=await validateDossier(data,verifier,{allowSyntheticFixture:true});
 expect(result.ok).toBe(false);
 if(!result.ok)expect(result.errors.some(e=>e.code==='UNREVIEWED_CLAIM')).toBe(true);
});
test('dangling references are rejected',async()=>{
 const data=structuredClone(fixture);
 data.claims[0]!.subjectEntityId='missing';
 const result=await validateDossier(data,verifier,{allowSyntheticFixture:true});
 expect(result.ok).toBe(false);
 if(!result.ok)expect(result.errors.some(e=>e.code==='DANGLING_REFERENCE')).toBe(true);
});
test('invalid real calendar days fail semantic validation',async()=>{
 const data=structuredClone(fixture);
 data.sources[0]!.published={precision:'day',value:'2025-02-30'};
 const result=await validateDossier(data,verifier,{allowSyntheticFixture:true});
 expect(result.ok).toBe(false);
 if(!result.ok)expect(result.errors.some(e=>e.code==='INVALID_CALENDAR_DATE')).toBe(true);
});
test('mandatory editorial information never silently truncates',async()=>{
 const report=await ready();
 expect(()=>renderArtifacts(report,{maxChars:500})).toThrow(/MANDATORY_OVERFLOW/);
});
