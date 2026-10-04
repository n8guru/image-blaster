import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runForge3D } from '../.claude/scripts/asset-pipeline/forge-queue.mjs';

test('timed-out object job resumes same request and writes the GLB without FAL', async () => {
 const dir=await mkdtemp(path.join(os.tmpdir(),'forge-provider-'));const image=path.join(dir,'ref.png');await writeFile(image,'ref');
 const glb=path.join(dir,'result.glb');await writeFile(glb,Buffer.from('glTFfixture'));let submits=0,ready=false;
 const server=http.createServer(async(req,res)=>{res.setHeader('Content-Type','application/json');
  if(req.method==='POST'){submits++;let raw='';for await(const chunk of req)raw+=chunk;const body=JSON.parse(raw);assert.equal(body.engine,'trellis');assert.equal(body.init_image,image);assert.equal(body.sampling.purpose,'playground');res.end(JSON.stringify({id:'same-id'}));}
  else res.end(JSON.stringify({request:{render_status:ready?'success':'rendering'},results:ready?[{status:'success',raw_metadata:{glb_path:glb}}]:[]}));
 });await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));process.env.FORGE_GENERATION_URL=`http://127.0.0.1:${server.address().port}`;
 try {
  const options={image,outputDir:path.join(dir,'out'),metadataPath:path.join(dir,'request.json'),timeoutMs:20,pollIntervalMs:25};
  await assert.rejects(runForge3D(options),/still pending/);assert.equal(JSON.parse(await readFile(options.metadataPath)).request_id,'same-id');
  ready=true;const result=await runForge3D(options);assert.equal(submits,1);assert.equal(result.status,'completed');assert.equal((await readFile(result.output_files[0])).subarray(0,4).toString(),'glTF');
 } finally {delete process.env.FORGE_GENERATION_URL;await new Promise(resolve=>server.close(resolve));}
});

test('ambiguous submission is not silently repeated', async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'forge-ambiguous-'));const image=path.join(dir,'ref.png');await writeFile(image,'ref');const metadataPath=path.join(dir,'request.json');await writeFile(metadataPath,JSON.stringify({provider_slug:'forge',status:'submitting'}));
 await assert.rejects(runForge3D({image,metadataPath,outputDir:dir}),/outcome unknown/);
});
