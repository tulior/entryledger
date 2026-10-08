# EntryLedger

A **shape contract for a research handoff**. An agent researches a subject and
produces two artifacts — a proposed article title and a structured editorial
brief — in a fixed, machine-checkable shape. A second agent, which verifies the
references, then writes the wiki article from them.

EntryLedger does not decide what is true. It decides what a well-formed dossier
looks like, and refuses to emit artifacts that are malformed.

## The one thing to understand

**`dossier:check` passing does NOT mean the content is verified.**

It means the dossier is structurally sound: cross-references resolve, all
thirteen coverage categories are accounted for, evidence is not orphaned,
dates are real, and a brief can be rendered inside the character budget.

Whether the claims are *true* is the consumer's job. Every evidence record
carries the source `url` and the exact `quote` so it can be checked. Treat
`out/artifacts.json` as a well-organised research brief, never as a source of
verified fact.

## Commands

```sh
bun install --frozen-lockfile
bun run check          # typecheck
bun test               # offline suite
bun run schema:verify  # committed IR matches the TypeBox definition
```

```sh
ARTICLE="Ferrari (car)" bun run subject      # the whole run, six explicit stages
bun run page:dump <url> [substring]           # inspect one page by hand
bun run dossier:check ./out/dossier.json      # offline
bun run dossier:render ./out/dossier.json     # offline, atomic
bun run network:check                         # live budget + SSRF checks
```

`bun run subject` is the one entry point. It removes any stale
`out/artifacts.json` before starting, prints what happened at each stage, and
exits non-zero with an explanation if a stage cannot complete. A failed run
never leaves an artifact behind for the consumer to trust.

`page:dump` prints a page exactly as the pipeline extracts it — whitespace
collapsed, entities decoded. **Copy quotations from this output, not from search
results.** The two differ: Wikipedia reads `based in Maranello , Italy` with a
space before the comma. A quote that "looks right" from a search snippet will
not be found in the source.

It also refuses private, loopback and link-local destinations, including after
redirects.

## The handoff

`out/dossier.json` is the LLM-facing IR. `dossier.schema.json` is that same
schema, committed, so a model can be pointed at it directly. The model writes
JSON; there is no transformation layer.

`out/artifacts.json` is exactly two strings:

```json
["Proposed article title", "EDITORIAL BRIEF ..."]
```

The brief is capped at 5,000 characters, groups claims under the thirteen
coverage categories, and carries inline `[S1:locator]` citations with a source
bibliography. Mandatory content — verified identity, sourced definition, stated
limitations, critical cautions — is never truncated. If it cannot fit,
rendering fails rather than quietly dropping it.

## What blocks and what warns

Errors are **shape** problems. They mean the dossier is malformed and the agent
should fix it.

Warnings are **judgments the consumer owns**: thin notability evidence, an
undocumented research gap, a title that drifted from the canonical name. The
dossier renders, and the concern travels with it for the consumer to resolve.

This split is deliberate. A hard failure on thin notability evidence turns a
notable subject with unreachable sources into a dead end, and pushes an agent
toward claiming independence it did not find.

## The one LLM-to-IR contract

```ts
import {DossierSchema,DossierStandardSchema,validateDossier} from './contract.ts';
import {renderArtifacts} from './render.ts';

// DossierSchema IS native JSON Schema 2020-12, not a transformed export.
const raw:unknown=await provider.generate({jsonSchema:DossierSchema});
const structural=await DossierStandardSchema['~standard'].validate(raw);
if('issues' in structural)throw Error('Invalid IR');
const checked=validateDossier(raw);              // shape only, no network
if(!checked.ok)throw Error(JSON.stringify(checked.errors));
const [proposedTitle,editorialBrief]=renderArtifacts(checked);
```

The Standard Schema v1 interface is a small validator bridge, not a translation
layer. It does not modify generated JSON or the native JSON Schema.

## Bounded cost

A run fetches at most 40 requests, 8 MB and 180 seconds. Each page is capped
at 2 MB and 15 seconds. Exceeding any ceiling raises `BudgetExceeded` and stops
the run. Retrieval is the only stage that touches the network; validation and
rendering are offline and deterministic.

Every destination is resolved and refused if it lands in private, loopback or
link-local space, on every redirect hop, so a rebinding host cannot reach
internal services. An egress firewall remains worth having as defence in depth.

## A representative run

`examples/ferrari/` is a complete committed run for "Ferrari (car)": the
research brief, the dossier, and the artifact it produces. It reproduces
byte-identically. It is interesting because it is not clean — `ferrari.com`
returns 403 to programmatic clients, so the run carries an unresolved coverage
category, a critical caution about the unread primary source, and a
`THIN_NOTABILITY_EVIDENCE` warning — and still renders.

## Known limits

- `htmlToText` does not parse JavaScript-rendered pages or PDFs. Many sources
  return 403 to programmatic clients, and most primary documents are PDFs.
- Many publishers block non-browser clients outright, so coverage of a major
  subject can be thinner than it should.
- `auditRender` reports what the character cap discarded, including partial loss
  inside a surviving category. A brief that fits reports no loss at all.

A successful automated check is a floor, not a ceiling. Nothing here verifies
that a source said what the dossier claims it said.
