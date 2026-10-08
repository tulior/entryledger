# EntryLedger
Evidence-grounded encyclopedia research dossiers with strict TypeBox 1.x
JSON Schema and deterministic plaintext artifact generation.

## Install / check
\`\`\`sh
bun install --frozen-lockfile
bun run check
bun test
bun run schema:verify
\`\`\`

The three dependencies have exact pins in package.json and a committed
bun.lock; `bun install --frozen-lockfile` is what CI enforces. No npm, Zod,
upgrade scripts, old schema versions or migration code. After changing the
TypeBox definition, regenerate the committed IR with
`bun run schema:export > dossier.schema.json`; `bun run schema:verify` (run in
CI) fails the build on semantic drift, ignoring key ordering, which is not
part of the schema's meaning.

## Autonomous agent execution

Give your search-enabled agent a subject title and [AGENT.md](AGENT.md).
It researches the subject, captures source receipts, writes
`out/dossier.json`, and repeats verification until valid.
`dossier.schema.json` is the committed direct-JSON IR; `contract.ts`
provides semantic constraints the JSON schema cannot encode.

There is no external LLM judge. The researching agent reads the sources and
judges entailment itself; the machine layer only authenticates quotations.
Every cited quote must be present on the live source page and match its stored
receipt, or validation fails closed. Every fetched URL is DNS-resolved and
refused if it resolves to private, loopback or link-local space, on every
redirect hop, so a rebinding host cannot reach internal services; an egress
firewall is still recommended as defence in depth.

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
import {createReceiptVerifier} from './verifier/fetch.ts';
import {renderArtifacts} from './render.ts';

// DossierSchema IS native JSON Schema 2020-12, not a transformed export.
const raw:unknown=await provider.generate({jsonSchema:DossierSchema});
const structural=await DossierStandardSchema['~standard'].validate(raw);
if('issues' in structural)throw Error('Invalid IR');
const reviewed=await validateDossier(raw,createReceiptVerifier());
if(!reviewed.ok)throw Error(JSON.stringify(reviewed.errors));
const [proposedTitle,editorialBrief]=renderArtifacts(reviewed);
\`\`\`

The Standard Schema v1 interface is a tiny validator bridge, not a legacy
schema or translation layer. It doesn't modify generated JSON or the
native JSON Schema.

A quotation is verified by exact substring match against the live page, which
assumes the quoted text is *stable*. It often is not: any quotation containing a
rating count, an average rating, a view or subscriber total, or an "N distinct
works" aggregate is unverifiable within hours. `EVIDENCE_EXPIRED` separates that
from fabrication, but only for receipts old enough (24h by default) that drift is
the more plausible reading, and it still fails the dossier closed — it is a
better diagnosis, never a permission. **Prefer quotations with no live numbers
in them.**

## Publication gate
TypeBox validates shape, not truth. `validateDossier` verifies cross-references,
authenticated source receipts, support and corroboration structure, source
quality, disputes and contradictions, real calendar validity, coverage,
notability and mandatory warnings. Invalid, unsupported and contradictory
dossiers fail closed, and the synthetic test fixture is blocked by default.

The machine authenticates *quotations*; the agent is responsible for what they
*mean*. `verify` proves a quote occurred on the page it is attributed to — it
does not and cannot establish that the quote entails the claim. Cross-reference,
stance, corroboration and contradiction rules are structural, so they still
reject a false dossier no matter what the agent asserts. But a well-quoted
misreading passes, and that judgement is the agent's to get right.

The renderer produces exactly two plaintext artifacts. The brief has a strict
5,000-character limit, retaining critical claims, citations, qualifications,
and source data. A mandatory-content overflow throws rather than truncates,
and so does a cap that would drop every claim and rule in a load-bearing
category — `definition`, `limitations` or `editorial_cautions`. `renderArtifacts`
raises `CATEGORY_OMITTED` rather than publish a brief that reads as complete
while omitting what the subject is, what is unknown, or the risk guidance. There
is no option to publish past it. Losing one of the other ten categories is
reported but not fatal; that is the packer doing its job. `auditRender` returns
the same artifacts alongside `included`, `dropped` and `lostCategories`, and
`bun run dossier:check` reports renderability before you publish.

A successful automated check does not replace human editorial source review.
