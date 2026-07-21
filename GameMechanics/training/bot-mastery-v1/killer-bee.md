# Killer Bee initial mastery

- Private learner: V1 (`v1-mastery-v1`); fixed opponent: V3.
- Matches: 96 executions; 48 evaluated matches and 48 exact replays.
- Seeds: `mastery-killer-bee-v1-seed-01` through `mastery-killer-bee-v1-seed-12`, alternating learner side.
- Versions: mastery schema 1, technique schema 1, `kernel-0.10.0`, `mechanics-v5`, `content-prototype-arena-v1`.

## Authored hypotheses and observed evidence

`killer-bee.aligned-dash.v1` proposed Wing Dash on a clear aligned lane within
three tiles. Wins remained 0/12; the movement objective rose from 4278 to 5714
basis points, with 24/42 candidate outcomes and zero rejections. Trace review
found every success in one orientation (`0,7 → 1,7`) and every reverse case
failed: the closed `use-skill` action cannot guarantee the dash's inherited aim.

`killer-bee.close-dash.v1` proposed dashing within radius one. Wins remained
0/12. The nominal relative objective delta was large only because the baseline
was near zero; just 24/138 candidate outcomes succeeded, mostly failing in
co-located or stalled situations.

## Curation

- Accepted: none. Runtime mastery remains authored knowledge only, confidence
  2500/10000, with no executable/acquired technique.
- Rejected: `killer-bee.aligned-dash.v1` for orientation-specific evidence and
  an action/aim mismatch; `killer-bee.close-dash.v1` for weak absolute success,
  no match benefit, and redundancy.

Known weaknesses: the existing declarative action cannot express a validated
aim direction, the learner never beat V3, and the 12 seeds collapsed to two
effective spawn-lane trajectories. A future candidate needs an authored,
validated directional action primitive before retraining.
