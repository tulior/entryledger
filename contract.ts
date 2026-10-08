/** EntryLedger: native TypeBox JSON Schema, with no input transformations. */
import Type from 'typebox';
import Value from 'typebox/value';

const obj=<P extends Parameters<typeof Type.Object>[0]>(properties:P)=>
  Type.Object(properties,{additionalProperties:false});
const ID=Type.String({minLength:2,maxLength:64,pattern:'^[a-z][a-z0-9_-]{1,63}$'});
const S=Type.String({minLength:1,pattern:'\\S'});
const Time=Type.String({pattern:'^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$'});
const Day=Type.String({pattern:'^\\d{4}-\\d{2}-\\d{2}$'});
const Dated=Type.Union([
 obj({precision:Type.Literal('year'),value:Type.String({pattern:'^\\d{4}$'})}),
 obj({precision:Type.Literal('month'),value:Type.String({pattern:'^\\d{4}-(0[1-9]|1[0-2])$'})}),
 obj({precision:Type.Literal('day'),value:Day})
]);
const Categories=['identity','disambiguation','scope','definition','chronology',
 'people_organizations','relationships','characteristics','significance',
 'reception','controversies','limitations','editorial_cautions'] as const;
const Category=Type.Union([
 Type.Literal('identity'),Type.Literal('disambiguation'),Type.Literal('scope'),
 Type.Literal('definition'),Type.Literal('chronology'),Type.Literal('people_organizations'),
 Type.Literal('relationships'),Type.Literal('characteristics'),Type.Literal('significance'),
 Type.Literal('reception'),Type.Literal('controversies'),Type.Literal('limitations'),
 Type.Literal('editorial_cautions')]);
export type Category=Type.Static<typeof Category>;
const Entity=obj({id:ID,kind:Type.Union([
 Type.Literal('person'),Type.Literal('organization'),Type.Literal('place'),
 Type.Literal('work'),Type.Literal('event'),Type.Literal('concept'),
 Type.Literal('artifact'),Type.Literal('other')]),name:S,aliases:Type.Array(S)});
const Source=obj({
 id:ID,url:Type.String({pattern:'^https?://\\S+$'}),title:S,
 authors:Type.Array(S),publisher:S,kind:Type.Union([
 Type.Literal('primary'),Type.Literal('independent_secondary'),
 Type.Literal('affiliated_secondary'),Type.Literal('tertiary')]),
 published:Type.Optional(Dated),accessed:Time,
 quality:obj({assessment:Type.Union([
 Type.Literal('high'),Type.Literal('medium'),Type.Literal('low'),Type.Literal('unassessed')]),
 rationale:S,independenceRationale:S,editorialOversight:Type.Boolean(),
 coverage:Type.Union([Type.Literal('substantial'),Type.Literal('passing'),
 Type.Literal('reference')]),limitations:Type.Array(S)})});
const Evidence=obj({
 id:ID,sourceId:ID,receiptId:ID,quote:Type.String({minLength:12,pattern:'\\S'}),
 locator:S,stance:Type.Union([
 Type.Literal('supports'),Type.Literal('challenges'),Type.Literal('context')]),
 challengesClaimIds:Type.Array(ID),observedAt:Time});
const ObjectValue=Type.Union([
 obj({type:Type.Literal('entity'),entityId:ID}),
 obj({type:Type.Literal('literal'),value:S,unit:Type.Optional(S)})
]);
const Attribution=Type.Union([
 obj({type:Type.Literal('entity'),entityId:ID}),
 obj({type:Type.Literal('source'),sourceId:ID})
]);
const Base=obj({
 id:ID,category:Category,subjectEntityId:ID,predicate:S,proposition:S,
 object:Type.Optional(ObjectValue),eventDate:Type.Optional(Dated),
 qualifiers:Type.Array(S),exclusiveGroupId:Type.Optional(ID),
 editorialRisk:Type.Union([
 Type.Literal('critical'),Type.Literal('high'),Type.Literal('normal')])});
const Verified=obj({...Base.properties,status:Type.Literal('verified'),
 evidenceIds:Type.Array(ID,{minItems:1}),
 verification:Type.Union([Type.Literal('direct'),Type.Literal('corroborated')])});
const Attributed=obj({...Base.properties,status:Type.Literal('attributed'),
 evidenceIds:Type.Array(ID,{minItems:1}),attributedTo:Attribution});
const Interpretation=obj({...Base.properties,status:Type.Literal('interpretation'),
 evidenceIds:Type.Array(ID,{minItems:1}),attributedTo:Attribution,uncertainty:S});
const Disputed=obj({...Base.properties,status:Type.Literal('disputed'),
 positions:Type.Array(obj({position:S,attributedTo:Attribution,
 evidenceIds:Type.Array(ID,{minItems:1})}),{minItems:2}),uncertainty:S});
const Unknown=obj({...Base.properties,status:Type.Literal('unknown'),
 question:S,attemptIds:Type.Array(ID,{minItems:1}),uncertainty:S});
export const ClaimSchema=Type.Union([Verified,Attributed,Interpretation,Disputed,Unknown]);
export type Claim=Type.Static<typeof ClaimSchema>;
const ResearchAction=obj({
 id:ID,question:S,method:Type.Union([Type.Literal('search'),Type.Literal('document_review'),
 Type.Literal('expert_contact'),Type.Literal('other')]),performedAt:Time,
 outcome:S,sourceIds:Type.Array(ID),resolved:Type.Boolean()});
const Coverage=obj({
 category:Category,state:Type.Union([Type.Literal('covered'),Type.Literal('not_applicable'),
 Type.Literal('unresolved')]),reason:S,attemptIds:Type.Array(ID),blocking:Type.Boolean()});
const Rule=obj({
 id:ID,severity:Type.Union([Type.Literal('critical'),Type.Literal('high'),
 Type.Literal('normal')]),directive:Type.Union([Type.Literal('avoid'),
 Type.Literal('require'),Type.Literal('qualify'),Type.Literal('context')]),
 text:S,groundedClaimIds:Type.Array(ID,{minItems:1})});
const Notability=obj({assessment:Type.Union([Type.Literal('established'),
 Type.Literal('uncertain'),Type.Literal('insufficient')]),rationale:S,
 independentSourceIds:Type.Array(ID),researchActionIds:Type.Array(ID)});
const Presentation=obj({requiredClaimIds:Type.Array(ID),requiredRuleIds:Type.Array(ID),
 weights:Type.Array(obj({claimId:ID,utility:Type.Integer({minimum:1,maximum:100})}))});

/** Canonical IR = native strict JSON Schema Draft 2020-12, directly LLM-readable. */
export const DossierSchema=Type.Object({
 origin:Type.Union([Type.Literal('research'),Type.Literal('synthetic_fixture')]),
 subjectEntityId:ID,
 article:obj({title:Type.String({minLength:1,maxLength:180,pattern:'\\S'}),
 alternatives:Type.Array(S),scope:Type.Union([
 Type.Literal('standalone_candidate'),Type.Literal('broader_section_candidate'),
 Type.Literal('undecided')]),scopeClaimIds:Type.Array(ID,{minItems:1}),
 disambiguationClaimIds:Type.Array(ID)}),
 entities:Type.Array(Entity,{minItems:1}),sources:Type.Array(Source),
 evidence:Type.Array(Evidence),claims:Type.Array(ClaimSchema,{minItems:1}),
 researchActions:Type.Array(ResearchAction),coverage:Type.Array(Coverage),
 editorialRules:Type.Array(Rule),notability:Notability,presentation:Presentation
},{$schema:'https://json-schema.org/draft/2020-12/schema',additionalProperties:false});
export type Dossier=Type.Static<typeof DossierSchema>;
export type SourceRecord=Type.Static<typeof Source>;
export type EvidenceRecord=Type.Static<typeof Evidence>;

/** Standard Schema v1 structural validation without translating the JSON IR. */
export const DossierStandardSchema={
 '~standard':{
   version:1 as const,vendor:'entryledger-typebox',
   validate(value:unknown){
     if(Value.Check(DossierSchema,value))return {value:value as Dossier};
     return {issues:Array.from(Value.Errors(DossierSchema,value),e=>({message:e.message}))};
   },
   types:{} as {input:Dossier;output:Dossier}
 }
} as const;

export type Diagnostic = {
  code:string; path:string; message:string; severity:'error'|'warning';
};
const certification = Symbol('dossier-validated');
const certifiedReports = new WeakSet<object>();
export type ValidatedDossier = {
  readonly ok:true; readonly dossier:Dossier; readonly warnings:readonly Diagnostic[];
  readonly [certification]:true;
};
export type ValidationReport = ValidatedDossier |
  {ok:false; errors:Diagnostic[]; warnings:Diagnostic[]};
export function assertValidatedReport(report:ValidatedDossier):void {
  if(!certifiedReports.has(report)) throw Error('UNVALIDATED_DOSSIER');
}
const deepFreeze=(value:unknown):void=>{
  if(value!==null&&typeof value==='object'&&!Object.isFrozen(value)){
    for(const v of Object.values(value)) deepFreeze(v);
    Object.freeze(value);
  }
};

/** Inject an independent, trusted receipt store or retrieval service.
 * Must authenticate receiptId, source URL, captured content, and exact quote/locator.
 * Never use an agent-authored 'verified=true' flag as proof.
 */
export interface EvidenceVerifier {
  verify(source:SourceRecord, evidence:EvidenceRecord):Promise<boolean>;
  /** Independent reviewer attests that the evidence actually supports the
   * statement AS CLASSIFIED (e.g., reported claim vs. independently true fact).
   * This cannot be replaced by substring/keyword matching.
   */
  reviewStatement(statement:string, status:Claim['status'],
    evidence:EvidenceRecord[]):Promise<boolean>;
  /** Validates provenance and source metadata, not merely a syntactically valid URL. */
  reviewSource(source:SourceRecord):Promise<boolean>;
}

const diag=(code:string,path:string,message:string,severity:'error'|'warning'='error'):
  Diagnostic => ({code,path,message,severity});
const distinct=<T>(items:T[]) => new Set(items).size===items.length;

export async function validateDossier(raw:unknown, verifier:EvidenceVerifier,
  options:{allowSyntheticFixture?:boolean}={}):Promise<ValidationReport> {
  if(!Value.Check(DossierSchema,raw))return {ok:false,warnings:[],
    errors:Array.from(Value.Errors(DossierSchema,raw),e=>{
      const path=(e as {path?:string;instancePath?:string}).instancePath ??
        (e as {path?:string}).path ?? '/';
      return diag('SHAPE',path,e.message);
    })};
  const d=raw as Dossier, errors:Diagnostic[]=[], warnings:Diagnostic[]=[];
  // JSON Schema cannot check impossible calendar days; no input mutation needed.
  const validDay=(s:string)=>{
    const n=Date.parse(s+'T00:00:00.000Z');
    return Number.isFinite(n)&&new Date(n).toISOString().slice(0,10)===s;
  };
  const checkDate=(v:{precision:'year'|'month'|'day';value:string}|undefined,path:string)=>{
    if(v?.precision==='day'&&!validDay(v.value))
      errors.push(diag('INVALID_CALENDAR_DATE',path,'Invalid Gregorian calendar day.'));
  };
  d.sources.forEach((source,i)=>checkDate(source.published,`sources.${i}.published`));
  d.claims.forEach((claim,i)=>checkDate(claim.eventDate,`claims.${i}.eventDate`));
  const checkTime=(stamp:string,path:string)=>{
    if(!validDay(stamp.slice(0,10))||!Number.isFinite(Date.parse(stamp)))
      errors.push(diag('INVALID_TIMESTAMP',path,'Invalid RFC3339 date-time.'));
  };
  d.sources.forEach((s,i)=>checkTime(s.accessed,`sources.${i}.accessed`));
  d.evidence.forEach((e,i)=>checkTime(e.observedAt,`evidence.${i}.observedAt`));
  d.researchActions.forEach((a,i)=>checkTime(a.performedAt,`researchActions.${i}.performedAt`));
  const fail=(code:string,path:string,message:string)=>errors.push(diag(code,path,message));
  const warn=(code:string,path:string,message:string)=>warnings.push(diag(code,path,message,'warning'));
  if(d.origin==='synthetic_fixture' && !options.allowSyntheticFixture)
    fail('SYNTHETIC_NOT_PUBLISHABLE','origin','Synthetic test evidence cannot authorize publication.');
  const unique=<T extends {id:string}>(a:T[],key:string)=>{
    if(!distinct(a.map(x=>x.id))) fail('DUPLICATE_ID',key,'IDs must be unique within their namespace.');
    return new Map(a.map(x=>[x.id,x]));
  };
  const ents=unique(d.entities,'entities'), srcs=unique(d.sources,'sources'),
    evs=unique(d.evidence,'evidence'), cls=unique(d.claims,'claims'),
    acts=unique(d.researchActions,'researchActions'), rules=unique(d.editorialRules,'editorialRules');
  const exists=(m:Map<string,unknown>,id:string,path:string)=>{
    if(!m.has(id)) fail('DANGLING_REFERENCE',path,`Unknown ID: ${id}`);
  };
  exists(ents,d.subjectEntityId,'subjectEntityId');
  d.article.scopeClaimIds.forEach(id=>exists(cls,id,'article.scopeClaimIds'));
  d.article.disambiguationClaimIds.forEach(id=>exists(cls,id,'article.disambiguationClaimIds'));
  if(!d.claims.some(c=>c.category==='identity'&&c.status==='verified'&&c.subjectEntityId===d.subjectEntityId))
    fail('MISSING_IDENTITY','claims','A supported subject-identity claim is required.');
  if(!d.claims.some(c=>c.category==='definition'&&c.status!=='unknown'&&c.subjectEntityId===d.subjectEntityId))
    fail('MISSING_DEFINITION','claims','A sourced definition is required.');
  const evidenceUsed=new Set<string>();
  const verifiedGroups=new Map<string,string>();
  const validateRefs=(ids:string[],claimId:string,stance:'supports'|'any')=>{
    const sourceIds=new Set<string>();
    for(const id of ids){
      evidenceUsed.add(id); exists(evs,id,`claims.${claimId}.evidenceIds`);
      const ev=evs.get(id);
      if(ev){
        sourceIds.add(ev.sourceId);
        if(stance==='supports'&&ev.stance!=='supports')
          fail('BAD_EVIDENCE_STANCE',`claims.${claimId}`,`Evidence ${id} does not support claim.`);
      }
    }
    return sourceIds;
  };
  const checkAttribution=(a:Type.Static<typeof Attribution>,path:string,sourceIds:Set<string>)=>{
    if(a.type==='entity') exists(ents,a.entityId,path);
    else {exists(srcs,a.sourceId,path); if(!sourceIds.has(a.sourceId))
      fail('UNSOURCED_ATTRIBUTION',path,'Attribution must appear among cited evidence sources.');}
  };
  for(const c of d.claims){
    if(c.category==='chronology'&&c.status==='verified'&&!c.eventDate)
      fail('UNDATED_CHRONOLOGY',`claims.${c.id}`,'Verified chronology needs an eventDate.');
    exists(ents,c.subjectEntityId,`claims.${c.id}.subjectEntityId`);
    if(c.object?.type==='entity') exists(ents,c.object.entityId,`claims.${c.id}.object`);
    if(c.status==='unknown'){
      c.attemptIds.forEach(id=>exists(acts,id,`claims.${c.id}.attemptIds`));
      if(c.editorialRisk==='critical') warn('CRITICAL_UNKNOWN',`claims.${c.id}`,'Critical knowledge gap; must be rendered.');
    } else if(c.status==='disputed'){
      if(distinct(c.positions.map(p=>p.position))===false)
        fail('DUPLICATE_POSITION',`claims.${c.id}`,'Dispute positions must be distinct.');
      const opposing=new Set<string>();
      for(const [i,p] of c.positions.entries()){
        const si=validateRefs(p.evidenceIds,c.id,'supports');
        si.forEach(s=>opposing.add(s));
        checkAttribution(p.attributedTo,`claims.${c.id}.positions.${i}`,si);
      }
      if(opposing.size<2) fail('UNSUPPORTED_DISPUTE',`claims.${c.id}`,
        'Disputed positions must draw on at least two different sources.');
    } else {
      const si=validateRefs(c.evidenceIds,c.id,'supports');
      if(c.status==='verified'&&c.verification==='corroborated'&&si.size<2)
        fail('FALSE_CORROBORATION',`claims.${c.id}`,'Corroborated requires two distinct sources.');
      if(c.status==='attributed'||c.status==='interpretation')
        checkAttribution(c.attributedTo,`claims.${c.id}.attributedTo`,si);
      if(c.status==='verified'&&c.exclusiveGroupId){
        if(verifiedGroups.has(c.exclusiveGroupId)) fail('UNRESOLVED_CONFLICT',`claims.${c.id}`,
          `Two verified claims share exclusive group ${c.exclusiveGroupId}; adjudicate or mark disputed.`);
        verifiedGroups.set(c.exclusiveGroupId,c.id);
      }
    }
  }
  for(const e of d.evidence){
    exists(srcs,e.sourceId,`evidence.${e.id}.sourceId`);
    if(!evidenceUsed.has(e.id)) fail('ORPHAN_EVIDENCE',`evidence.${e.id}`,
      'All evidence must be associated with a claim and reviewed.');
    for(const id of e.challengesClaimIds){
      exists(cls,id,`evidence.${e.id}.challengesClaimIds`);
      if(cls.get(id)?.status==='verified') fail('UNDISCLOSED_CONTRADICTION',
        `evidence.${e.id}`,`Claim ${id} has contradictory evidence; dispute or adjudicate it.`);
    }
  }
  for(const a of d.researchActions)
    a.sourceIds.forEach(id=>exists(srcs,id,`researchActions.${a.id}.sourceIds`));
  for(const r of d.editorialRules)
    r.groundedClaimIds.forEach(id=>exists(cls,id,`editorialRules.${r.id}.groundedClaimIds`));
  const coverageCats=d.coverage.map(c=>c.category);
  if(!distinct(coverageCats)) fail('DUPLICATE_COVERAGE','coverage','Each category occurs once.');
  for(const cat of Categories) if(!coverageCats.includes(cat))
    fail('MISSING_COVERAGE','coverage',`Unassessed category: ${cat}`);
  for(const c of d.coverage){
    if(c.state==='covered'&&!d.claims.some(k=>k.category===c.category) &&
      !(c.category==='editorial_cautions'&&d.editorialRules.length>0))
      fail('EMPTY_COVERAGE',`coverage.${c.category}`,'Covered means a claim is present.');
    c.attemptIds.forEach(id=>exists(acts,id,`coverage.${c.category}.attemptIds`));
    if(c.state==='unresolved'&&c.attemptIds.length===0)
      fail('UNSEARCHED_GAP',`coverage.${c.category}`,'Unresolved gap requires a research action.');
    if(c.blocking) fail('UNRESOLVED_BLOCKER',`coverage.${c.category}`,c.reason);
    if(c.state==='not_applicable'&&(d.claims.some(k=>k.category===c.category&&k.status!=='unknown') ||
      (c.category==='editorial_cautions'&&d.editorialRules.length>0)))
      fail('INCONSISTENT_COVERAGE',`coverage.${c.category}`,'Category has claims but is N/A.');
  }
  d.presentation.requiredClaimIds.forEach(id=>exists(cls,id,'presentation.requiredClaimIds'));
  d.presentation.requiredRuleIds.forEach(id=>exists(rules,id,'presentation.requiredRuleIds'));
  d.presentation.weights.forEach(w=>exists(cls,w.claimId,'presentation.weights'));
  if(!distinct(d.presentation.weights.map(w=>w.claimId)))
    fail('DUPLICATE_WEIGHT','presentation.weights','Only one utility per claim.');
  for(const c of d.claims.filter(c=>c.editorialRisk==='critical'))
    if(!d.presentation.requiredClaimIds.includes(c.id))
      fail('CRITICAL_OMITTED','presentation.requiredClaimIds',`Include critical claim ${c.id}.`);
  for(const r of d.editorialRules.filter(r=>r.severity==='critical'))
    if(!d.presentation.requiredRuleIds.includes(r.id))
      fail('CRITICAL_RULE_OMITTED','presentation.requiredRuleIds',`Include critical rule ${r.id}.`);
  if(d.article.scope==='standalone_candidate'&&d.notability.assessment==='insufficient')
    warn('STANDALONE_UNESTABLISHED','article.scope','Proposed title is tentative; explain sourcing limitation.');
  for(const id of d.notability.independentSourceIds){
    exists(srcs,id,'notability.independentSourceIds');
    if(srcs.get(id)?.kind!=='independent_secondary')
      fail('NOT_INDEPENDENT','notability.independentSourceIds',`${id} is not independent secondary.`);
    if(![...evidenceUsed].some(evId=>evs.get(evId)?.sourceId===id))
      fail('UNEXAMINED_NOTABILITY_SOURCE','notability.independentSourceIds',
        `${id} has no reviewed evidence linked to any claim.`);
  }
  d.notability.researchActionIds.forEach(id=>exists(acts,id,'notability.researchActionIds'));
  if(d.notability.assessment==='established'){
    const good=d.notability.independentSourceIds.filter(id=>{
      const s=srcs.get(id);
      return s?.kind==='independent_secondary'&&s.quality.coverage==='substantial'&&
        s.quality.editorialOversight&&s.quality.assessment!=='low';
    });
    if(new Set(good.map(id=>srcs.get(id)?.publisher)).size<2)
      fail('NOTABILITY_NOT_ESTABLISHED','notability',
        'Default conservative rubric: >=2 substantial independent sources with distinct publishers.');
  } else if(!d.notability.researchActionIds.length)
    fail('NOTABILITY_UNASSESSED','notability.researchActionIds',
      'Uncertain/insufficient assessments require documented search attempts.');
  if(!d.article.title.includes(ents.get(d.subjectEntityId)?.name??''))
    warn('TITLE_NAME_MISMATCH','article.title','Review proposed title against canonical subject name.');

  // The external verifier is independent of agent-authored dossier fields.
  // Quote authentication AND entailment/source appraisal are required.
  if(!errors.length){
    await Promise.all(d.sources.map(async source=>{
      try {if(!await verifier.reviewSource(source)) fail('UNREVIEWED_SOURCE',
        `sources.${source.id}`,'Trusted reviewer rejected source metadata/provenance.');}
      catch {fail('SOURCE_REVIEW_ERROR',`sources.${source.id}`,'Source review failed closed.');}
    }));
    await Promise.all([...evidenceUsed].map(async id=>{
      const ev=evs.get(id), source=ev && srcs.get(ev.sourceId);
      if(!ev||!source) return;
      try {if(!await verifier.verify(source,ev))
        fail('UNVERIFIED_EVIDENCE',`evidence.${id}`,'Trusted receipt/quote/locator did not verify.');}
      catch {fail('RECEIPT_ERROR',`evidence.${id}`,'Trusted verification failed closed.');}
    }));
    await Promise.all(d.claims.filter(c=>c.status!=='unknown').flatMap(c=>{
      const statements=c.status==='disputed'?c.positions.map(p=>
        ({statement:p.position,evidenceIds:p.evidenceIds})): [{
        statement:c.proposition,evidenceIds:c.evidenceIds}];
      return statements.map(async item=>{
        const evidence=item.evidenceIds.map(id=>evs.get(id)!);
        try {if(!await verifier.reviewStatement(item.statement,c.status,evidence))
          fail('UNREVIEWED_CLAIM',`claims.${c.id}`,'Semantic entailment review rejected claim.');}
        catch {fail('CLAIM_REVIEW_ERROR',`claims.${c.id}`,'Claim review failed closed.');}
      });
    }));
  }
  if(errors.length) return {ok:false,errors:errors.sort((a,b)=>a.path.localeCompare(b.path)||a.code.localeCompare(b.code)),warnings};
  const report:ValidatedDossier={ok:true,dossier:d,warnings,[certification]:true};
  deepFreeze(report);
  certifiedReports.add(report);
  return report;
}
