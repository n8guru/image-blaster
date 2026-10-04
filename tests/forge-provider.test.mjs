import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runForge3D, runForgeImageEdit } from '../.claude/scripts/asset-pipeline/forge-queue.mjs';

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

test('native object pipeline resumes scoped sidecar and produces indexed viewer asset',async()=>{
 const {generateSingleObject}=await import('../.claude/scripts/asset-pipeline/generate-single-asset.mjs');
 const dir=await mkdtemp(path.join(os.tmpdir(),'forge-native-'));const out=path.join(dir,'worlds/proof/output/chair');
 const {mkdir}=await import('node:fs/promises');await mkdir(out,{recursive:true});await writeFile(path.join(out,'0-chair.png'),'reference');await writeFile(path.join(out,'object.json'),JSON.stringify({object:{id:'chair',name:'chair',source_images:[path.join(out,'0-chair.png')]}}));
 const glb=path.join(dir,'generated.glb');await writeFile(glb,'glTFfixture');let posts=0;
 const server=http.createServer((req,res)=>{if(req.method==='POST')posts++;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({request:{render_status:'success'},results:[{status:'success',raw_metadata:{glb_path:glb}}]}));});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));process.env.FORGE_GENERATION_URL=`http://127.0.0.1:${server.address().port}`;
 await writeFile(path.join(out,'.0-chair__model-request.json'),JSON.stringify({provider_slug:'forge',kind:'3d',engine:'trellis',request_id:'already-submitted',endpoint:process.env.FORGE_GENERATION_URL+'/api/gen_request',status:'queued',index:0,input_files:[path.join(out,'0-chair.png')]}));
 const previousCwd=process.cwd();
 try {process.chdir(dir);const result=await generateSingleObject({world:'proof',objectId:'chair',modelProvider:'forge'});assert.deepEqual(result.model_files,['worlds/proof/output/chair/0-chair.glb']);assert.equal(posts,0);const record=JSON.parse(await readFile(path.join(out,'.0-chair__model-request.json')));assert.equal(record.request_id,'already-submitted');assert.equal(record.downloaded_files[0].path,result.model_files[0]);}
 finally {process.chdir(previousCwd);delete process.env.FORGE_GENERATION_URL;await new Promise(resolve=>server.close(resolve));}
});

test('image bridge submits once through the peer door and resumes the same id on gen_request', async () => {
 const dir=await mkdtemp(path.join(os.tmpdir(),'forge-image-'));const image=path.join(dir,'src.png');await writeFile(image,'png');
 const outPng=path.join(dir,'done.png');await writeFile(outPng,Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]));
 let bridgePosts=0, polls=0, ready=false;
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','application/json');
  assert.equal(req.method,'GET');polls++;
  res.end(JSON.stringify({request:{render_status:ready?'success':'rendering'},results:ready?[{status:'success',output_path:outPng}]:[]}));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 process.env.FORGE_GENERATION_URL=`http://127.0.0.1:${server.address().port}`;
 const submitImage=async body=>{
  bridgePosts++;
  assert.equal(body.purpose,'playground');
  assert.equal(body.backend,'forge');
  assert.equal(body.wait,false);
  assert.equal(body.references[0].url,image);
  return {ok:true,request_id:'bridge-id'};
 };
 const options={images:[image],prompt:'extract the chair',outputDir:path.join(dir,'out'),metadataPath:path.join(dir,'request.json'),timeoutMs:20,pollIntervalMs:25,submitImage};
 try {
  await assert.rejects(runForgeImageEdit(options),/still pending/);
  const queued=JSON.parse(await readFile(options.metadataPath));
  assert.equal(queued.request_id,'bridge-id');
  assert.equal(queued.kind,'2d');
  assert.equal(bridgePosts,1);
  assert.equal(polls>=1,true);
  ready=true;
  const result=await runForgeImageEdit(options);
  assert.equal(bridgePosts,1);
  assert.equal(result.status,'completed');
  assert.equal(JSON.parse(await readFile(options.metadataPath)).request_id,'bridge-id');
  assert.equal((await readFile(result.output_files[0]))[0],0x89);
 } finally {delete process.env.FORGE_GENERATION_URL;await new Promise(resolve=>server.close(resolve));}
});

test('ambiguous image submission is not silently repeated', async () => {
 const dir=await mkdtemp(path.join(os.tmpdir(),'forge-image-ambiguous-'));const image=path.join(dir,'src.png');await writeFile(image,'png');
 const metadataPath=path.join(dir,'request.json');
 await writeFile(metadataPath,JSON.stringify({provider_slug:'forge',status:'submitting',kind:'2d'}));
 let posts=0;
 await assert.rejects(runForgeImageEdit({images:[image],prompt:'x',metadataPath,outputDir:dir,submitImage:async()=>{posts++;return {ok:true,request_id:'nope'};}}),/outcome unknown/);
 assert.equal(posts,0);
});
