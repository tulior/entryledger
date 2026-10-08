/**
 * Adversarial tests for invariants that ordinary fixtures cannot reach.
 * These assert observable behaviour, not implementation details, and they
 * fail closed: a dossier that cannot be trusted must never validate.
 */
import {test,expect} from 'bun:test';
import {validateDossier,type ReceiptVerifier,type Dossier} from '../contract.ts';
import {renderArtifacts} from '../render.ts';
import {
  assertPublicUrl,isPrivateAddress,assertPublicUrlResolved,captureReceipt
} from '../verifier/fetch.ts';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fixture,synthVerifier} from '../examples.test.ts';

const clone=()=>structuredClone(fixture) as Dossier;
async function codesFor(mut:(d:Dossier)=>void):Promise<string[]>{
  const d=clone(); mut(d);
  const r=await validateDossier(d,synthVerifier,{allowSyntheticFixture:true});
  return r.ok?[]:r.errors.map(e=>e.code);
}

test('context or challenging evidence cannot by itself carry a verified claim',async()=>{
  const codes=await codesFor(d=>{
    d.evidence[0]!.stance='context';
  });
  expect(codes).toContain('UNSUPPORTED_VERIFIED_CLAIM');
});

test('context evidence cannot manufacture corroboration',async()=>{
  const codes=await codesFor(d=>{
    d.claims[1]!.verification='corroborated';
    d.evidence[2]!.stance='context';
  });
  expect(codes).toContain('FALSE_CORROBORATION');
});

test('challenging evidence cited as support is rejected',async()=>{
  const codes=await codesFor(d=>{ d.evidence[0]!.stance='challenges'; });
  expect(codes).toContain('CONTRADICTORY_CITED_AS_SUPPORT');
});

test('contradicting evidence may exist when attached to the claim it challenges',async()=>{
  // A 'challenges' record that names the claim it contradicts is legitimate
  // evidence, not an orphan, provided that claim is no longer 'verified' and
  // the record is not also cited as support for that same claim.
  const d=clone();
  const src=d.sources[1]!;
  const quote=d.evidence[4]!.quote;   // quote already proven against src
  d.evidence.push({id:'evchallenge',sourceId:src.id,receiptId:'rec2',quote,
    locator:'§2',stance:'challenges',challengesClaimIds:['sig'],
    observedAt:'2026-10-08T00:00:00Z'});
  // the interpretation claim 'sig' keeps ev5 as its support; the new record
  // exists solely to contradict the significance reading.
  const r=await validateDossier(d,synthVerifier,{allowSyntheticFixture:true});
  expect(r.ok).toBe(true);
  if(!r.ok) console.log(r.errors.map(e=>e.code+':'+e.path).join(' | '));
});

test('contradicting evidence against a still-verified claim is refused',async()=>{
  const d=clone();
  d.evidence[4]!.stance='challenges';
  d.evidence[4]!.challengesClaimIds=['identity']; // 'identity' is verified
  const r=await validateDossier(d,synthVerifier,{allowSyntheticFixture:true});
  expect(r.ok).toBe(false);
  if(!r.ok) expect(r.errors.map(e=>e.code)).toContain('UNDISCLOSED_CONTRADICTION');
});

test('private and reserved ranges are recognised, public addresses are not',()=>{
  for(const ip of ['127.0.0.1','10.1.2.3','172.16.0.1','172.31.255.255','192.168.1.1',
    '169.254.169.254','100.64.0.1','0.0.0.0','224.0.0.1','::1','fe80::1','fd00::1',
    '::ffff:127.0.0.1','::ffff:10.0.0.1'])
    expect(isPrivateAddress(ip)).toBe(true);
  for(const ip of ['93.184.216.34','8.8.8.8','172.32.0.1','192.169.0.1','2606:2800:220:1::'])
    expect(isPrivateAddress(ip)).toBe(false);
});

test('literal and disguised private hosts never pass URL validation',()=>{
  for(const u of ['https://127.0.0.1/','https://[::1]/','https://2130706433/',
    'https://0x7f000001/','https://localhost/','https://foo.internal/',
    'https://user:pw@example.com/','https://example.com:8443/','http://example.com/'])
    expect(()=>assertPublicUrl(u)).toThrow();
});

test('a host resolving into private space is refused despite a public-looking name',async()=>{
  // Syntax-only validation cannot catch this; DNS resolution can.
  const url=assertPublicUrl('https://localtest.me/');
  expect(url.hostname).toBe('localtest.me');
  let refused=false;
  try{ await assertPublicUrlResolved(url); }catch{ refused=true; }
  expect(refused).toBe(true);
});

test('captured receipts normalise equivalent URL spellings',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'entryledger-'));
  try{
    const quote='A canonical sentence for URL normalisation.';
    const {id,receipt}=await captureReceipt('https://example.com',
      quote,{receiptsDir:dir,fetchPage:async()=>({
        url:'https://example.com/',title:'T',rawText:quote+' tail'})});
    expect(receipt.url).toBe('https://example.com/');
    // Re-capturing the trailing-slash spelling yields the same receipt identity.
    const again=await captureReceipt('https://example.com/',quote,
      {receiptsDir:dir,fetchPage:async()=>({
        url:'https://example.com/',title:'T',rawText:quote+' tail'})});
    expect(again.id).toBe(id);
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('a genuine cross-host redirect is still refused',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'entryledger-'));
  try{
    await expect(captureReceipt('https://example.com','A canonical sentence here.',
      {receiptsDir:dir,fetchPage:async()=>({
        url:'https://elsewhere.example.net/',title:'T',
        rawText:'A canonical sentence here.'})})).rejects.toThrow(/canonical HTTPS URL/);
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('a fabricated receipt cannot authenticate an invented quotation',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'entryledger-'));
  try{
    const {receiptId,sha256,createReceiptVerifier}=await import('../verifier/fetch.ts');
    const url='https://example.org/real';
    const live='The genuine article says only this.';
    const invented='The article states the treaty ended in 1875.';
    const id=receiptId(url,invented);
    // Agent writes a receipt file itself, with a self-consistent hash.
    const body=live+' '+invented;
    await writeFile(join(dir,id+'.json'),JSON.stringify({
      url,fetchedAt:new Date().toISOString(),rawTextHash:sha256(body),rawText:body}));
    const verifier=createReceiptVerifier({
      receiptsDir:dir,
      fetchPage:async u=>({url:u,title:'T',rawText:live})});
    const source={id:'s',url,title:'T',authors:[],publisher:'P',kind:'primary',
      accessed:'2026-10-08T00:00:00Z',quality:{assessment:'high',rationale:'x',
      independenceRationale:'x',editorialOversight:true,coverage:'substantial',
      limitations:[]}} as const;
    const evidence={id:'e',sourceId:'s',receiptId:id,quote:invented,locator:'p1',
      stance:'supports',challengesClaimIds:[],observedAt:'2026-10-08T00:00:00Z'} as const;
    // Self-consistent hash is not provenance: the live page must still contain it.
    // The receipt is freshly written, so this is fabrication, not page drift.
    expect(await verifier.verify(source as never,evidence as never)).toBe('absent');
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('a tampered receipt body is rejected even when the quote still matches',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'entryledger-'));
  try{
    const {createReceiptVerifier}=await import('../verifier/fetch.ts');
    const url='https://example.org/real';
    const quote='Genuine quoted sentence for tampering.';
    const {id}=await captureReceipt(url,quote,{receiptsDir:dir,
      fetchPage:async u=>({url:u,title:'T',rawText:quote+' more'})});
    const path=join(dir,id+'.json');
    const rec=JSON.parse(await Bun.file(path).text());
    rec.rawText=rec.rawText+' TAMPERED';
    await writeFile(path,JSON.stringify(rec));
    const verifier=createReceiptVerifier({receiptsDir:dir,
      fetchPage:async u=>({url:u,title:'T',rawText:quote+' more'})});
    const source={id:'s',url,title:'T',authors:[],publisher:'P',kind:'primary',
      accessed:'2026-10-08T00:00:00Z',quality:{assessment:'high',rationale:'x',
      independenceRationale:'x',editorialOversight:true,coverage:'substantial',
      limitations:[]}} as const;
    const evidence={id:'e',sourceId:'s',receiptId:id,quote,locator:'p1',
      stance:'supports',challengesClaimIds:[],observedAt:'2026-10-08T00:00:00Z'} as const;
    // Integrity failure: whatever the verdict is, it must not authenticate.
    expect(await verifier.verify(source as never,evidence as never)).not.toBe('authentic');
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('an always-true verifier cannot make a contradicted claim verified',async()=>{
  // Structural rules must hold even when receipt verification rubber-stamps
  // everything, so no verifier can launder a contradiction into a pass.
  const d=clone();
  d.evidence[4]!.stance='challenges';
  d.evidence[4]!.challengesClaimIds=['identity'];
  const alwaysTrue:ReceiptVerifier={async verify(){return true}};
  const r=await validateDossier(d,alwaysTrue,{allowSyntheticFixture:true});
  expect(r.ok).toBe(false);
});

test('rendering refuses a report that never passed validation',()=>{
  expect(()=>renderArtifacts({ok:true,dossier:fixture,warnings:[]} as never))
    .toThrow(/UNVALIDATED_DOSSIER/);
});
