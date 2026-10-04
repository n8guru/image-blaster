# Local generation fork

This fork retains image-blaster's object analysis, clean-plate/reference workflow,
indexed assets, request sidecars, editor, placement and physics. Its image-edit
and 3D object defaults are local Forge providers rather than FAL.

Run generation scripts on Forge. Image requests enter the promoted Forage
`peer-generate-artifact` boundary through the installed connection bridge, which
loads credentials privately. TRELLIS objects enter the governed local
`/api/gen_request` dispatcher. Neither route sends raw ComfyUI graphs.

```sh
cp .env.example .env
node .claude/scripts/asset-pipeline/generate-single-asset.mjs \
  --world my-room --object-id chair --provider forge \
  --image-edit-prompt 'Isolate exactly the chair in the source photo; retain its materials and proportions.'
```

Use the original project/uncover skills to stage and analyze the room photo and
write one `object.json` per physical object. The command above then automates
reference extraction and textured mesh generation. It records each request ID
before polling; rerunning resumes that request. A submission with an unknown
outcome stops for reconciliation rather than creating a duplicate.

Images default to Qwen Image 2.1 with its explicit recipe; objects default to
TRELLIS. Both are drafts requiring visual inspection, not automatic product
promotion. The frontend loads normal indexed local image/GLB files; separate
objects retain the existing editor/physics behavior.

## Remaining environment stage

The demo uses **World Labs for the static background splat**, separately from
FAL's object meshes. This fork does not yet supply a local equivalent. Local
image/object generation alone does not produce the demo's complete environment.
The original World Labs and FAL SFX scripts remain available only when those
cloud stages are explicitly selected. Do not replace this stage with a manual
blockout and call it a successful image blast.

SHARP is a candidate to evaluate, not an installed backend: its documented
single-photo output supports nearby novel views, which does not establish
free exploration or reconstruction of an entire White House.

## Verification

`node --test tests/forge-provider.test.mjs` checks timeout/resume and ambiguous
submission behavior without cloud requests. See `evidence/forge-provider.md`
for the concrete local-generation proof and limitations.

## World Labs credentials

Nate has explicitly selected World Labs for detailed environments. Store
`WORLD_LABS_API_KEY` in Forage's vault and grant that named scope to Forge. The
world generator resolves it at runtime with `forage-secret get`; it is never
written into request metadata or committed to this repository. The key value
stays inside the child-process result and the provider authorization header.
Do not paste it into chat or put it in the fork's configuration files.
