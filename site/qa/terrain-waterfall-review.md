# Terrain waterfall review — 2026-10-24

## Reference and scope

Approved reference: `concepts/terrain-waterfall-no-people-2026-10-24.png`.
This is a generated concept, not a screenshot of the implementation. The current change implements its no-people direction, waterfall, finer pine foliage, exposed shoreline and offshore rocks while retaining graph data and interactive terrain.

## Implemented

- Removed decorative visitors; retained paths, bridges and node terraces.
- Lowered the two foreground ridges and raised the initial camera angle to expose the central channel.
- Added a terrain-following cascade with moving fine water strands, a split flow, impact ripples and animated spray. Its clock is the existing water clock, so reduced motion freezes it as well.
- Added needle-and-twig branch cards with transparent gaps; reduced solid canopy geometry, diversified branch heights and kept autumn foliage on the foreground left.
- Added five offshore outcrops with the same triplanar mineral shader as the mountain, small procedural shoreline pools, pale shoreline coloration and a darker wet-rock band.
- Enlarged landmark landings slightly with a lower stone step. Warmed the main light and adjusted wave detail/shore foam.

## Verification

- `npm run build`: Astro check 34 files, no errors/warnings/hints; production build passes. Existing Vite chunk size advisory remains.
- Full Playwright suite: 16 passed. After the final drainage-route correction, the three terrain/cascade geometry tests were rerun and passed.
- `qa/capture.mjs`: ten desktop/mobile/tablet, selected-state and water-angle screenshots, no browser errors before the final route correction.
- `node qa/terrain-review.mjs`: final desktop/mobile/tablet screenshots, browser errors and exact comparison of served scripts/pine texture against `dist`.
- Added a regression test for finite cascade geometry, clearance above the rock bed, sea-level discharge and shared animation clock.

## Visual assessment / remaining differences

Actual screenshot: `terrain-waterfall-desktop.png`. The waterfall and fine branch silhouettes are visible and people are absent. The default camera still partially obscures the lowest cascade behind scenery/bridge. The concept's sculpted rock strata, broad stepped waterfall, dense yet clean tree silhouettes and cinematic underwater light remain more detailed than this procedural real-time scene. This is not a pixel-identical reproduction of the concept, and no such claim is made. No commit or push was performed.

## Generated asset provenance

`public/assets/pine-bough.png`: generated with the built-in image generation tool, transparent background, copied into the project. Used as a foliage material, not as a replacement image for the 3D scene.

Source output: `/Users/a11berich/.codex/generated_images/01a0e336-22bf-7880-8458-35862c7ed019/exec-093befc2-40ca-414a-a59e-2786527e39cc.png`.

Prompt:

> Create one photorealistic game foliage texture sprite: a single irregular broad horizontal pine bough / airy pine needle canopy tuft, isolated on genuinely transparent background. High detail individual fine pine needles in muted sage olive and medium green, slender visible woody twigs branching naturally, clustered needle bundles with many small holes and gaps and a broken feathery silhouette. Viewed slightly from above at 25 degrees, fully within frame, landscape-ish bough centered in square canvas. Soft neutral diffuse daylight, no cast shadow on background, no dramatic lighting, no black outlines. Natural asymmetrical branching, thin needle tips, realistic botanical detail. Not an entire tree, no trunk, no pot, no ground, no text, no collage, no drop shadow. This texture will be used on small overlapping branch cards in a 3D miniature pine tree. Avoid dense opaque blobs or disc shaped canopy. Genuinely transparent alpha outside needles and in branch gaps.

## Revision after visual feedback

The initial branch-card result and continuous waterfall strip were rejected. Pine rendering now uses volumetric needle-spray geometry (`src/lib/pine.ts`) with spaced trees, visible woody branches and multiple separated sprays along each branch. The generated pine image is retained as an unused exploration asset; the current scene no longer loads it. The waterfall now has 16 columns of raised, variable-width strands, non-periodic flowing noise, two supported wet-rock landings and softer spray. The original flat-strip and picture-plane approach is superseded.

Final review includes desktop, mobile, tablet and a zoomed screenshot. This revision still uses procedural rock forms and cannot be described as matching the reference's sculpted rock geometry or cinematic lighting. The purpose of the screenshots is to expose this difference, not to substitute tests for visual quality.

## Source and impact revision

Added a rock-cleft inlet channel joined to a source pool, with a supporting bed and an open rocky rim facing the spillway. The water sheet now varies its reflection with viewing angle and includes small moving surface displacement. Each of the two intermediate landings and the sea-level outlet has separate churning foam, expanding ripples, ballistic droplets and lower-opacity mist. All effects use the existing shared water clock, including reduced-motion behavior. Regression coverage now checks that the inlet ends inside the source pool and that all three impact systems share the clock.

## Embedded basin and visibility revision

Replaced the separate protruding basin/rim meshes with a shallow depression blended into `heightAt`, before the existing node-terrace constraints. The pool has a slightly irregular outline and an open eastern lip. A narrow clearing follows the watercourse and opens its near bank; both scatter vegetation and decorative cliff fragments respect it. Water aeration now develops downstream and concentrates near the two impacts, while spreading foam is broken into patches that fade with distance. Terrain landing, water clearance and waterfall source/clock checks: five passed; production build passed.

## Remove the artificial-looking source pool

Following further visual feedback, removed the visible pool disk and its basin deformation entirely. Restored the original mountain surface at the source, narrowed the inlet creek and matched the waterfall's initial width to it. The inlet now flows directly into the fall rather than through a conspicuous pond. Existing lower ledges, foam and spray remain. Updated the continuity regression to compare the creek endpoint directly with the waterfall source; all five relevant geometry/water tests and the production build pass.

## Rock, vegetation and light pass

Reduced loose-rock scatter on steep slopes and replaced 150 smaller rounded cliff inserts with up to 100 larger, squarer fractured rock masses embedded deeper into the mountain. Existing node and waterfall clearances remain. Pine trunks now use four tapered, bending segments, with branches originating on the curved trunk. Ground vegetation occupies more sheltered patches with varied heights. Lowered the warm key light, reduced ambient fill and strengthened contact shadows with a cool rim. Desktop and close-up screenshots show stronger continuous rock faces and light/shadow separation; procedural geometry remains less detailed than the concept's sculpted assets. Four viewport screenshots pass resource/error checks; production build succeeds.

## Rock relief and branch attachment follow-up

Added asymmetric shoulder erosion and a narrow cleft to cliff geometry, with restrained, anti-aliased discontinuous joint coloration on exposed vertical rock faces. Varied branch levels and needle spray scales; corrected spray positions to interpolate along the actual curved-trunk branch rather than the old straight trunk axis. Production build passes without Astro diagnostics. Existing Vite chunk advisory remains. This is a geometry/material refinement, not a claim of reference-level sculpted detail.
