import {captureReceipt} from '../verifier/fetch.ts';
const url=process.argv[2];
const quote=process.argv[3];
if(!url||!quote)throw Error('Usage: bun scripts/capture-receipt.ts URL QUOTE');
const {id,receipt}=await captureReceipt(url,quote);
console.log(JSON.stringify({receiptId:id,url:receipt.url,
  fetchedAt:receipt.fetchedAt,rawTextHash:receipt.rawTextHash}));
