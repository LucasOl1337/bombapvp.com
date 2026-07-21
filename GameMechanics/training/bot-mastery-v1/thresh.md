# Thresh initial mastery

- Private learner: V2 (`v2-mastery-v1`); fixed opponent: V3.
- Matches: 96 executions; 48 evaluated matches and 48 exact replays.
- Seeds: `mastery-thresh-v1-seed-01` through `mastery-thresh-v1-seed-12`, alternating learner side.
- Versions: mastery schema 1, technique schema 1, `kernel-0.10.0`, `mechanics-v5`, `content-prototype-arena-v1`.

## Authored hypotheses and observed evidence

`thresh.aligned-hook.v1` proposed Death Sentence on a clear aligned lane within
four tiles. Candidate wins rose from 0/12 to 6/12, but all wins occurred from
learner side zero and competitor A won all 12 candidate matches. The direct
pull objective fell from 7350 to 0 basis points: none of 24 evaluated hooks
reduced opponent distance. The declarative `use-skill` action cannot explicitly
aim at the aligned opponent.

`thresh.close-hook.v1` proposed hooking within radius one. Wins remained 0/12;
6/18 outcomes succeeded, while diagonal/co-located states accounted for most
failures and are not valid cardinal hook targets.

## Curation

- Accepted: none. Runtime mastery remains authored knowledge only, confidence
  2500/10000, with no acquired technique.
- Rejected: `thresh.aligned-hook.v1` for total side bias, zero direct pull
  outcomes, and the action/aim mismatch; `thresh.close-hook.v1` for no match
  benefit and geometrically invalid proximity triggers.

Known weaknesses: two repeated trajectories dominated the batch; direct hook
hit/pull telemetry and a validated aim action are required; future evaluation
must use holdout arenas/opponents and side-balanced causal outcomes.
