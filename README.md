# EntryLedger
Evidence-grounded encyclopedia research dossiers with strict TypeBox 1.x
JSON Schema and deterministic plaintext artifact generation.

## Install / check
\`\`\`sh
bun install
bun run check
bun test
bun run schema:export > dossier.schema.json
\`\`\`

The three dependencies have exact pins in package.json (live newest-release status has not been independently verified). No npm, Zod,
upgrade scripts, old schema versions or migration code. After a real
installation, commit bun.lock for reproducibility; a lockfile must never be
fabricated.

## One LLM-to-IR contract
\`\`\`ts
import {DossierSchema,DossierStandardSchema,validateDossier} from './contract.ts';
import {renderArtifacts} from './render.ts';

// DossierSchema IS native JSON Schema 2020-12, not a transformed export.
const raw:unknown=await provider.generate({jsonSchema:DossierSchema});
const structural=await DossierStandardSchema['~standard'].validate(raw);
if('issues' in structural)throw Error('Invalid IR');
const reviewed=await validateDossier(raw,independentEvidenceVerifier);
if(!reviewed.ok)throw Error(JSON.stringify(reviewed.errors));
const [proposedTitle,editorialBrief]=renderArtifacts(reviewed);
\`\`\`

The Standard Schema v1 interface is a tiny validator bridge, not a legacy
schema or translation layer. It doesn't modify generated JSON or the
native JSON Schema.

## Publication gate
TypeBox validates shape, not truth. validateDossier verifies cross-references,
independent authenticated source receipts and claim support, source quality,
disputes and contradictions, real calendar validity, coverage, notability
and mandatory warnings. Its verifier is an injected trusted service external
to the researching AI. Invalid, unsupported and contradictory dossiers fail closed.
The synthetic test fixture is blocked by default.

The renderer produces exactly two plaintext artifacts. The brief has a strict
5,000-character limit, retaining critical claims, citations, qualifications,
and source data. A mandatory-content overflow throws rather than truncates.

A successful automated check does not replace human editorial source review.
