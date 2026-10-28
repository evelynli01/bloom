# BLOOM — Stylized botanical peony

The peony is a lightweight **Canvas 2D botanical illustration** of a flower head, with 62 individually curved petals in six overlapping layers. The inner layers lead the stylized opening, with the surrounding layers following on overlapping schedules. Each petal's longitudinal bend, cup and ruffled edge change as it opens. Texture lines follow the same surface coordinates throughout. The same bloom percentage produces the same pose in either direction; there are no image crossfades or full-flower scaling.

## Start

1. Open a Terminal in this project folder.
2. Run `python3 -m http.server 8000`.
3. Open `http://localhost:8000` in Chrome.
4. Open **Controls** to test the bloom slider from 0 to 100% before enabling your webcam.
5. Enable the camera for thumb/index hand control (camera access requires permission).

The peony artwork has **no external dependencies**. Internet access is required for MediaPipe hand tracking. The original PNG atlas remains an image fallback if the Canvas renderer cannot initialize.

## Scope

- `peony3d.js`: Canvas peony renderer; the existing filename is retained. Uses the existing `bloom:progress` (0–100) and `bloom:flower` events.
- `script.js`: existing flower navigation, UI and gestures, with Canvas renderer selection.
- `index.html`: loads the local renderer and describes the stylized artwork.
- `style.css`: positions the canvas within the existing artwork area.
- `tulip.js`: procedural tulip, shown when selected in the gallery.
- `assets/peony-atlas.png`: original PNG fallback.

This is a stylized illustration, not a photorealistic simulation. Canvas uses a fixed painter's order for overlapping petals rather than full 3D depth testing. The canvas maintains its proportions as the artwork area resizes and redraws only when needed. Other flowers and the existing interface remain unchanged. Earlier standalone experiments are preserved in `prototypes/` and are not loaded by Bloom.

## Visual review

Check the slider at 0%, 25%, 50%, 75% and 100%, then reverse slowly. Try pinch/spread control and navigate away and back to check renderer switching. The peony should show only its flower head. Controls no longer include video uploads. Visual testing is handled by the project owner.


## Four-flower garden update

The gallery now contains peony, ranunculus, garden rose, and camellia. All four use the lightweight Canvas layered-petal renderer in `peony3d.js` (legacy filename). The webcam preview retains all five fingers and smooths all 21 MediaPipe landmarks; thumb/index separation controls bloom. These are stylized botanical studies, not photorealistic simulations.


## Four-species edition
Gallery: Peony (spring), Bearded Iris (spring), Classic Red Rose (summer), Gardenia (late summer). All four use the Canvas renderer with different petal silhouettes and gesture-controlled motion. The full-hand landmark overlay remains unchanged.
