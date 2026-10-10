# EntryLedger

A **shape contract for a research handoff**.

An agent researches a subject and produces two artifacts — a proposed article
title and a structured editorial brief — in a fixed, machine-checkable shape. A
second agent, which verifies the references, then writes the encyclopedia
article from them.

EntryLedger does not decide what is true, and it does not fetch anything.

## Zero network I/O

This repository contains no web client, no search, and no network code of any
kind. Retrieval belongs to the agent doing the research, using whatever tools it
has. That is a deliberate constraint, not a missing feature: a built-in fetcher
would be a smaller, worse version of something the agent already has, and it
would inherit every failure mode of automated fetching — rate limits, proxies,
403s, egress rules — for no gain.

What remains is pure: a schema, an offline validator, a deterministic renderer.
Both commands run with no network and no credentials.

## The one thing to understand

**`dossier:check` passing does NOT mean the content is verified.**

It means the dossier is structurally sound: cross-references resolve, all
thirteen coverage categories are accounted for, evidence is not orphaned, dates
are real, and a brief can be rendered inside the character budget.

Whether the claims are *true* is the consumer's job. Every evidence record
carries the source `url` and the exact `quote` so it can be checked. Treat
`out/artifacts.json` as a well-organised research brief, never as verified fact.

## Commands

```sh
bun install --frozen-lockfile
bun run check          # typecheck
bun test               # offline suite
bun run schema:verify  # committed IR matches the TypeBox definition

bun run dossier:check  ./out/dossier.json   # offline
bun run dossier:render ./out/dossier.json   # offline, atomic
```

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
limitations, critical cautions — is never truncated. If it cannot fit, rendering
fails rather than quietly dropping it.

The cap counts the brief **as delivered** — `JSON.stringify(brief).length`, the
figure a consumer reading `artifacts.json` sees — not the in-memory string. The
two differ, and the difference is not academic: a brief of 4,990 characters
containing 20 newlines is 5,012 characters once serialized and is rejected. So
the brief is a single line. Checking a budget against the in-memory string
certifies artifacts the consumer will refuse.

## What blocks and what warns

Errors are **shape** problems: the dossier is malformed and should be fixed.

Warnings are **judgments the consumer owns**: thin notability evidence, an
undocumented research gap, a title that drifted from the canonical name. The
dossier renders, and the concern travels with it.

That split is deliberate. A hard failure on thin notability turns a notable
subject with unreachable sources into a dead end, and pushes an agent toward
claiming independence it did not find.

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

## A representative run

`examples/ferrari/` is a complete committed dossier and the artifact it
produces, for "Ferrari (car)". It is not a clean example: the manufacturer's own
site refuses automated access, so the dossier carries an unresolved coverage
category, a critical caution about the unread primary source, and a
`THIN_NOTABILITY_EVIDENCE` warning — and renders anyway.

```sh
bun run dossier:check  examples/ferrari/dossier.json
bun run dossier:render examples/ferrari/dossier.json
```

## Known limits

- Nothing here verifies that a source said what the dossier claims it said. The
  agent's reading is an input this repository cannot check, which is precisely
  why the consumer re-checks every reference.
- `htmlToText`-style extraction concerns do not apply here because this
  repository does not extract anything, but the agent should still copy
  quotations from the page as rendered, not from a search snippet.
- A successful automated check is a floor, not a ceiling.
