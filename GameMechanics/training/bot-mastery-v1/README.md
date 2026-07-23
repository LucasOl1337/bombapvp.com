# Initial bot-mastery campaign v1

This directory is the reviewed release record for the captain-supervised first
training cycle. Raw structured results are written outside the production
bundle to `bombpvp-bot-mastery-architecture/campaign-results.json`; the source
campaign and deterministic reprojection commands are:

```sh
node_modules/.bin/vite-node GameMechanics/scripts/run-bot-mastery-campaign.ts <output.json>
node_modules/.bin/vite-node GameMechanics/scripts/project-bot-mastery-campaign.ts <output.json>
```

Each Champion used 12 exact seeds, alternating learner side. Each of two
candidates ran 12 baseline plus 12 candidate matches and replayed all 24, for
96 executions per Champion (48 evaluated + 48 parity replays). All 384 total
executions replayed deterministically and all candidate runs had zero command
rejections.

The candidates are agent-authored hypotheses. The mechanically observed layer
is limited to structured decision/match events, seeds, outcomes, counters, and
replays. Numeric projection is advisory: the final curation gate rejected
causally ambiguous or orientation-biased results. Only Ranni's danger blink is
active in runtime knowledge.

Compatibility for every artifact: mastery schema 1, technique schema 1,
`kernel-0.10.0`, `mechanics-v6`, and `content-prototype-arena-v1`.
