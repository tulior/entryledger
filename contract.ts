/** Evidence-grounded encyclopedia research dossier, v1. Zod 4 + TypeScript 5.
 * Domain facts never carry render-ready citations: those are derived from evidence.
 */
import { z } from 'zod';

const ID = z.string().regex(/^[a-z][a-z0-9_-]{1,63}$/);
const S = z.string().trim().min(1);
const Day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => {
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}, 'Invalid calendar date');
const Time = z.iso.datetime({offset: true});
const Dated = z.discriminatedUnion('precision', [
  z.object({precision:z.literal('year'), value:z.string().regex(/^\d{4}$/)}).strict(),
  z.object({precision:z.literal('month'), value:z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/)}).strict(),
  z.object({precision:z.literal('day'), value:Day}).strict(),
]);
const Category = z.enum([
  'identity','disambiguation','scope','definition','chronology','people_organizations',
  'relationships','characteristics','significance','reception','controversies',
  'limitations','editorial_cautions'
]);
export type Category = z.infer<typeof Category>;
const Categories = Category.options;

const Entity = z.object({
  id:ID, kind:z.enum(['person','organization','place','work','event','concept','artifact','other']),
  name:S, aliases:z.array(S).default([])
}).strict();
const Source = z.object({
  id:ID, url:z.url(), title:S, authors:z.array(S).default([]), publisher:S,
  kind:z.enum(['primary','independent_secondary','affiliated_secondary','tertiary']),
  published:Dated.optional(), accessed:Time,
  quality:z.object({
    assessment:z.enum(['high','medium','low','unassessed']),
    rationale:S, independenceRationale:S,
    editorialOversight:z.boolean(), coverage:z.enum(['substantial','passing','reference']),
    limitations:z.array(S).default([])
  }).strict()
}).strict();
const Evidence = z.object({
  id:ID, sourceId:ID, receiptId:ID, quote:z.string().trim().min(12), locator:S,
  stance:z.enum(['supports','challenges','context']),
  challengesClaimIds:z.array(ID).default([]), observedAt:Time
}).strict();
const ObjectValue = z.discriminatedUnion('type', [
  z.object({type:z.literal('entity'), entityId:ID}).strict(),
  z.object({type:z.literal('literal'), value:S, unit:S.optional()}).strict()
]);
const Attribution = z.discriminatedUnion('type', [
  z.object({type:z.literal('entity'), entityId:ID}).strict(),
  z.object({type:z.literal('source'), sourceId:ID}).strict()
]);
const Base = z.object({
  id:ID, category:Category, subjectEntityId:ID, predicate:S, proposition:S,
  object:ObjectValue.optional(), eventDate:Dated.optional(),
  qualifiers:z.array(S).default([]), exclusiveGroupId:ID.optional(),
  editorialRisk:z.enum(['critical','high','normal']).default('normal')
}).strict();
const Supported = Base.extend({
  status:z.literal('verified'), evidenceIds:z.array(ID).min(1),
  verification:z.enum(['direct','corroborated']),
});
const Attributed = Base.extend({
  status:z.literal('attributed'), evidenceIds:z.array(ID).min(1), attributedTo:Attribution
});
const Interpretation = Base.extend({
  status:z.literal('interpretation'), evidenceIds:z.array(ID).min(1), attributedTo:Attribution,
  uncertainty:S
});
const Disputed = Base.extend({
  status:z.literal('disputed'),
  positions:z.array(z.object({position:S, attributedTo:Attribution,
    evidenceIds:z.array(ID).min(1)}).strict()).min(2),
  uncertainty:S
});
const Unknown = Base.extend({
  status:z.literal('unknown'), question:S, attemptIds:z.array(ID).min(1), uncertainty:S
});
export const ClaimSchema = z.discriminatedUnion('status',
  [Supported, Attributed, Interpretation, Disputed, Unknown]);
export type Claim = z.infer<typeof ClaimSchema>;

const ResearchAction = z.object({
  id:ID, question:S, method:z.enum(['search','document_review','expert_contact','other']),
  performedAt:Time, outcome:S, sourceIds:z.array(ID).default([]), resolved:z.boolean()
}).strict();
const Coverage = z.object({
  category:Category, state:z.enum(['covered','not_applicable','unresolved']),
  reason:S, attemptIds:z.array(ID).default([]), blocking:z.boolean().default(false)
}).strict();
const Rule = z.object({
  id:ID, severity:z.enum(['critical','high','normal']),
  directive:z.enum(['avoid','require','qualify','context']), text:S,
  groundedClaimIds:z.array(ID).min(1)
}).strict();
const Notability = z.object({
  assessment:z.enum(['established','uncertain','insufficient']), rationale:S,
  independentSourceIds:z.array(ID), researchActionIds:z.array(ID),
  // Technical/subject-matter significance is conveyed by claims, NOT by this assessment.
}).strict();
const Presentation = z.object({
  requiredClaimIds:z.array(ID), requiredRuleIds:z.array(ID),
  weights:z.array(z.object({claimId:ID, utility:z.number().int().min(1).max(100)}).strict())
}).strict();

export const DossierSchema = z.object({
  schemaVersion:z.literal('1.0.0'), origin:z.enum(['research','synthetic_fixture']),
  subjectEntityId:ID,
  article:z.object({
    title:S.max(180), alternatives:z.array(S),
    scope:z.enum(['standalone_candidate','broader_section_candidate','undecided']),
    scopeClaimIds:z.array(ID).min(1), disambiguationClaimIds:z.array(ID)
  }).strict(),
  entities:z.array(Entity).min(1), sources:z.array(Source),
  evidence:z.array(Evidence), claims:z.array(ClaimSchema).min(1),
  researchActions:z.array(ResearchAction), coverage:z.array(Coverage),
  editorialRules:z.array(Rule), notability:Notability, presentation:Presentation
}).strict();
export type Dossier = z.infer<typeof DossierSchema>;
export type SourceRecord = z.infer<typeof Source>;
export type EvidenceRecord = z.infer<typeof Evidence>;

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
  const parsed=DossierSchema.safeParse(raw);
  if (!parsed.success) return {ok:false,errors:parsed.error.issues.map(i=>
    diag('SHAPE',i.path.join('.'),i.message)), warnings:[]};
  const d=parsed.data, errors:Diagnostic[]=[], warnings:Diagnostic[]=[];
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
  const checkAttribution=(a:z.infer<typeof Attribution>,path:string,sourceIds:Set<string>)=>{
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