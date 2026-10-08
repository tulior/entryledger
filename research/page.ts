/**
 * Page retrieval for research. This is the ONLY module that touches the network.
 *
 * It exists so an agent can read what a source actually says before quoting it:
 * the extractor collapses whitespace and decodes entities, so a quotation must
 * match the text produced here byte for byte. Search-engine snippets do NOT match.
 *
 * Nothing here is a trust boundary. The consumer of the artifacts decides what
 * is true; this tool just makes the source text visible and quotable.
 */
import {lookup} from 'node:dns/promises';
import {isIP} from 'node:net';

export type Page = {url:string; title:string; rawText:string};
const entityMap:Record<string,string>={
  amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',
  mdash:'—',ndash:'–',hellip:'…',lsquo:'‘',rsquo:'’',
  ldquo:'“',rdquo:'”',copy:'©',reg:'®'
};
/** Whitespace-collapsed, entity-decoded text. This is what a quotation must
 * match exactly. Does not parse JS-rendered pages or PDFs. */
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


/** Cost ceiling for a whole research run. A run that exceeds it fails loudly
 * rather than quietly spending an unbounded amount of time and bandwidth. */
export const DEFAULT_BUDGET={maxFetches:40,maxBytes:8_000_000,deadlineMs:180_000};
export type Budget=typeof DEFAULT_BUDGET & {
  /** requests made so far, including redirect hops */
  fetches:number;
  /** response bytes read so far */
  bytes:number;
  /** Date.now() at creation */
  startedAt:number;
};
export class BudgetExceeded extends Error{}
export const spent=(b:Budget)=>({fetches:b.fetches,bytes:b.bytes,ms:Date.now()-b.startedAt});
export function newBudget(over:Partial<Budget>={}):Budget{
  return {...DEFAULT_BUDGET,fetches:0,bytes:0,startedAt:Date.now(),...over};
}
/** Called before every request, so a redirect chain cannot outrun the budget. */
function charge(b:Budget,bytes:number):void{
  b.fetches++;
  b.bytes+=bytes;
  if(b.fetches>b.maxFetches)
    throw new BudgetExceeded(`Retrieval budget exhausted: ${b.fetches} fetches (max ${b.maxFetches}).`);
  if(b.bytes>b.maxBytes)
    throw new BudgetExceeded(`Retrieval budget exhausted: ${b.bytes} bytes (max ${b.maxBytes}).`);
  if(Date.now()-b.startedAt>b.deadlineMs)
    throw new BudgetExceeded(`Retrieval budget exhausted: ${Date.now()-b.startedAt}ms elapsed (max ${b.deadlineMs}ms).`);
}

/** Fetch a bounded live representation. Redirects are checked hop by hop.
 * Every hop is DNS-resolved and refused if it lands in private/reserved space,
 * so a rebinding host cannot reach internal services (see assertPublicUrlResolved). */
export async function livePage(url:string, budget:Budget=newBudget()):Promise<Page>{
  let current=assertPublicUrl(url).href;
  for(let redirects=0;redirects<5;redirects++){
    charge(budget,0);
    await assertPublicUrlResolved(new URL(current));
    const res=await fetch(current,{redirect:'manual',signal:AbortSignal.timeout(15000),
      headers:{'User-Agent':'EntryLedger/1.0 (entryledger research)'}});
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
        size+=next.value.byteLength; charge(budget,next.value.byteLength);
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


/** Everything an agent needs to quote this page without guessing. */
export type Dump = {url:string; title:string; chars:number; text:string};
export async function dumpPage(url:string, options:{grep?:string}={},
  budget:Budget=newBudget()):Promise<Dump>{
  const page=await livePage(url,budget);
  const text=options.grep
    ? page.rawText.split(/(?<=\. )/).filter((s:string)=>s.includes(options.grep!)).join('')
    : page.rawText;
  return {url:page.url,title:page.title,chars:text.length,text};
}
