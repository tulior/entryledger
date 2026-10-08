/** Native Draft 2020-12 JSON Schema from the canonical Zod IR. */
import {getDossierJSONSchema} from '../contract.ts';
console.log(JSON.stringify(getDossierJSONSchema(),null,2));
