# Art and sound

## Look

- Soft, glossy jelly. Slightly see through with a bright highlight and a soft shadow under it.
- Big dark eyes with one white shine dot. Small mouth. Blush on happy slimes.
- Palette per rarity: green (common), blue, pink, gold, crystal (clear with sparkles), shadow (dark purple, rare).
- World: cosy market town, warm light, wooden stalls, lanterns. Low poly props from Quaternius or Kenney.

## States

| State | Shape | Colour | Motion |
| --- | --- | --- | --- |
| Thriving | Tall and round | Full saturation, sparkles | High, quick bounce |
| Fine | Round | Normal | Gentle bounce |
| Hungry | Slightly smaller | Normal | Slow bounce, looks at food |
| Broke | Flat, wide | Pale | Barely moves, sweat drop |
| Asleep | Low dome | Grey | Still, slow breathing, "z" |

## Making a slime in Blender

1. Add a UV sphere. Scale Z to 0.8, flatten the bottom.
2. Shade smooth, add a subdivision surface modifier (level 2).
3. Material: Principled BSDF, base colour per rarity, roughness 0.15, transmission 0.4, coat 1.0.
4. Eyes: two small black spheres with a tiny white sphere for the shine.
5. Export as glTF (`.glb`). Compress with glTF Transform.
6. In Three.js, swap colour and scale in code for each slime instead of exporting one model per colour.

The script for these steps is [art/blender/make_slime.py](../art/blender/make_slime.py). With Blender 5 installed, `pnpm art:slime` rebuilds `public/models/slime.glb` (about 90 KB after meshopt compression) and renders `art/slime-preview.png`.

## Animation

- Squash and stretch in code: scale Y down and X/Z up on landing, the reverse on jump.
- Idle breathing: small sine wave on scale.
- Wobble: a vertex shader with a little noise makes it look like jelly.
- Reactions: hop on feed, spin on reward, droop on bad news.

## Sound

- Voices: ElevenLabs. One voice per slime, pitched up when young. Short lines, cached.
- Effects: squish, boing, coin clink, shop bell, sleepy snore (Kenney audio, Freesound, or ElevenLabs sound effects).
- Music: one calm town loop, one race loop.
