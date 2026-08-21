# PhysicsGame — "Bob"

A browser physics game that teaches mechanics from the ground up, starting
with the simplest object that can still do something interesting: a point.

## Why a point?

Bob has no size, no shape, no mass and no friction, and he moves along a
single axis. That is not a limitation — it is the teaching device. With
everything else removed there are only two quantities left to notice,
position and velocity, and exactly one relationship between them:

```
v = Δx / Δt
```

Each later stage switches one more thing on (acceleration, then mass and
force, then friction, then a second dimension), so every new idea shows up
as a visible change in the same x–t graph the player already understands.

## Status

Early preview. The playable intro ("Meet Bob") covers position and
velocity. Everything after that is still being built.

Roadmap: position ✓ · velocity ✓ · acceleration · mass & force · friction ·
energy · 2D motion · collisions

## Running it

This repo is consumed as a git submodule by the
[homeserver](https://github.com/tombo92/Homeserver) gateway, which mounts
it at `modules/physics/` and autodiscovers `router.py`. The game is then
served at `/game/bob`.

```
modules/physics/
  router.py          FastAPI router (page + static + health)
  templates/bob.html
  static/bob.css
  static/bob.js      physics, rendering and the intro script
  VERSION
```

No build step and no dependencies beyond the gateway's FastAPI.

## Design notes

- Constant velocity is integrated exactly (`x += v·dt`), so there is no
  numerical drift to explain away while teaching the basics.
- The frame delta is clamped, so switching tabs does not teleport Bob.
- The intro is playable with a mouse, touch, or the keyboard (arrows to
  push, space to stop).
- Honours `prefers-reduced-motion`.
