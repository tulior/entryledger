# Evidence-grounded encyclopedia dossier contract (TypeScript + Zod 4)

## Installation and use

```sh
npm install
npm run check
npm test
```

Run tests with an **explicitly fictional fixture**: `origin: synthetic_fixture` can be validated only by a caller that passes `allowSyntheticFixture: true`. Production code should never pass that option. The test receipt verifier is a local stub and **must not be used in production**.

API:

```ts
const result = await validateDossier(untrustedResearchJSON, productionReceiptVerifier);
if (!result.ok) return {blocked: result.errors, warnings: result.warnings};
const [title, brief] = renderArtifacts(result); // exactly two plaintext strings
```

The production evidence verifier should be backed by authenticated, immutable fetch receipts held outside the researching model's write permissions. It checks that `receiptId` maps to `source.url`, that `quote` appears at the supplied `locator`, and that the snapshot is authentic. It must also provide independent `reviewSource` and `reviewStatement` decisions (not agent self-attestations). A quote matching a page is necessary but **not sufficient** to establish that the page supports the proposition. Add independent semantic entailment review before setting `verified`, particularly for consequential claims. Publication governance should independently confirm source reliability and notability assessments.

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