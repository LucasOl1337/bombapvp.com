# Ranni initial mastery

- Private learner: Bomb (`bomb-mastery-v1`); fixed opponent: V3.
- Matches: 96 executions; 48 evaluated matches and 48 exact replays.
- Seeds: `mastery-ranni-v1-seed-01` through `mastery-ranni-v1-seed-12`, with learner side alternating 0/1.
- Versions: mastery schema 1, technique schema 1, `kernel-0.10.0`, `mechanics-v5`, `content-prototype-arena-v1`.

## Authored hypotheses and observed evidence

`ranni.danger-blink.v1` proposed using Ice Blink only when the current tile is
covered by a live bomb/flame/pressure threat. Baseline and candidate both won
5/12 (41.7%); the predeclared danger-survival objective rose from 6384 to
10000 basis points. Candidate outcomes were 18/18, self-eliminations fell from
2 to 0, command rejections were 0, and every seed replayed exactly.

`ranni.proximity-blink.v1` proposed blinking within radius two. Its local
survival proxy reached 68/68, but wins fell from 5/12 to 1/12 (−33.3 percentage
points) and average completion grew from 1085 to 3014 revisions. The behavior
repeatedly stalled in adjacent/overlapping chases.

## Curation

- Accepted: `ranni.danger-blink.v1`, confidence 7000/10000. The active private
  artifact is in `GameMechanics/content/bot-mastery/bomb/mastery/ranni.ts`.
- Rejected: `ranni.proximity-blink.v1`, due material win regression and stalls.

Known weaknesses: only one opponent profile and same-Champion mirrors were
tested; win outcomes remained side-sensitive; the fixed arena/start matrix
produced eight successful local trajectory signatures. The promoted technique
must be refreshed on holdout seeds before confidence increases or sharing is
considered.
