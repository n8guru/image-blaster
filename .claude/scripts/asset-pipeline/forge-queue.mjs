import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { copyFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { ensureDir, inferMime, loadDotEnv, pathExists, readJson, writeJson } from './fal-queue.mjs';

// Use Generation OS's governed gen_request ingress, never raw ComfyUI.
export async function runForgeGeneration(options) {
  await loadDotEnv();
  const { metadataPath, outputDir, kind, engine, prompt, sampling = {}, image, images = [], metadata = {}, pollIntervalMs = 3000, timeoutMs = 900000, submitImage = submitImageThroughForage } = options;
  await ensureDir(outputDir);
  const endpoint = (process.env.FORGE_GENERATION_URL || 'http://100.70.241.41:8096').replace(/\/$/, '') + '/api/gen_request';
  const previous = metadataPath && await pathExists(metadataPath) ? await readJson(metadataPath) : {};
  if (previous.provider_slug && previous.provider_slug !== 'forge') throw new Error('Refusing to resume a different provider through Forge.');
  let id = previous.request_id;
  const request = async (url, body) => {
    const response = await fetch(url, { method: body ? 'POST' : 'GET', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw new Error(`Forge HTTP ${response.status}: ${(await response.text()).slice(0, 400)}`);
    return response.json();
  };
  const inputs = kind === '3d' ? [image] : images;
  for (const input of inputs) {
    if (!/^https?:\/\//.test(input) && !(await pathExists(input))) throw new Error(`Input does not exist on Forge: ${input}`);
  }
  if (!id && previous.status === 'submitting') throw new Error(`Submission outcome unknown; reconcile ${metadataPath} before resubmitting.`);
  if (!id) {
    const body = { async: true, engine, prompt, sampling: { ...sampling, purpose: 'playground' }, session_label: 'image-blaster-local', notes: 'Local image-blaster provider; experimental asset, requires visual review.' };
    if (kind === '3d') body.init_image = /^https?:\/\//.test(image) ? image : path.resolve(image);
    else {
      body.recipe = process.env.FORGE_IMAGE_RECIPE || 'QWEN_IMAGE_21_T2I';
      body.sampling.references = images.map((url, index) => ({ url: /^https?:\/\//.test(url) ? url : path.resolve(url), name: `source_${index + 1}`, role: 'object', use_for: 'composite' }));
    }
    await writeJson(metadataPath, { ...metadata, kind, provider: 'forge', provider_slug: 'forge', endpoint, engine, status: 'submitting', submitted_at: new Date().toISOString(), input_files: inputs });
    const accepted = kind === '3d' ? await request(endpoint, body) : await submitImage({ type: 'image', backend: 'forge', engine, recipe_name: body.recipe, prompt, references: body.sampling.references, sampling: body.sampling, purpose: 'playground', wait: false });
    id = accepted.request_id || accepted.id;
    if (!id) throw new Error('Forge did not return a request ID.');
    // Persist immediately: timeout/restart must poll this same ID, not submit again.
    await writeJson(metadataPath, { ...metadata, kind, provider: 'forge', provider_slug: 'forge', endpoint, engine, request_id: id, status: 'queued', submitted_at: new Date().toISOString(), input_files: inputs });
  }
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const state = await request(`${endpoint}/${encodeURIComponent(id)}`);
    const status = state.request?.render_status;
    if (['failed', 'failure', 'error', 'cancelled', 'canceled'].includes(status)) {
      await writeJson(metadataPath, { ...(await readJson(metadataPath)), status: 'failed', error: state.results?.at(-1)?.error_message || status });
      throw new Error(`Forge generation ${id} failed; see ${metadataPath}`);
    }
    if (['success', 'completed', 'succeeded'].includes(status)) {
      const result = [...(state.results || [])].reverse().find(r => r.status === 'success');
      const source = kind === '3d' ? result?.raw_metadata?.glb_path : result?.output_path;
      if (!source || !(await pathExists(source))) throw new Error(`Forge ${id} completed without a local ${kind === '3d' ? 'GLB' : 'image'}. Run this adapter on Forge.`);
      if (kind === '3d' && (await readFile(source)).subarray(0,4).toString() !== 'glTF') throw new Error('Forge returned an invalid GLB.');
      const dest = path.join(outputDir, `forge-${id}${kind === '3d' ? '.glb' : path.extname(source)}`);
      if (path.resolve(dest) !== path.resolve(source)) await copyFile(source, dest);
      const summary = { ...(await readJson(metadataPath)), status: 'completed', completed_at: new Date().toISOString(), output_files: [dest], downloaded_files: [{path: dest, source: {content_type: kind === '3d' ? 'model/gltf-binary' : inferMime(source)}}], result, asset_scope: 'playground_draft' };
      await writeJson(metadataPath, summary);
      return summary;
    }
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }
  throw new Error(`Forge generation ${id} still pending; rerun to resume ${metadataPath}.`);
}

export function runForge3D(options) {
  if (options.generateType && options.generateType !== 'Normal') throw new Error('Forge/TRELLIS currently supports textured Normal objects only.');
  return runForgeGeneration({ ...options, kind: '3d', engine: process.env.FORGE_3D_ENGINE || 'trellis', prompt: `Reconstruct this isolated ${options.assetName || 'object'} as a separate textured 3D mesh, preserving its photographed geometry and materials.` });
}
export function runForgeImageEdit(options) {
  if (options.maskImage) throw new Error('Forge image adapter does not support masks yet.');
  if (Number(options.numImages || 1) !== 1) throw new Error('Forge image adapter produces one image per request.');
  if (process.env.FORGE_IMAGE_ENGINE && process.env.FORGE_IMAGE_ENGINE !== 'qwen21' && !process.env.FORGE_IMAGE_RECIPE) throw new Error('Set FORGE_IMAGE_RECIPE when changing the image engine.');
  return runForgeGeneration({ ...options, kind: '2d', engine: process.env.FORGE_IMAGE_ENGINE || 'qwen21', submitImage: options.submitImage });
}
export function resumeForgeRequest(request, outputDir) {
  return runForgeGeneration({ metadataPath: request.path, outputDir, kind: request.data.kind, engine: request.data.engine, image: request.data.input_files?.[0], images: request.data.input_files || [] });
}

function submitImageThroughForage(body) {
  return new Promise((resolve, reject) => {
    const child = spawn('python3', [fileURLToPath(new URL('./forge-image-submit.py', import.meta.url))], { stdio: ['pipe', 'pipe', 'pipe'] });
    let output = '', error = '';
    child.stdout.on('data', chunk => { output += chunk; });
    child.stderr.on('data', chunk => { error += chunk; });
    child.on('error', reject);
    child.on('close', code => {
      if (code) return reject(new Error(`Forage image submission failed: ${error.slice(0,400)}`));
      try { const result = JSON.parse(output); if (!result.ok) throw new Error(result.error || 'Forage rejected image submission'); resolve(result); } catch (e) { reject(e); }
    });
    child.stdin.end(JSON.stringify(body));
  });
}
