/**
 * Evidence receipts must match live HTTPS source text. Hashes alone are NOT
 * provenance: a model can hash invented text. The verifier re-fetches the URL,
 * re-checks the quoted span and rejects tampered receipts.
 *
 * There is no external LLM judge. The researching agent reads the sources and
 * judges entailment itself; this layer only proves a quotation came from the
 * page it claims to come from.
 */
import {createHash} from 'node:crypto';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {lookup} from 'node:dns/promises';
import {isIP} from 'node:net';
import type {ReceiptVerifier, EvidenceRecord, SourceRecord} from '../contract.ts';

export type Receipt = {
  url:string;
  fetchedAt:string;
  rawTextHash:string;
  rawText:string;
};
export type Page = {url:string; title:string; rawText:string};
export type FetchPage = (url:string)=>Promise<Page>;
export type VerifierOptions = {
  receiptsDir?:string;
  fetchPage?:FetchPage;
};

export const sha256=(value:string)=>
  createHash('sha256').update(value,'utf8').digest('hex');
export const receiptId=(url:string,quote:string)=>
  'r'+sha256(url+'\n'+quote).slice(0,24);

const entityMap:Record<string,string>={
  amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',
  mdash:'—',ndash:'–',hellip:'…',lsquo:'‘',rsquo:'’',
  ldquo:'“',rdquo:'”',copy:'©',reg:'®'
};
/** Stable text extraction shared by capture and verification.
 * Does not claim to parse JS-rendered pages or PDFs. */
export function htmlToText(html:string):string{
  return html
    .replace(/<(?:script|style|noscript|svg|template)\b[^>]*>[\s\S]*?<\/(?:script|style|noscript|svg|template)\s*>/gi,' ')
    .replace(/<!--[\s\S]*?-->/g,' ')
    .replace(/<[^>]+>/g,' ')
    .replace(/&(#(?:x[0-9a-f]+|\d+)|[a-z][a-z0-9]+);/gi,(_all,entity:string)=>{
      if(entity[0]==='#'){
        const n=entity[1]?.toLowerCase()==='x'
          ?parseInt(entity.slice(2),16):parseInt(entity.slice(1),10);
        return Number.isInteger(n)&&n>0&&n<=0x10ffff?String.fromCodePoint(n):' ';
      }
      return entityMap[entity.toLowerCase()]??' ';
    })
    .replace(/\s+/g,' ').trim();
}

export function assertPublicUrl(value:string):URL{
  const url=new URL(value);
  if(url.protocol!=='https:'||url.username||url.password||url.port)
    throw Error('Only credential-free HTTPS on port 443 is allowed.');
  const host=url.hostname.toLowerCase().replace(/\.$/,'');
  if(!host.includes('.')||host==='localhost'||host.endsWith('.localhost')||
     host.endsWith('.local')||host.endsWith('.internal')||
     host.endsWith('.test')||host.endsWith('.invalid')||
     /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)||
     /^\[.*\]$/.test(host))
    throw Error('Local, literal-IP or unqualified hosts are not supported.');
  return url;
}

/** True for any address that must never be reachable through the fetcher:
 * loopback, RFC1918, link-local (incl. cloud metadata), CGNAT, multicast,
 * reserved and IPv6 equivalents. */
export function isPrivateAddress(ip:string):boolean{
  const kind=isIP(ip);
  if(!kind) return false;
  if(kind===4){
    const o=ip.split('.').map(Number) as [number,number,number,number];
    const [a,b]=o;
    if(a===0||a===10||a===127) return true;
    if(a===169&&b===254) return true;           // link-local + cloud metadata
    if(a===172&&b>=16&&b<=31) return true;
    if(a===192&&b===168) return true;
    if(a===100&&b>=64&&b<=127) return true;     // CGNAT
    if(a===192&&b===0) return true;             // 192.0.0.0/24 + 192.0.2.0/24
    if(a===198&&(b===18||b===19)) return true;  // benchmarking
    if(a>=224) return true;                      // multicast + reserved + broadcast
    return false;
  }
  const v=ip.toLowerCase();
  if(v==='::'||v==='::1') return true;
  if(v.startsWith('fe80')||v.startsWith('fc')||v.startsWith('fd')) return true; // link-local, ULA
  if(v.startsWith('ff')) return true;                                            // multicast
  // IPv4-mapped / IPv4-compatible (::ffff:127.0.0.1) must be unwrapped first.
  const mapped=v.match(/^::(?:ffff:)?(\d{1,3}(?:\.\d{1,3}){3})$/);
  if(mapped) return isPrivateAddress(mapped[1]!);
  return false;
}

/** Resolve the hostname and refuse any address in private/reserved space.
 * This is the control that string validation alone cannot provide: it defeats
 * DNS rebinding because the address actually dialled is the one checked. */
export async function assertPublicUrlResolved(url:URL):Promise<void>{
  const host=url.hostname.replace(/^\[|\]$/g,'');
  let addrs:{address:string}[];
  try{ addrs=await lookup(host,{all:true,verbatim:true}); }
  catch{ throw Error('Host could not be resolved.'); }
  if(!addrs.length) throw Error('Host resolved to no addresses.');
  for(const {address} of addrs)
    if(isPrivateAddress(address))
      throw Error('Host resolves to a private, loopback or link-local address.');
}

/** Fetch a bounded live representation. Redirects are checked hop by hop.
 * Every hop is DNS-resolved and refused if it lands in private/reserved space,
 * so a rebinding host cannot reach internal services (see assertPublicUrlResolved). */
export async function livePage(url:string):Promise<Page>{
  let current=assertPublicUrl(url).href;
  for(let redirects=0;redirects<5;redirects++){
    await assertPublicUrlResolved(new URL(current));
    const res=await fetch(current,{redirect:'manual',signal:AbortSignal.timeout(15000),
      headers:{'User-Agent':'EntryLedger/1.0 (evidence verification)'}});
    if([301,302,303,307,308].includes(res.status)){
      const location=res.headers.get('location');
      if(!location)throw Error('Redirect without location');
      current=assertPublicUrl(new URL(location,current).href).href;
      continue;
    }
    if(!res.ok)throw Error('Source HTTP '+res.status);
    const type=(res.headers.get('content-type')??'').toLowerCase();
    if(type && !/(?:text\/|application\/(?:json|xml|xhtml\+xml))/.test(type))
      throw Error('Unsupported response type: '+type);
    const reader=res.body?.getReader();
    if(!reader)throw Error('Empty HTTP response');
    const chunks:Uint8Array[]=[];
    let size=0;
    try {
      for(;;){
        const next=await reader.read();
        if(next.done)break;
        size+=next.value.byteLength;
        if(size>2_000_000)throw Error('Source exceeded 2 MB');
        chunks.push(next.value);
      }
    } finally {reader.releaseLock();}
    const buffer=new Uint8Array(size);
    let offset=0;
    for(const chunk of chunks){buffer.set(chunk,offset);offset+=chunk.length;}
    const html=new TextDecoder().decode(buffer);
    const titleMatch=html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title=titleMatch?htmlToText(titleMatch[1]!):'';
    const rawText=/(?:html|xml)/.test(type)?htmlToText(html):html.replace(/\s+/g,' ').trim();
    if(!rawText)throw Error('Source contains no readable text');
    return {url:current,title,rawText};
  }
  throw Error('Too many redirects');
}

function pathFor(dir:string,id:string):string{
  if(!/^r[a-f0-9]{24}$/.test(id))throw Error('Invalid receipt ID');
  return join(dir,id+'.json');
}
/** Canonical form used for all URL identity comparisons. WHATWG URL parsing
 * already normalizes case, default ports and a missing path to "/", so comparing
 * canonical hrefs makes "https://example.com" and "https://example.com/" the
 * same source while still rejecting real cross-host redirects. */
const canonical=(value:string|URL):string=>assertPublicUrl(String(value)).href;

export async function captureReceipt(url:string, quote:string,
  options:{receiptsDir?:string;fetchPage?:FetchPage}={}):Promise<{id:string;receipt:Receipt}>{
  const requested=canonical(url);
  if(quote.length<12)throw Error('Evidence quote must contain at least 12 characters');
  const fetchPage=options.fetchPage??livePage;
  const page=await fetchPage(requested);
  if(canonical(page.url)!==requested)
    throw Error('Use final canonical HTTPS URL: '+page.url);
  if(!page.rawText.includes(quote))throw Error('QUOTE_NOT_IN_LIVE_PAGE');
  const id=receiptId(requested,quote);
  const receipt:Receipt={
    url:requested,fetchedAt:new Date().toISOString(),
    rawTextHash:sha256(page.rawText),rawText:page.rawText
  };
  const dir=options.receiptsDir??'receipts';
  await mkdir(dir,{recursive:true});
  await writeFile(pathFor(dir,id),JSON.stringify(receipt,null,2)+'\n',{flag:'w'});
  return {id,receipt};
}

async function loadReceipt(dir:string,id:string):Promise<Receipt>{
  const raw=JSON.parse(await readFile(pathFor(dir,id),'utf8')) as Partial<Receipt>;
  if(typeof raw.url!=='string'||typeof raw.rawText!=='string'||
     typeof raw.rawTextHash!=='string'||typeof raw.fetchedAt!=='string'||
     !Number.isFinite(Date.parse(raw.fetchedAt))||
     sha256(raw.rawText)!==raw.rawTextHash)
    throw Error('Invalid receipt integrity or metadata');
  return raw as Receipt;
}

export function createReceiptVerifier(options:VerifierOptions={}):ReceiptVerifier{
  const dir=options.receiptsDir??'receipts';
  const fetchPage=options.fetchPage??livePage;
  const cache=new Map<string,Promise<Page>>();
  const getPage=(url:string)=>{
    let pending=cache.get(url);
    if(!pending){pending=fetchPage(url);cache.set(url,pending);}
    return pending;
  };
  return {
    /** The quote must still be present on the live page, and the receipt on
     * disk must be unaltered and bound to that exact url+quote pair. */
    async verify(source:SourceRecord,evidence:EvidenceRecord){
      try{
        const target=canonical(source.url);
        const receipt=await loadReceipt(dir,evidence.receiptId);
        if(canonical(receipt.url)!==target||
           receiptId(target,evidence.quote)!==evidence.receiptId||
           !receipt.rawText.includes(evidence.quote))return false;
        const page=await getPage(target);
        return canonical(page.url)===target&&page.rawText.includes(evidence.quote);
      }catch{return false;}
    }
  };
}
