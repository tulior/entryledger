/** Only consumes a dossier returned by validateDossier: pass via a branded wrapper. */
import { assertValidatedReport, type Claim, type ValidatedDossier } from './contract.ts';

const ORDER=[
 'identity','disambiguation','scope','definition','chronology','people_organizations',
 'relationships','characteristics','significance','reception','controversies',
 'limitations','editorial_cautions'
] as const;
const categoryOrder=(s:string)=>ORDER.indexOf(s as typeof ORDER[number]);
const plain=(s:string)=>s.replace(/\s+/g,' ').trim();
const quoteChar=(s:string)=>s.replace(/[\r\n]+/g,' ');
const bgeProxy=(s:string)=>
  (s.match(/[\p{L}\p{N}]+|[^\s\p{L}\p{N}]/gu)||[]).length;
export type CostEstimate=(text:string)=>number; // injectable real BGE tokenizer counter
export type Artifacts=readonly [proposedArticleTitle:string, editorialBrief:string];

/** The consumer reads artifacts.json, not this process's string, so the cap is
 *  measured on the serialised brief: a newline costs two characters there, not
 *  one, and checking the in-memory string certifies artifacts the consumer
 *  rejects. The brief is joined on spaces and never contains a newline. */
const deliveredLength=(brief:string)=>JSON.stringify(brief).length;

/** A segment the character cap could not fit. Rendering is lossy by design, so
 *  what it discarded is reported rather than left for the caller to discover. */
export type DroppedSegment={
  id:string;kind:'claim'|'rule'|'meta';category:string;chars:number;
};
export type RenderAudit={
  artifacts:Artifacts;
  chars:number;maxChars:number;
  included:readonly string[];
  dropped:readonly DroppedSegment[];
  /** Categories that held claims or rules but emitted nothing at all. */
  lostCategories:readonly string[];
};
export type RenderOptions={maxChars?:number;tokenEstimate?:CostEstimate};
/** Categories whose absence makes a brief useless or unsafe, not merely thinner.
 *  A brief that never says what the subject is, never discloses a gap, or drops
 *  its risk guidance is worse than one that is short: it reads as finished. The
 *  other ten categories are enrichment, and a dense packer is entitled to shed
 *  them, so losing one is reported but not fatal. */
export const LOAD_BEARING=['definition','limitations','editorial_cautions'] as const;

type Segment={id:string;kind:'claim'|'rule'|'meta',mandatory:boolean,utility:number,
  text:string,category:string,sourceIds:string[]};

function pack(validated:ValidatedDossier, options:RenderOptions={}):RenderAudit{
  const d=validated.dossier, max=options.maxChars??5000;
  if(max>5000||max<500) throw Error('maxChars must be between 500 and 5000');
  const countTokens=options.tokenEstimate??bgeProxy;
  const byEvidence=new Map(d.evidence.map(e=>[e.id,e]));
  const bySource=new Map(d.sources.map(s=>[s.id,s]));
  const sourceIds=[...d.sources.map(s=>s.id)].sort();
  const citations=new Map(sourceIds.map((id,i)=>[id,`S${i+1}`]));
  const refs=(ids:string[])=>{
    const seen=new Set<string>();
    const marks:string[]=[];
    for(const id of ids){
      const e=byEvidence.get(id)!;
      const marker=`${citations.get(e.sourceId)}:${plain(e.locator)}`;
      if(!seen.has(marker)){seen.add(marker);marks.push(marker);}
    }
    return marks.length ? ` [${marks.join(',')}]` : '';
  };
  const evSources=(ids:string[])=>[...new Set(ids.map(id=>byEvidence.get(id)!.sourceId))];
  const label=(attribution:{type:'source';sourceId:string}|{type:'entity';entityId:string})=>
    attribution.type==='source'?bySource.get(attribution.sourceId)!.publisher:
    d.entities.find(e=>e.id===attribution.entityId)!.name;
  function renderClaim(c:Claim):{text:string;sourceIds:string[]}{
    if(c.status==='unknown')
      return {text:`OPEN: ${plain(c.question)} (${plain(c.uncertainty)})`,sourceIds:[]};
    if(c.status==='disputed'){
      const all=c.positions.flatMap(p=>p.evidenceIds);
      return {text:`DISPUTED ${plain(c.proposition)}: `+
        c.positions.map(p=>`${label(p.attributedTo)}: ${plain(p.position)}${refs(p.evidenceIds)}`).join(' / ')+
        `; uncertainty: ${plain(c.uncertainty)}`,
        sourceIds:evSources(all)};
    }
    let t=plain(c.proposition);
    if(c.eventDate) t+=` (event: ${c.eventDate.value})`;
    if(c.status==='attributed') t=`${label(c.attributedTo)} states: ${t}`;
    if(c.status==='interpretation') t=`${label(c.attributedTo)} interprets: ${t} (uncertain: ${plain(c.uncertainty)})`;
    if(c.qualifiers.length) t+=` (limits: ${c.qualifiers.map(plain).join('; ')})`;
    return {text:t+refs(c.evidenceIds),sourceIds:evSources(c.evidenceIds)};
  }
  const requiredClaims=new Set([...d.presentation.requiredClaimIds,...d.article.scopeClaimIds,
    ...d.article.disambiguationClaimIds]);
  const requiredRules=new Set(d.presentation.requiredRuleIds);
  const scores=new Map(d.presentation.weights.map(x=>[x.claimId,x.utility]));
  const segments:Segment[]=[];
  for(const c of d.claims){
    const out=renderClaim(c);
    segments.push({id:c.id,kind:'claim',text:out.text,category:c.category,
      mandatory:requiredClaims.has(c.id),utility:scores.get(c.id)??
      (c.editorialRisk==='critical'?100:c.editorialRisk==='high'?70:35),sourceIds:out.sourceIds});
  }
  for(const r of d.editorialRules){
    const claimSources=r.groundedClaimIds.flatMap(id=>{
      const c=d.claims.find(c=>c.id===id)!;
      return c.status==='unknown'?[]:c.status==='disputed'?
        c.positions.flatMap(p=>evSources(p.evidenceIds)):evSources(c.evidenceIds);
    });
    const groundedEvidence=r.groundedClaimIds.flatMap(id=>{
      const c=d.claims.find(c=>c.id===id)!;
      return c.status==='unknown'?[]:c.status==='disputed'?
        c.positions.flatMap(p=>p.evidenceIds):c.evidenceIds;
    });
    segments.push({id:r.id,kind:'rule',category:'editorial_cautions',
      mandatory:requiredRules.has(r.id),utility:r.severity==='critical'?100:r.severity==='high'?80:30,
      text:`${r.directive.toUpperCase()}: ${plain(r.text)}${refs(groundedEvidence)}`, 
      sourceIds:[...new Set(claimSources)]});
  }
  if(d.article.alternatives.length){
    const scopeClaims=d.claims.filter(c=>d.article.scopeClaimIds.includes(c.id) ||
      d.article.disambiguationClaimIds.includes(c.id));
    const scopeEvidence=scopeClaims.flatMap(c=>c.status==='unknown'?[]:
      c.status==='disputed'?c.positions.flatMap(p=>p.evidenceIds):c.evidenceIds);
    segments.push({id:'internal_alternatives',kind:'meta',mandatory:false,
      utility:40,category:'disambiguation',sourceIds:evSources(scopeEvidence),
      text:`ALTERNATIVES: ${d.article.alternatives.map(plain).join('; ')}${refs(scopeEvidence)}`});
  }
  const scope=`TITLE/SCOPE: ${plain(d.article.title)}; ${d.article.scope.replaceAll('_',' ')}.`;
  const assess=`NOTABILITY: ${d.notability.assessment}; ${plain(d.notability.rationale)}`+
    (d.notability.researchActionIds.length?` (research: ${d.notability.researchActionIds.join(',')})`:'');
  const ids=new Set(segments.filter(s=>s.mandatory).map(s=>`${s.kind}:${s.id}`));
  const compose=()=>{
    const chosen=segments.filter(s=>ids.has(`${s.kind}:${s.id}`));
    const sourceSet=new Set(chosen.flatMap(s=>s.sourceIds));
    const lines=[scope,assess];
    // Stable grouping; no unsupported abbreviation or sentence truncation.
    for(const category of ORDER){
      const group=chosen.filter(s=>s.category===category).sort((a,b)=>a.id.localeCompare(b.id));
      if(group.length) lines.push(`${category.toUpperCase()}: ${group.map(s=>s.text).join(' | ')}`);
    }
    const bibliography=sourceIds.filter(id=>sourceSet.has(id)).map(id=>{
      const s=bySource.get(id)!;
      return `${citations.get(id)} ${s.url} (${s.kind}; ${s.published?.value??'date unknown'})`;
    });
    if(bibliography.length) lines.push('SOURCES:',...bibliography);
    return lines.join(' ');
  };
  // Mandatory safety information and references must fit in full, or rendering fails.
  let result=compose();
  const mandatory=deliveredLength(result);
  if(mandatory>max) throw Error(`MANDATORY_OVERFLOW: ${mandatory} > ${max}`);
  const optional=segments.filter(s=>!s.mandatory).sort((a,b)=>{
    const aDensity=a.utility/countTokens(a.text), bDensity=b.utility/countTokens(b.text);
    return bDensity-aDensity || b.utility-a.utility || a.id.localeCompare(b.id);
  });
  for(const s of optional){
    const id=`${s.kind}:${s.id}`; ids.add(id);
    const trial=compose();
    if(deliveredLength(trial)<=max) result=trial;
    else ids.delete(id);
  }
  // Re-render from selected IDs to defend against algorithm changes.
  result=compose();
  if(deliveredLength(result)>max) throw Error('RENDER_OVERFLOW');
  if(!/\[[Ss]\d+:/.test(result)) throw Error('NO_INLINE_CITATIONS');
  if(result.includes('\u0000')) throw Error('INVALID_TEXT');
  if(/[\r\n]/.test(result)) throw Error('DELIVERED_NEWLINE');
  const artifacts=Object.freeze([quoteChar(d.article.title),result]) as Artifacts;
  const included=ORDER.filter(cat=>segments.some(s=>ids.has(`${s.kind}:${s.id}`)&&s.category===cat));
  // A category that asserted something and then rendered nothing is silent data
  // loss, not a rendering success: the brief reads as complete while omitting it.
  const lostCategories=ORDER.filter(cat=>
    segments.some(s=>s.category===cat&&s.kind!=='meta')&&
    !segments.some(s=>s.category===cat&&ids.has(`${s.kind}:${s.id}`)));
  const dropped=segments.filter(s=>!ids.has(`${s.kind}:${s.id}`))
    .map(s=>({id:s.id,kind:s.kind,category:s.category,chars:s.text.length}));
  return Object.freeze({artifacts,chars:JSON.stringify(artifacts[1]).length,maxChars:max,included,dropped,lostCategories});
}

const lossError=(lost:readonly string[],chars:number,max:number)=>
  Error(`CATEGORY_OMITTED: ${lost.join(', ')} — the ${max}-character cap dropped every `+
    `claim and rule in ${lost.length===1?'a load-bearing category':'load-bearing categories'}, `+
    `so the brief would read as complete while omitting ${lost.length===1?'it':'them'} `+
    `(rendered ${chars} characters). Shorten propositions, qualifiers and locators, or `+
    `raise presentation.requiredClaimIds for that category. There is no option to `+
    `publish a brief that omits what the subject is, what is unknown, or the risk guidance.`);

/** Audit-only entry point: never throws on content loss, always reports it. */
export function auditRender(validated:ValidatedDossier, options:RenderOptions={}):RenderAudit{
  assertValidatedReport(validated);
  return pack(validated,options);
}
export function renderArtifacts(validated:ValidatedDossier, options:RenderOptions={}):Artifacts{
  assertValidatedReport(validated);
  const audit=pack(validated,options);
  const lostLoadBearing=audit.lostCategories.filter(cat=>(LOAD_BEARING as readonly string[]).includes(cat));
  if(lostLoadBearing.length) throw lossError(lostLoadBearing,audit.chars,audit.maxChars);
  return audit.artifacts;
}
