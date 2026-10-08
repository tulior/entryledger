# EntryLedger research skill

INPUT: ARTICLE="<subject name>"
OUTPUT: out/dossier.json and out/artifacts.json — context for another agent
that will verify the references and write the article.

You are producing a **well-shaped research handoff**, not a finished article.
A second agent checks every reference before anything is published. Your job is
to gather what can be gathered, cite it honestly, and be explicit about what
you could not reach.

## Read the shape

Use Bun. Read `dossier.schema.json` for the exact JSON to write — it is the
model-facing IR and the committed copy of the contract. Read `contract.ts` for
the structural rules JSON Schema cannot express. Write JSON directly; there is
no transformation step.

## Gathering

1. Disambiguate the subject before scoping it. Similarly named subjects are the
   most common way a handoff misleads its consumer.
2. Read the sources. Use the one command that touches the network:
   `bun run page:dump <url> [substring]`
   It prints the page as the pipeline extracts it. **Copy quotations from that
   output.** Search-result snippets do not match it: the extractor collapses
   whitespace, so a real page reads `based in Maranello , Italy`, with a space
   before the comma. Every quote in the dossier must appear verbatim in a
   dumped page.
3. Many sites return 403 to non-browser clients, and most primary documents are
   PDFs this cannot read. When a source is unreachable, do not substitute a
   weaker source silently — record the gap in `coverage` with `state:
   "unresolved"` and a `reason`, and raise an editorial caution. A documented
   gap is useful to your consumer. A fabricated one is not.
4. `Evidence` carries `url` and `quote` so the consumer can check it. Use it.
   Do not invent a source, a URL, a quotation, a publication date or a
   publisher. If you did not read it, do not cite it.
5. Attribute honestly. Verified means a source directly supports it. Attributed
   means someone asserted it. Interpretation stays opinion. Disputed needs at
   least two sourced opposing positions. `challenges` evidence records a
   contradiction and must name the claim it contradicts; only `supports`
   evidence can carry a verified or corroborated claim.

## Before rendering

```sh
bun run dossier:check out/dossier.json
```

An error means the dossier is malformed — fix the structure and re-run. A
warning means a judgment the consumer owns, such as thin notability evidence or
an undocumented gap; it renders anyway and travels with the output. Read the
warnings and decide whether to gather more or let the consumer decide.

Then:

```sh
bun run dossier:render out/dossier.json
```

This revalidates and writes `out/artifacts.json`: exactly
`[proposed article title, editorial brief]`. The brief is at most 5,000
characters, keeps verified identity, the sourced definition, limitations and
critical cautions in full, and carries inline `[S1:locator]` citations with a
bibliography. If a category named in the dossier is crowded out entirely, the
renderer refuses rather than publishing a brief that reads as complete.

## What a green check does and does not mean

`dossier:check` passing means the dossier is **structurally sound and nothing
more**. It performed no network access and confirmed no claim is true. Do not
describe a valid dossier as verified, verified-by-machine or publication-ready.
Say it is well-formed and that its references are stated for review.

If the subject cannot be researched — sources unreachable, no usable coverage —
say so plainly and render the dossier with honest gaps. A short, truthful
handoff is worth more than a complete-looking one.
