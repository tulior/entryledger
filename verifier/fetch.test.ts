import {test,expect} from 'bun:test';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {captureReceipt,createReceiptVerifier,sha256} from './fetch.ts';
import type {SourceRecord,EvidenceRecord} from '../contract.ts';

test('receipt capture and live re-fetch authenticate quotations',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'entryledger-'));
  const url='https://example.org/test-article';
  const quote='Kestrel Atlas is a fictional test project.';
  const page={url,title:'Test document',rawText:quote+' Extra source context.'};
  const fetchPage=async()=>page;
  try{
    const {id,receipt}=await captureReceipt(url,quote,{receiptsDir:dir,fetchPage});
    expect(receipt.rawTextHash).toBe(sha256(page.rawText));
    const disk=JSON.parse(await readFile(join(dir,id+'.json'),'utf8'));
    expect(disk.rawText).toBe(page.rawText);
    const source:SourceRecord={id:'source1',url,title:'Test document',
      authors:[],publisher:'Synthetic test',kind:'primary',
      accessed:'2026-10-08T00:00:00Z',
      quality:{assessment:'low',rationale:'Offline test source',
        independenceRationale:'Not independent',editorialOversight:false,
        coverage:'passing',limitations:['Synthetic']}};
    const evidence:EvidenceRecord={id:'evidence1',sourceId:'source1',
      receiptId:id,quote,locator:'test excerpt',stance:'supports',
      challengesClaimIds:[],observedAt:'2026-10-08T00:00:00Z'};
    const verifier=createReceiptVerifier({receiptsDir:dir,fetchPage});
    expect(await verifier.verify(source,evidence)).toBe('authentic');
    // An invented quote does not bind to this receipt id at all.
    expect(await verifier.verify(source,{...evidence,quote:'Invented false evidence quoted nowhere'})).toBe('invalid');
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('receipt capture fails if exact quote is absent from the fetched page',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'entryledger-'));
 try{
   await expect(captureReceipt('https://example.org/demo',
     'This passage is not present',{receiptsDir:dir,
     fetchPage:async()=>({url:'https://example.org/demo',title:'Fixture',
       rawText:'Different evidence text'})})).rejects.toThrow('QUOTE_NOT_IN_LIVE_PAGE');
 }finally{await rm(dir,{recursive:true,force:true});}
});
