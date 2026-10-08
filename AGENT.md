# EntryLedger research skill

INPUT: ARTICLE="<subject name>"
OUTPUT: out/dossier.json and out/artifacts.json — context for another agent
that will verify the references and write the article.

You are producing a **well-shaped research handoff**, not a finished article.
A second agent checks every reference before anything is published. Your job is
to gather what can be gathered, cite it honestly, and be explicit about what
you could not reach.

## What this repository does, and does not, do

It gives you a **shape**: a strict JSON contract for a research dossier, an
offline validator, and a deterministic renderer that emits exactly two strings.

It does **not** fetch anything. It has no web client, no search, and no
network I/O of any kind. Those are your capabilities, and you use them
directly — search, open pages, read them, and copy quotations from what you
actually read. Nothing here will do it for you, and nothing here can be
network-blocked, rate-limited or broken by a proxy.

Two commands matter:

```sh
bun run dossier:check  out/dossier.json    # offline: is the shape valid?
bun run dossier:render out/dossier.json    # offline: emit the two artifacts
```

Both are deterministic and offline. Run `dossier:check` as often as you like.

## Read the shape

Read `dossier.schema.json` for the exact JSON to write — it is the model-facing
IR and the committed copy of the contract. Read `contract.ts` for the structural
rules JSON Schema cannot express. Write JSON directly; there is no
transformation step.

## Research

1. **Disambiguate before scoping.** Similarly named subjects are the most common
   way a handoff misleads its consumer. Record a `disambiguation` claim saying
   explicitly which referent this dossier is about, and list the rejected ones
   in `article.alternatives`.
2. **Search for sources.** Aim for a mix: the subject's own material where it
   exists, plus independent secondary coverage. Do not treat a wiki entry as
   independent corroboration of itself.
3. **Read the pages you cite.** Every `Evidence.quote` must be copied verbatim
   from a page you actually opened. Do not quote from a search-result snippet,
   a summary, or memory — they differ from the source text in ways that are easy
   to miss: a missing space before a comma, a different apostrophe, a
   parenthetical a search engine stripped. If you did not read it, do not cite
   it.
4. **Record what you could not reach.** Many sites refuse automated access, and
   most primary documents are PDFs. When a source is unavailable, do not
   substitute a weaker one silently: set that coverage category to `unresolved`
   with a `reason`, and add an editorial caution. A documented gap is useful to
   your consumer. A fabricated one is not.
5. **Attribute honestly.** `verified` means a source directly supports it.
   `attributed` means someone asserted it. `interpretation` stays opinion.
   `disputed` needs at least two sourced opposing positions. `unknown` is for
   what you could not establish — record the question and the attempt.
   Evidence carries a stance: `challenges` records a contradiction and must name
   the claim it contradicts; only `supports` evidence can carry a verified or
   corroborated claim.

All thirteen coverage categories must be accounted for: `covered`,
`unresolved`, or `not_applicable`. Absent is not an option.

## Validate, then render

```sh
bun run dossier:check out/dossier.json
```

An **error** means the dossier is malformed — a dangling reference, a missing
category, a claim with no supporting evidence, an impossible date. Fix the
structure and re-run. Do not weaken the contract to make it pass.

A **warning** means a judgment your consumer owns: thin notability evidence, an
undocumented research gap, a title that drifted from the canonical name. The
dossier renders anyway and the concern travels with it. Read the warnings and
decide whether to gather more, or leave the call to the consumer.

When validation passes:

```sh
bun run dossier:render out/dossier.json
```

This revalidates and writes `out/artifacts.json`: exactly
`[proposed article title, editorial brief]`. The brief is at most 5,000
characters, keeps verified identity, the sourced definition, limitations and
critical cautions in full, and carries inline `[S1:locator]` citations with a
bibliography. If a load-bearing category is crowded out entirely, the renderer
refuses rather than publishing a brief that reads as complete.

## What a green check does and does not mean

`dossier:check` passing means the dossier is **structurally sound and nothing
more**. No network was touched and no claim was confirmed. Do not describe a
valid dossier as verified, verified-by-machine or publication-ready. Say it is
well-formed and that its references are stated for review.

The quotation is only as good as your reading. Nothing here can tell whether a
quote supports the claim you attached it to, or whether you read the page at
all — which is exactly why the consumer re-checks. Your credibility on each
citation is the input; the shape is what this repository enforces.

If the subject cannot be researched, say so plainly and render the dossier with
honest gaps. A short, truthful handoff beats a complete-looking one.
