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

## Autonomous agent execution

Give your search-enabled agent a subject title and [AGENT.md](AGENT.md).
It researches the subject, captures source receipts, writes
`out/dossier.json`, and repeats verification until valid.
`dossier.schema.json` is the committed direct-JSON IR; `contract.ts`
provides semantic constraints the JSON schema cannot encode.

An independent semantic reviewer must be configured through
`EVIDENCE_JUDGE_URL`, `EVIDENCE_JUDGE_MODEL`, and
`EVIDENCE_JUDGE_API_KEY`. Source re-fetches require network egress
protection against private hosts and DNS rebinding. Missing credentials,
invalid receipts or unavailable source text make validation fail closed.

```sh
bun run receipt:capture 'https://example.org/source' 'Exact quote from the source'
bun run dossier:check ./out/dossier.json
bun run dossier:render ./out/dossier.json
```

`out/artifacts.json` is the two-string artifact array, only after successful
re-validation. The brief is capped at 5,000 characters and contains inline
source citations. `bun test` checks offline fixture, receipt and
schema-contract invariants; synthetic test evidence is never publishable.

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
