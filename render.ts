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

type Segment={id:string,kind:'claim'|'rule'|'meta',mandatory:boolean,utility:number,
  text:string,category:string,sourceIds:string[]};
export function renderArtifacts(
  validated:ValidatedDossier,
  options:{maxChars?:number; tokenEstimate?:CostEstimate}={}
):Artifacts {
  assertValidatedReport(validated);
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
    return lines.join('\n');
  };
  // Mandatory safety information and references must fit in full, or rendering fails.
  let result=compose();
  if(result.length>max) throw Error(`MANDATORY_OVERFLOW: ${result.length} > ${max}`);
  const optional=segments.filter(s=>!s.mandatory).sort((a,b)=>{
    const aDensity=a.utility/countTokens(a.text), bDensity=b.utility/countTokens(b.text);
    return bDensity-aDensity || b.utility-a.utility || a.id.localeCompare(b.id);
  });
  for(const s of optional){
    const id=`${s.kind}:${s.id}`; ids.add(id);
    const trial=compose();
    if(trial.length<=max) result=trial;
    else ids.delete(id);
  }
  // Re-render from selected IDs to defend against algorithm changes.
  result=compose();
  if(result.length>max) throw Error('RENDER_OVERFLOW');
  if(!/\[[Ss]\d+:/.test(result)) throw Error('NO_INLINE_CITATIONS');
  if(result.includes('\u0000')) throw Error('INVALID_TEXT');
  return Object.freeze([quoteChar(d.article.title),result]) as Artifacts;
}
