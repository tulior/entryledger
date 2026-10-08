# Representative run: "Ferrari (car)"

A complete, committed example of the pipeline, so its behaviour can be
inspected without running the network.

```sh
ARTICLE="Ferrari (car)" \
  BRIEF=examples/ferrari/research-brief.json \
  DOSSIER=examples/ferrari/dossier.json \
  ARTIFACTS=/tmp/artifacts.json \
  bun run subject
```

## What it demonstrates

- **A real 403, handled as a finding.** `ferrari.com` refuses programmatic
  clients. The run records that as an unreachable source, an `unresolved`
  coverage category, and a critical editorial caution — it does not crash, and
  it does not pretend the primary source was read.
- **Thin notability travels, it does not block.** One independent secondary
  was reachable, so the run emits `THIN_NOTABILITY_EVIDENCE` as a warning and
  renders anyway. The consumer decides.
- **The quote is byte-exact.** `Maranello , Italy` carries a space before the
  comma because that is what the extractor produces. It is quoted here exactly
  as `bun run page:dump` printed it.

## Runtime assumptions

Verified under Bun 1.4.2 with outbound HTTPS. `bun run subject` performs
network retrieval; `dossier:check` and `dossier:render` do not. The committed
`artifacts.json` is the expected output.
