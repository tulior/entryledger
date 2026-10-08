/**
 * EntryLedger is a SHAPE contract for a research handoff, not a proof system.
 *
 * validateDossier checks structure and internal consistency: cross-references,
 * coverage bookkeeping, stance logic, dates, and that a brief is renderable.
 * It does not fetch sources or decide whether anything is true. These tests
 * therefore assert that a malformed dossier fails loudly and that a
 * well-formed one passes, and they assert the renderer's own guarantees.
 *
 * The consumer of out/artifacts.json verifies the references.
 */
import { test, expect } from 'bun:test';
import {DossierSchema,DossierStandardSchema,validateDossier,type Dossier} from './contract.ts';
import {renderArtifacts,auditRender,LOAD_BEARING} from './render.ts';

const at='2026-10-08T00:00:00Z';
const p=(v:string)=>({precision:'day' as const,value:v});
const URL_PRIMARY='https://example.org/atlas/mock-announcement';
const URL_REVIEW='https://example.org/atlas/mock-review';

export const fixture:Dossier={
  origin:'synthetic_fixture',subjectEntityId:'kestrel',
  article:{title:'Kestrel Atlas (fictional test project)',alternatives:['Kestrel Atlas'],
    scope:'standalone_candidate',scopeClaimIds:['identity'],disambiguationClaimIds:[]},
  entities:[{id:'kestrel',kind:'work',name:'Kestrel Atlas',aliases:[]}],
  sources:[
    {id:'project',url:URL_PRIMARY,title:'Mock announcement',authors:['Synthetic Author'],
     publisher:'Mock Project',kind:'primary',published:p('2025-06-12'),accessed:at,
     quality:{assessment:'low',rationale:'Synthetic primary fixture',
       independenceRationale:'Not independent',editorialOversight:false,
       coverage:'substantial',limitations:['Fictional test data']}},
    {id:'review',url:URL_REVIEW,title:'Mock external review',authors:['Invented Reviewer'],
     publisher:'Mock Review',kind:'independent_secondary',published:p('2025-06-13'),accessed:at,
     quality:{assessment:'low',rationale:'Synthetic secondary fixture',
       independenceRationale:'Fictionally separate authorship',editorialOversight:false,
       coverage:'passing',limitations:['Not a real publication']}}
  ],
  evidence:[
    {id:'ev1',sourceId:'project',url:URL_PRIMARY,
     quote:'Kestrel Atlas is a fictional project used in software contract tests.',
     locator:'§1',stance:'supports',challengesClaimIds:[],observedAt:at},
    {id:'ev2',sourceId:'project',url:URL_PRIMARY,
     quote:'The atlas consists of annotated maps of imaginary bird migrations.',
     locator:'§1',stance:'supports',challengesClaimIds:[],observedAt:at},
    {id:'ev3',sourceId:'review',url:URL_REVIEW,
     quote:'This example is fabricated for testing and is not a historical subject.',
     locator:'§2',stance:'supports',challengesClaimIds:[],observedAt:at}
  ],
  claims:[
    {id:'identity',category:'identity',subjectEntityId:'kestrel',predicate:'is',
      proposition:'Kestrel Atlas is a fictional test project.',qualifiers:[],
      editorialRisk:'critical',status:'verified',evidenceIds:['ev1'],verification:'direct'},
    {id:'definition',category:'definition',subjectEntityId:'kestrel',predicate:'consists_of',
      proposition:'It consists of maps of imaginary bird migrations.',qualifiers:[],
      editorialRisk:'high',status:'verified',evidenceIds:['ev2'],verification:'direct'},
    {id:'limit',category:'limitations',subjectEntityId:'kestrel',predicate:'not_real',
      proposition:'This is invented test data, not a real historical subject.',qualifiers:[],
      editorialRisk:'critical',status:'verified',evidenceIds:['ev3'],verification:'direct'}
  ],
  researchActions:[{id:'search1',question:'Is standalone encyclopedic coverage warranted?',
    method:'search',performedAt:at,outcome:'Synthetic examples cannot establish notability.',
    sourceIds:[],resolved:false}],
  coverage:[
    ...(['identity','definition','limitations'] as const).map(category=>
      ({category,state:'covered' as const,reason:'Represented by a claim',
        attemptIds:[],blocking:false})),
    ...(['disambiguation','scope','chronology','people_organizations','relationships',
      'characteristics','significance','reception','controversies'] as const).map(category=>
      ({category,state:'not_applicable' as const,reason:'Not relevant to the toy fixture',
        attemptIds:[],blocking:false})),
    {category:'editorial_cautions',state:'covered',reason:'Risk guidance present',
      attemptIds:[],blocking:false}
  ],
  editorialRules:[{id:'warn_fixture',severity:'critical',directive:'avoid',
    text:'Do not present this synthetic fixture as a genuine historical subject.',
    groundedClaimIds:['limit']}],
  notability:{assessment:'insufficient',
    rationale:'No real independent reporting supports a standalone article.',
    independentSourceIds:[],researchActionIds:['search1']},
  presentation:{requiredClaimIds:['identity','limit','definition'],
    requiredRuleIds:['warn_fixture'],
    weights:[{claimId:'definition',utility:60}]}
};

const clone=()=>structuredClone(fixture) as Dossier;
function ready(d:Dossier=clone()){
  const r=validateDossier(d,{allowSyntheticFixture:true});
  expect(r.ok).toBe(true);
  if(!r.ok)throw Error(JSON.stringify(r.errors));
  return r;
}
const codes=(d:Dossier)=>{
  const r=validateDossier(d,{allowSyntheticFixture:true});
  return r.ok?[]:r.errors.map(e=>e.code);
};

test('canonical TypeBox schema is strict native JSON Schema 2020-12',()=>{
  const schema=JSON.parse(JSON.stringify(DossierSchema));
  expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
  expect(schema.additionalProperties).toBe(false);
  expect(schema.required).toContain('entities');
  expect(JSON.stringify(schema)).not.toContain('receiptId');
});

test('Standard Schema validates direct JSON without conversion',async()=>{
  const json=JSON.parse(JSON.stringify(fixture));
  const checked=await DossierStandardSchema['~standard'].validate(json);
  expect('issues' in checked).toBe(false);
});

test('strict schema rejects unrecognized properties and missing arrays',async()=>{
  const extra=structuredClone(fixture) as typeof fixture & {legacy?:boolean};
  extra.legacy=true;
  expect('issues' in await DossierStandardSchema['~standard'].validate(extra)).toBe(true);
  const missing=structuredClone(fixture);
  delete (missing.entities[0] as Partial<typeof missing.entities[number]>).aliases;
  expect('issues' in await DossierStandardSchema['~standard'].validate(missing)).toBe(true);
});

test('renderer emits exactly two deterministic artifacts',()=>{
  const pair=renderArtifacts(ready());
  expect(pair).toHaveLength(2);
  expect(pair[0]).toBe('Kestrel Atlas (fictional test project)');
  expect(pair[1].length).toBeLessThanOrEqual(5000);
  expect(pair[1]).toContain('SOURCES:');
  expect(renderArtifacts(ready())).toEqual(pair);
});

test('every citation marker resolves to a source in the bibliography',()=>{
  const brief=renderArtifacts(ready())[1];
  const used=[...brief.matchAll(/\[S(\d+):/g)].map(m=>Number(m[1]));
  expect(used.length).toBeGreaterThan(0);
  const listed=new Set([...brief.matchAll(/^S(\d+) https/gm)].map(m=>Number(m[1])));
  for(const id of used) expect(listed.has(id)).toBe(true);
});

test('forged success reports cannot authorize rendering or auditing',()=>{
  expect(()=>renderArtifacts({ok:true,dossier:fixture,warnings:[]} as never))
    .toThrow(/UNVALIDATED_DOSSIER/);
});

test('synthetic fixture origin is not publishable by default',()=>{
  const r=validateDossier(fixture);
  expect(r.ok).toBe(false);
  if(!r.ok)expect(r.errors.some(e=>e.code==='SYNTHETIC_NOT_PUBLISHABLE')).toBe(true);
});

test('dangling references are rejected',()=>{
  const d=clone(); d.claims[0]!.subjectEntityId='missing';
  expect(codes(d)).toContain('DANGLING_REFERENCE');
});

test('an evidence record must point at a declared source',()=>{
  const d=clone(); d.evidence[0]!.sourceId='nope';
  expect(codes(d)).toContain('DANGLING_REFERENCE');
});

test('impossible calendar days are rejected',()=>{
  const d=clone(); d.sources[0]!.published=p('2025-02-30');
  expect(codes(d)).toContain('INVALID_CALENDAR_DATE');
});

test('verified claims require at least one supporting record',()=>{
  const d=clone(); d.evidence[0]!.stance='context';
  expect(codes(d)).toContain('UNSUPPORTED_VERIFIED_CLAIM');
});

test('contradicting evidence must not be cited as support',()=>{
  const d=clone(); d.evidence[0]!.stance='challenges';
  expect(codes(d)).toContain('CONTRADICTORY_CITED_AS_SUPPORT');
});

test('a claim contradicted by evidence may not stay verified',()=>{
  const d=clone();
  d.evidence[2]!.stance='challenges';
  d.evidence[2]!.challengesClaimIds=['identity'];
  expect(codes(d)).toContain('UNDISCLOSED_CONTRADICTION');
});

test('corroboration requires two distinct sources',()=>{
  const d=clone();
  const claim=d.claims[0]!;
  if(claim.status!=='verified')throw Error('fixture claim is not verified');
  claim.verification='corroborated';
  expect(codes(d)).toContain('FALSE_CORROBORATION');
});

test('an unused evidence record is rejected',()=>{
  const d=clone();
  d.evidence.push({...d.evidence[0]!,id:'ev_orphan'});
  expect(codes(d)).toContain('ORPHAN_EVIDENCE');
});

test('all thirteen coverage categories must be accounted for',()=>{
  const d=clone();
  d.coverage=d.coverage.filter(c=>c.category!=='reception');
  expect(codes(d)).toContain('MISSING_COVERAGE');
});

test('a blocking coverage entry is refused',()=>{
  const d=clone(); d.coverage[0]!.blocking=true;
  expect(codes(d)).toContain('UNRESOLVED_BLOCKER');
});

test('critical claims and rules must be required in presentation',()=>{
  const d=clone(); d.presentation.requiredClaimIds=[];
  expect(codes(d)).toContain('CRITICAL_OMITTED');
});

/* ---- judgments the consumer owns: these travel as warnings, not failures ---- */

test('thin notability evidence is a warning, not a blocker',()=>{
  const d=clone();
  d.notability={assessment:'established',rationale:'asserted',
    independentSourceIds:['review'],researchActionIds:['search1']};
  d.sources[1]!.quality={...d.sources[1]!.quality,coverage:'substantial',
    editorialOversight:true,assessment:'high'};
  const r=validateDossier(d,{allowSyntheticFixture:true});
  expect(r.ok).toBe(true);
  expect(r.warnings.map(w=>w.code)).toContain('THIN_NOTABILITY_EVIDENCE');
});

test('an undocumented gap is a warning, not a blocker',()=>{
  const d=clone();
  d.coverage[3]!.state='unresolved';
  const r=validateDossier(d,{allowSyntheticFixture:true});
  expect(r.ok).toBe(true);
  expect(r.warnings.map(w=>w.code)).toContain('UNDOCUMENTED_GAP');
});

test('a resolved report is frozen',()=>{
  expect(Object.isFrozen(ready().dossier)).toBe(true);
});

/* ---- renderer guarantees ---- */

test('mandatory editorial information never silently truncates',()=>{
  expect(()=>renderArtifacts(ready(),{maxChars:500})).toThrow(/MANDATORY_OVERFLOW/);
});

test('losing a load-bearing category is refused; losing an ordinary one is not',()=>{
  const d=clone();
  d.presentation.requiredClaimIds=['identity','limit']; // definition becomes optional
  const report=ready(d);
  const audit=auditRender(report,{maxChars:600});
  expect(audit.lostCategories).toContain('definition');
  expect(()=>renderArtifacts(report,{maxChars:600})).toThrow(/CATEGORY_OMITTED/);
});

test('load-bearing categories are exactly the three agreed',()=>{
  expect([...LOAD_BEARING]).toEqual(['definition','limitations','editorial_cautions']);
});

test('a brief that loses only ordinary categories is reported, not refused',()=>{
  // Add optional claims in an ordinary category so the cap has something to
  // shed that is not load-bearing. The definition must survive.
  const d=clone();
  for(let i=0;i<6;i++)
    d.claims.push({...d.claims[1]!,id:`pad${i}`,category:'reception',
      editorialRisk:'normal',status:'verified',verification:'direct',
      proposition:`A padded reception observation number ${i} used only to occupy budget.`,
      evidenceIds:['ev1']});
  d.coverage.find(c=>c.category==='reception')!.state='covered';
  const report=ready(d);
  const audit=auditRender(report,{maxChars:900});
  expect(audit.dropped.length).toBeGreaterThan(0);
  expect(audit.lostCategories).not.toContain('definition');
  expect(audit.lostCategories).not.toContain('limitations');
  expect(()=>renderArtifacts(report,{maxChars:900})).not.toThrow();
});

test('the audit reports what the cap discarded instead of hiding it',()=>{
  const audit=auditRender(ready(),{maxChars:900});
  expect(audit.chars).toBeLessThanOrEqual(900);
  expect(audit.dropped.length+audit.included.length).toBeGreaterThan(0);
  expect(auditRender(ready(),{maxChars:900})).toEqual(audit);
});
