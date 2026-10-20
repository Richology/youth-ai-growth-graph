# Star view — A+B visual implementation

The approved concept uses a four-color nebula with crisp competency stars. The first procedural-noise implementation was too soft and sparse. The replacement uses a generated monochrome emission texture, tinted per domain and composited at three depths. Nodes and the 75 real relationships remain geometry; no screenshot or baked graph is used as a background.

## Asset

- `public/textures/nebula-emission-v2.png`
- Generated with the built-in imagegen tool, not the API/CLI.
- Shared by all domain plates. Shader alpha removes black backgrounds and fades plate edges; additive RGB alone is insufficient for the transparent WebGL canvas.
- Generated source copied unchanged into this project.

## Final generation prompt

Create a production astronomy VFX texture, square high resolution 2048x2048. ONLY a richly detailed wispy emission nebula on pure pitch black, monochrome white/silver/gray so it can be tinted by a 3D renderer. An asymmetric open horseshoe of sculptural cosmic gas, with torn branching filaments, lace-like luminous shock fronts, delicate illuminated silver dust and very fine granular cosmic matter. Broad dark hollow at center with a few wisps across, dense bright sculpted edges mainly upper-left and lower-right, discontinuous wisps elsewhere. Organic irregular form, NOT a circular smoke ring. Hubble telescope photographic level intricate microstructure, very high local contrast, bright silver threads among dark dust lanes, complex multiscale fractal detail. Nebula fills middle 80% of square, all four image edges smoothly fading to completely pure black so additive compositing has no rectangle. No colored areas. NO stars, no points, no lens flares, no planets, no typography, no UI, no connections, no logos. Fine luminous wisps instead of soft fog. Single texture only, not a grid or page mockup.

## Verification

Run `npm run build`, `PLAYWRIGHT_BASE_URL=http://127.0.0.1:4322 npm run test:e2e`, and `node qa/star-review.mjs` from site. The last command captures desktop, selected, and mobile views, checks selected labels, browser resource errors, and verifies served JavaScript matches dist.

## Remaining visual differences

The reference is illustrative, with more apparent bright stars and authored connections than the actual 60-node / 75-edge dataset. The implementation preserves the data. Nebula plates have layered parallax, not full volumetric gas simulation. The existing full detail panel remains, rather than replacing its content with the small illustrative mockup card.

## Follow-up: composition and star dust

Nebula rotations and aspect ratios now differ by domain, with their centers offset outward. Dust is drawn in four batched point clouds with per-star pixel size and seeded brightness rather than subpixel textured discs. Selecting a competency fades the selected domain's cloud to 65% and the other clouds to 32%, preserving the readable geometry above them. The shader uses no time animation and remains still with reduced motion.
