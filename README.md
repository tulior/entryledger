# Evidence-grounded encyclopedia dossier contract (TypeScript + Zod 4)

## Installation and use

 ```sh
bun run upgrade:all       # resolves all dependencies including alpha/beta/RC, writes bun.lock
bun run check             # TypeScript static checking
bun test                  # native Bun tests
```

Prerequisite: Bun. The manifest's initial registry tags are bootstrap placeholders, **not verified newest-version pins**. Run `bun run upgrade:all` first: the resolver queries published SemVer versions, selects the highest non-deprecated version even if prerelease, writes exact versions to package.json, and invokes `bun install` to write `bun.lock`. Commit the resulting manifest and lockfile for reproducibility. Use `bun run upgrade:all --dry-run` to inspect versions without changes. Registry access is required.

No npm scripts or tsx runner remain. `@types/bun` supplies Bun globals and Node compatibility types; a direct `@types/node` dependency is unnecessary. Retain `typescript` for static analysis (Bun only transpiles TypeScript). Keep behavioral tests: Zod shape validation alone cannot test source-verifier decisions, dangling references, forged reports, deterministic rendering, or the 5,000-character cap.

Run tests with an **explicitly fictional fixture**: `origin: synthetic_fixture` can be validated only by a caller that passes `allowSyntheticFixture: true`. Production code should never pass that option. The test receipt verifier is a local stub and **must not be used in production**.

API:

```ts
const result = await validateDossier(untrustedResearchJSON, productionReceiptVerifier);
if (!result.ok) return {blocked: result.errors, warnings: result.warnings};
const [title, brief] = renderArtifacts(result); // exactly two plaintext strings
```

The production evidence verifier should be backed by authenticated, immutable fetch receipts held outside the researching model's write permissions. It checks that `receiptId` maps to `source.url`, that `quote` appears at the supplied `locator`, and that the snapshot is authentic. It must also provide independent `reviewSource` and `reviewStatement` decisions (not agent self-attestations). A quote matching a page is necessary but **not sufficient** to establish that the page supports the proposition. Add independent semantic entailment review before setting `verified`, particularly for consequential claims. Publication governance should independently confirm source reliability and notability assessments.

## Direct-to-LLM intermediate representation (IR)

**One canonical source:** `DossierSchema` is strict JSON-native Zod 4.
`DossierStandardSchema` exports the very same object: its native
`["~standard"].validate(value)` implements Standard Schema v1, with no adapter.
`getDossierJSONSchema()` exports native `z.toJSONSchema(DossierSchema,
{io:'input',target:'draft-2020-12'})`. Use that schema directly in a
structured-output LLM request, then submit its JSON response unchanged to
`validateDossier`. The model does **not** generate an intermediate DTO.

```ts
import {DossierStandardSchema,getDossierJSONSchema,validateDossier} from './contract.ts';
import {renderArtifacts} from './render.ts';

const llmSchema=getDossierJSONSchema();
const raw:unknown=await generateStructuredJSON(llmSchema); // your model provider
const structural=await DossierStandardSchema['~standard'].validate(raw);
if(structural.issues)throw Error('Invalid dossier shape');
const checked=await validateDossier(raw,productionReceiptVerifier);
if(!checked.ok)throw Error(JSON.stringify(checked.errors));
const [proposedTitle,editorialBrief]=renderArtifacts(checked);
```

Portable, **native** JSON Schema export (stdout contains JSON only):

```sh
bun run schema:export > dossier.schema.json
```

This is a breaking IR revision: `schemaVersion: "2.0.0"`. All arrays, flags,
and editorial-risk labels are explicit—no omitted-field defaults, coercion,
or string trimming. The JSON Schema enforces shapes, discriminated unions,
required fields, and lexical constraints. Source authenticity, semantic
entailment, references, real Gregorian dates, conflicts, and notability
are **not expressible** in JSON Schema and remain in `validateDossier`.
Standard Schema shape success is **not** publication authorization.
Provider-specific JSON Schema subsets may need a distinct explicitly
reviewed policy, not a silent lossy schema rewrite. The function
`generateStructuredJSON` is illustrative and not bundled.

## Epistemic contract

- `verified`: evidence supports the specific proposition; `direct` needs one source, `corroborated` needs two distinct sources. Verification here means **evidence-checked**, not logically infallible.
- `attributed`: reports what a source/person says; never silently promote it to an unqualified fact.
- `interpretation`: explicitly attributed and uncertain.
- `disputed`: at least two distinctly sourced opposing positions; no resolved conclusion is manufactured.
- `unknown`: requires a documented search/review attempt and explanatory uncertainty; no synthetic source citations.
- Core identity and definition must have direct evidence; all domain coverage categories must be marked `covered`, `not_applicable`, or `unresolved` with reasons. Blocking gaps stop the pipeline.
- `notability` is independent of `significance`. Default `established` threshold requires two substantial, editorially overseen, independent secondary sources from distinct publishers. An `uncertain`/`insufficient` assessment is allowed when openly disclosed in the brief, but **not** a claim of established standalone eligibility.
- Critical claims and critical editorial rules must be required by presentation. All mandatory content is rendered in full; if it cannot fit, rendering fails rather than silently truncating.

## Presentation contract

A successfully validated dossier is deep-frozen and its success report is runtime-certified with a private WeakSet, so a forged success-shaped object or a post-validation mutation cannot authorize rendering. The renderer sorts categories, segment IDs and source IDs deterministically. It emits `TITLE/SCOPE`, `NOTABILITY`, selected claims and editorial directives, followed by source URLs. Inline citations use source keys with evidence locators, e.g. `[S1:§1]`. The 5,000-character cap is measured in JavaScript UTF-16 code units (`string.length`), a conservative rule for platforms also using JS string lengths. If the downstream interface counts Unicode code points or grapheme clusters instead, adapt the counter accordingly.

Mandatory content is prioritized first. Optional segments are admitted greedily according to `utility / tokenEstimate(text)` while rechecking the exact character count, including citations and source references, after each admission. By default the counter is a **BGE-like proxy**, not a real BGE tokenizer. Supply a pinned BGE tokenizer via `tokenEstimate` for reproducible tokenizer-specific density; the renderer does not claim a globally optimal knapsack solution. It never edits proposition text, strips qualifications, or truncates citations to fit.

All title wording, facts, quotations, source metadata, dates, notability judgments and editorial directives must be present in validated dossier data. The renderer supplies only fixed category labels and neutral status/attribution prefixes.

## Production requirements not solved by a schema alone

1. Trustworthy source retrieval (immutable snapshots and receipt integrity), source provenance, semantic entailment checks and explicit human/editorial signoff for high-risk claims.
2. Policy-specific notability adjudication (Wikipedia notability requirements are contextual, not a universal numeric threshold).
3. Revision control and cache invalidation when sources, factual consensus or the subject change.
4. Human review of editorial prose even after deterministic rendering, especially for living persons, safety-critical topics and contested subjects.
