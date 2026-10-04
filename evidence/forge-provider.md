# Local provider verification

Source fork: https://github.com/n8guru/image-blaster, branch `forge/local-generation`.
Producer evidence, not an independent verdict.

- `node --test tests/forge-provider.test.mjs`: three tests pass, including one POST
  across timeout/resume and no repeated submission after an ambiguous result.
- JS syntax checks and shell syntax check pass.
- Live original object proof: `464cef449a414ea68b4e49468f0335ba`, local TRELLIS,
  44,308 faces, one mesh with embedded texture. Blender-loop inspection:
  `/home/n8/evidence/blender-loop/white-house-chair-proof/stills/`.
  This original request was classified as a product still and its poster-based
  media QC failed because it judged the source poster rather than the 3D mesh.
  It is a draft proof, not product approval.
- Live fork object request: `e5d51274325f4947b8a36211f0534867`, success. Native CLI
  returned `worlds/provider-proof/output/chair/0-chair.glb` and indexed request
  `.0-chair__model-request.json`. Existing museum reference was reused; no FAL
  request or key was needed. Scope metadata declared playground.
- Image extraction request `34265d5fa767453a9e69fc854dcc3346`: success, inspected
  `/home/n8/ComfyUI/output/image_blaster_local__446b4219.png`. Floral chair and
  carved frame retained, museum text/ruler removed, white background. The first
  adapter revision submitted this through governed gen_request; final image
  submit code now uses the promoted Forage boundary instead.
- Final promoted image-submit proof: White House exterior clean plate, request
  saved in `worlds/white-house-local/source/.1-exterior-clean-plate-request.json`
  (inspect actual index on disk). Request `fe856fc69eb74395b3b91de2f09be308` now
  reports success and is pollable through gen_request. Snapshot refreshed with
  timestamp. The same source code submitted it through the promoted Python
  bridge; body declared playground, but the recipe/front-door normalized it
  to sfw_product. Media QC is qc_unavailable. No product promotion claimed.
- Museum reference: https://www.metmuseum.org/art/collection/search/189401,
  API marks public domain. It is a stylistic analogue, not White House furniture.

Generation records stay in ignored `worlds/`; compact evidence JSON is tracked.
The fork preserves original World Labs environment generation. Nate explicitly
selected World Labs after offering a key; it now resolves the named secret from
Forage's scoped vault. Access request K-53 awaiting SMS approval408808. Key value
has not entered this repository or agent output.

This does not prove the complete White House, unrestricted building
reconstruction, demo quality, Grove integration of separate movable furniture,
or local replacement of World Labs. Those remain production work.

Image-bridge defect (reviews 138065 and 138073, still open at 138144): mock tests now cover 2d submit-once, gen_request poll/resume of the bridge id, and ambiguous-submit refusal. Resume-only proof of fe856fc69eb74395b3b91de2f09be308 polled GET /api/gen_request/<id>, returned success, and did not submit again. Duplicate forge-<id>.png from that resume was removed; indexed 1-exterior-clean-plate.png remains canonical. Remediation task 138146 (operator decision 2049562). Do not claim the full fork verified until a focused re-review PASS.
