/**
 * Resolves the highest SemVer for each dependency, INCLUDING alpha/beta/RC
 * releases even when the npm 'latest' dist-tag points to an older stable.
 * Usage: bun run upgrade:all [--dry-run]
 */
type Manifest={
  dependencies?:Record<string,string>;
  devDependencies?:Record<string,string>;
};
type RegistryRecord={versions:Record<string,{deprecated?:string}>};
const SEMVER=/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
function parsed(version:string){
  const match=SEMVER.exec(version);
  if(!match)return undefined;
  const pre=match[4]?.split('.')??[];
  if(pre.some(s=>/^\d+$/.test(s)&&s.length>1&&s.startsWith('0')))return undefined;
  return {core:[BigInt(match[1]!),BigInt(match[2]!),BigInt(match[3]!)],pre};
}
/** SemVer 2.0 precedence; build metadata does not affect precedence. */
export function compareSemVer(a:string,b:string):number{
  const x=parsed(a),y=parsed(b);
  if(!x||!y)throw Error('Invalid SemVer comparison: '+a+' / '+b);
  for(let i=0;i<3;i++){
    if(x.core[i]!>y.core[i]!)return 1;
    if(x.core[i]!<y.core[i]!)return -1;
  }
  if(!x.pre.length&&!y.pre.length)return 0;
  if(!x.pre.length)return 1;
  if(!y.pre.length)return -1;
  for(let i=0;i<Math.min(x.pre.length,y.pre.length);i++){
    const lhs=x.pre[i]!,rhs=y.pre[i]!;
    if(lhs===rhs)continue;
    const ln=/^\d+$/.test(lhs),rn=/^\d+$/.test(rhs);
    if(ln&&rn)return BigInt(lhs)>BigInt(rhs)?1:-1;
    if(ln!==rn)return ln?-1:1;
    return lhs<rhs?-1:1;
  }
  return Math.sign(x.pre.length-y.pre.length);
}
export function selectHighestSemVer(versions:readonly string[]):string{
  const eligible=versions.filter(v=>parsed(v)!==undefined);
  if(!eligible.length)throw Error('No valid SemVer releases found');
  eligible.sort((a,b)=>compareSemVer(a,b)||a.localeCompare(b));
  return eligible.at(-1)!;
}
async function newestFromRegistry(pkg:string):Promise<string>{
  const url='https://registry.npmjs.org/'+encodeURIComponent(pkg);
  const response=await fetch(url,{
    headers:{Accept:'application/vnd.npm.install-v1+json'},
    signal:AbortSignal.timeout(30000)
  });
  if(!response.ok)throw Error('Registry request for '+pkg+' failed: HTTP '+response.status);
  const data=await response.json() as Partial<RegistryRecord>;
  if(!data.versions||typeof data.versions!=='object')throw Error('Malformed registry response for '+pkg);
  const current=Object.entries(data.versions);
  const available=current.filter(([,v])=>v&&typeof v==='object'&&!v.deprecated).map(([key])=>key);
  return selectHighestSemVer(available.length?available:current.map(([key])=>key));
}
async function run(){
  const path=import.meta.dir+'/../package.json';
  const manifest=await Bun.file(path).json() as Manifest;
  const groups=['dependencies','devDependencies'] as const;
  const names=[...new Set(groups.flatMap(group=>Object.keys(manifest[group]??{})))];
  if(!names.length)throw Error('No dependencies in manifest');
  // Fetch every release list before changing anything: no partial upgrades.
  const updates=await Promise.all(names.map(async name=>[name,await newestFromRegistry(name)] as const));
  const resolved=new Map(updates);
  for(const group of groups)for(const name of Object.keys(manifest[group]??{})){
    manifest[group]![name]=resolved.get(name)!;
  }
  for(const [name,version] of updates)console.log(name+': '+version);
  if(process.argv.includes('--dry-run')){console.log('Dry run: manifest unchanged');return;}
  await Bun.write(path,JSON.stringify(manifest,null,2)+'\n');
  const child=Bun.spawn(['bun','install'],{
    cwd:import.meta.dir+'/..',stdin:'inherit',stdout:'inherit',stderr:'inherit'
  });
  const code=await child.exited;
  if(code!==0)throw Error('bun install failed: '+code);
  console.log('package.json and bun.lock updated; commit both files.');
}
if(import.meta.main)run().catch(e=>{console.error(e);process.exitCode=1;});
