# Feature: Stage 3 — Arcane Screen VTT, Encounter Engine, ActionBuilder & Babylon.js EffectBuilder

- **Slug:** `stage-3-arcane-screen-action-and-effect-builders`
- **Status:** Verified
- **Module owner:** `features/arcane-screen`, `features/encounters`, `features/effects` / `LoomWeaver.Modules.Encounters`, `LoomWeaver.Modules.Actions`
- **System support:** D&D 5e (`dnd5e`), Pathfinder 2e (`pf2e`), Vampire V5 (`vampire_v5`)
- **First written / Last updated:** 2026-10-25 / 2026-10-27
- **Authoritative code paths:**
  - `frontend/src/app/shared/ui/npc-card/`
  - `frontend/src/app/shared/ui/creature-card/`
  - `frontend/src/app/shared/ui/encounter-card/`
  - `frontend/src/app/shared/ui/encounter-builder/`
  - `frontend/src/app/features/arcane-screen/`
  - `frontend/src/app/features/encounters/`
  - `frontend/src/app/features/effects/`
  - `backend/src/LoomWeaver.Domain/Stage3Contracts.cs`
  - `backend/src/LoomWeaver.Modules/Encounters/CombatEncounterEndpoints.cs`
  - `backend/src/LoomWeaver.Modules/Actions/ActionAndEffectEndpoints.cs`
- **Architecture docs:** `../architecture/module-roadmap.md`, `../architecture/component-catalog-and-instances.md`, `../architecture/engine-placement-and-ownership.md`

## User story

As a GM or Player, I want:
1. **Arcane Screen & Encounter Builder (Module 3)**: A live VTT with a Babylon.js 3D/2D tactical combat stage, token targeting and range measurement, per-turn Action Economy tracking (Action, Bonus Action, Reaction, Movement), server-evaluated AC/DC hit and save resolution, and automated XP awards upon concluding an encounter.
2. **ActionBuilder (Module 4)**: A guided When / If / Then rules and homebrew ability builder backed by the .NET action/rules engine that validates range, action cost, attack/save math, and damage/condition payloads.
3. **EffectBuilder (Module 5)**: A live Babylon.js 3D spell trajectory, particle, and timeline animation engine supporting projectile arcs, directional cones, vertical beams, and ground AoE sigils with reduced-motion accessibility controls.

## Reusable component audit (required for UI slices)

- **Existing components reused:** `lw-panel`, `lw-button`, `lw-badge`, `lw-icon`, `lw-rules-option-selector`, `lw-asset-card`, `lw-asset-picker`.
- **New components created once and reused across routes:**
  - `lw-npc-card`: Displays authorized NPCs with `compact | standard | detailed` variants, role-scoped secrets, and `selected` / `spawnRequested` outputs. Used in Arcane Screen, Encounters, and Campaigns.
  - `lw-creature-card`: Displays creatures/monsters with CR, XP value, AC/HP/Speed, signature actions, and `spawnRequested` / `selected` outputs. Used in Encounters and Arcane Screen.
  - `lw-encounter-card`: Displays configured encounters with difficulty tier, total XP award, roster count, bound map scene, and `startRequested` / `selected` outputs. Used in Encounters and Arcane Screen.

## Security, role and visibility matrix

| Scenario | GM (`role = 'gm'`) | Authorized Player (`role = 'players'`) |
| --- | --- | --- |
| Execute player character attack/ability | Allowed | Allowed (own token) |
| Spawn monsters, conclude encounter & award XP | Allowed | Denied (`403 Forbidden`) |
| Author/commit global campaign homebrew action | Allowed | Saved as draft pending GM approval |

## Acceptance criteria

- [x] `lw-npc-card`, `lw-creature-card`, and `lw-encounter-card` implemented with separate `.ts`, `.html`, `.scss` files and exported in `shared/ui/public-api.ts`.
- [x] Backend .NET 10 endpoints resolve attack vs. AC and saving throw vs. DC authoritatively, update combatant HP/action economy, and calculate automated XP awards on encounter completion.
- [x] Arcane Screen integrates a live Babylon.js tactical combat renderer with token selection, target range calculation, action firing, and particle effect playback.
- [x] ActionBuilder & EffectBuilder share a unified workspace (`/effects`) with a live Babylon.js 3D spell trajectory & timeline preview canvas and When / If / Then rule composer.
- [x] All files remain under 500 lines (`check_source_limits.py`) and both `dotnet build` and `npm run build` succeed with zero warnings and zero errors.
