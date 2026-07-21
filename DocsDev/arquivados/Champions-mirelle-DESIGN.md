# Mirelle — Tide Swap (polished)

## Fantasy
Tide siren who **exchanges places** with the nearest living enemy — bomb-arena space control (not a self-blink, not a radial pull).

## Ultimate
| Field | Value |
| --- | --- |
| Id | `mirelle-tide-swap` |
| Channel | **220 ms** (auto-completes; tap is enough) |
| Range | Chebyshev **4** |
| Hit CD | 8000 ms |
| Miss CD | **1200 ms** (no enemy in range) |
| Landing | Tile centers; faces partner after swap |
| VFX | Cyan tide ribbon between anchors (~420 ms) |

## Animation inventory (dense loops)
| Clip | Frames / dir | Source |
| --- | --- | --- |
| idle | **12** | video harvest south; still-motion E/N/W |
| walk / run | **16** | video harvest S/E/N; W flop of E |
| cast | **10** | video harvest south; still-motion other dirs |
| attack | **6** | cast-derived / still crouch |
| statics | N/E/S/W stills | unique per direction |

## Distinction
- Ranni: long-channel self projection blink  
- Pendula: pulls enemies toward self  
- Lumen: short self flash-step  
- **Mirelle: swaps with enemy**  
