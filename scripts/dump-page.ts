/**
 * Print a source page as the pipeline extracts it, so quotations can be copied
 * exactly. This is the only command that touches the network.
 *
 * Usage: bun run page:dump <url> [substring-to-show-context-for]
 */
import {dumpPage} from '../research/page.ts';

const url=process.argv[2];
if(!url)throw Error('Usage: bun run page:dump <url> [grep]');
const grep=process.argv[3];
const dump=await dumpPage(url,grep?{grep}:{});
console.log(`# ${dump.url}`);
console.log(`# title: ${dump.title}`);
console.log(`# ${dump.chars} characters of extracted text\n`);
console.log(dump.text);
