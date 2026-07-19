# G6j DONE — continuous lane (no per-cell sticker frames)

**Status:** complete (workspace; no commit/push)

## Problem

Lane tiles had hard gold rectangle frames → center/side routes looked like sticker squares, not a continuous path (visible in G6g/G6h screenshots).

## Fix

`floor-lane.png`: cream brightness lift only + 1px soft edge darken. No drawn rectangle frame.

## Verify

Playwright `_playtest-training.png`: continuous bright cross/side routes, cobble field, walls/crates/spawn pads intact.
