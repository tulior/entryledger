/** Capture every evidence receipt in one pass, exactly as `bun run receipt:capture`
 *  would, and emit a label -> receiptId map for dossier construction. */
import {captureReceipt} from '../verifier/fetch.ts';
import {writeFile} from 'node:fs/promises';

const SRC = {
  rise_author: 'https://www.risingshadow.net/author/13829-j-mccoy',
  aethon_b1: 'https://aethonbooks.com/book/a-prince-out-of-time/',
  aethon_b4: 'https://aethonbooks.com/book/ascension-4/',
  gr_eligos: 'https://www.goodreads.com/author/list/21514986.Eligos',
  gr_jmccoy: 'https://www.goodreads.com/author/list/17072655.J_McCoy',
  animx: 'https://www.animationxpress.com/comics/webtoon-and-aethon-books-collaborate-to-adapt-14-web-novels-into-webcomics/',
  webtoon: 'https://www.webtoons.com/en/fantasy/re-monarch/list?title_no=6280',
  novellume: 'https://novellume.com/novel/re-monarch',
} as const;

const QUOTES: [label: string, src: keyof typeof SRC, quote: string][] = [
  ['E_bio_mccoy_eligos', 'rise_author', 'J. McCoy, who also writes under the name Eligos, crafts stories where logic, emotion, and consequence intertwine.'],
  ['E_bio_genre', 'rise_author', 'McCoy’s fiction lives at the intersection of speculative fantasy and LitRPG, creating worlds that feel alive because their rules matter and every decision changes the outcome.'],
  ['E_bio_rr_history', 'rise_author', 'Long before publishing A Prince Out of Time , the first book in the RE: Monarch series, McCoy built imaginary worlds inside online games and text-based adventures, experimenting with how structure shapes storytelling.'],
  ['E_rise_b4_date', 'rise_author', 'Monarch IV (RE: Monarch # 4 ) 2026 | fantasy, epic fantasy, high fantasy | Release date October 7, 2026'],
  ['E_aethon_b1_byline', 'aethon_b1', 'A Prince Out of Time RE: Monarch Book 1 By Eligos and J. McCoy'],
  ['E_aethon_b1_rr', 'aethon_b1', 'After cementing itself as one of the most beloved progression fantasy web serials on Royal Road, the RE: Monarch Series now comes to Kindle, Kindle Unlimited, and Audible (narrated by Luke Daniels).'],
  ['E_aethon_b1_meta', 'aethon_b1', 'Book Details Series RE: Monarch Author Eligos , J. McCoy Audiobook Narrator Luke Daniels Publisher Aethon Books Page Count 714'],
  ['E_aethon_b1_date', 'aethon_b1', 'Isbn13 9798801975511 ASIN B09PQGG7VV Publication Date April 19, 2022'],
  ['E_aethon_b4_byline', 'aethon_b4', 'Ascension RE: Monarch Book 4 By J. McCoy'],
  ['E_aethon_b4_meta', 'aethon_b4', 'Book Details Series RE: Monarch Author J. McCoy Audiobook Narrator Eric Michael Summerer'],
  ['E_aethon_b4_date', 'aethon_b4', 'Isbn13 9798177705538 ASIN B0HD99YKVG Publication Date October 7, 2026'],
  // Goodreads aggregates and platform counters are LIVE: rating counts, average
  // ratings, view/subscriber totals and "N distinct works" all move on their own.
  // A quote containing one is authentic at capture and unverifiable hours later,
  // so every quote below is restricted to stable byline/credit text.
  ['E_gr_eligos_b1', 'gr_eligos', 'A Prince Out of Time (RE: Monarch #1) by J. McCoy , Eligos'],
  ['E_gr_jmccoy_b1', 'gr_jmccoy', 'A Prince Out of Time (RE: Monarch #1) by J. McCoy , Eligos'],
  ['E_gr_eligos_b4', 'gr_eligos', 'Monarch IV: Ascension: RE: Monarch, Book 4 by J. McCoy , Eric Michael Summerer (Narrator) , Eligos'],
  ['E_gr_jmccoy_b4', 'gr_jmccoy', 'Monarch IV: Ascension: A Progression Fantasy Epic (RE: Monarch Book 4) by J. McCoy'],
  ['E_animx_slate', 'animx', 'Los Angeles based digital comics platform Webtoon announced it will expand its partnership with Aethon Books, adapting a slate of 14 popular web novels as webcomics, created and produced alongside studios such as Laurel Pursuit, Moonquill, Kisai Entertainment, Cocoon Productions and more.'],
  ['E_animx_mc', 'animx', 'RE: Monarch by J. McCoy – A progression fantasy epic set in a time-loop where planning and cleverness are as vital as swordplay, about a spoiled prince who discovers what it means to rule.”'],
  ['E_webtoon_credits', 'webtoon', 'Fantasy RE: Monarch AETHON , Moonquill , J. McCoy'],
  ['E_webtoon_finale', 'webtoon', 'Episode 60 (Season Finale) Jul 25, 2025'],
  ['E_webtoon_synopsis', 'webtoon', 'A progression fantasy epic set in a time-loop where planning and cleverness are as vital as swordplay, about a spoiled prince who discovers what it means to rule.'],
  ['E_webtoon_origin', 'webtoon', 'Created by Moonquill'],
  ['E_nov_year', 'novellume', 'Year of publishing: 2020'],
];

const out: Record<string, {receiptId: string; url: string}> = {};
for (const [label, src, quote] of QUOTES) {
  try {
    const {id, receipt} = await captureReceipt(SRC[src], quote);
    out[label] = {receiptId: id, url: receipt.url};
    console.log(`OK   ${label.padEnd(22)} ${id}`);
  } catch (e) {
    console.log(`FAIL ${label.padEnd(22)} ${String((e as Error).message)}`);
  }
}
await writeFile('work/receipts.json', JSON.stringify(out, null, 2) + '\n');
console.log(`\ncaptured ${Object.keys(out).length}/${QUOTES.length}`);
