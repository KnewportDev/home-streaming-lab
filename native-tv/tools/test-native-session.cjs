'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const tool=require('./native-session.cjs');
const metadata=(model='V405-H9',firmware='1.720.9.1-1')=>({STATUS:{RESULT:'SUCCESS'},ITEM:{MODEL_NAME:model,VERSION:firmware}});

test('CLI accepts explicit private targets and refuses public targets or arbitrary commands',()=>{
  assert.deepEqual(tool.parseArgs(['--help']),{command:'help'});
  assert.equal(tool.parseArgs(['pair-start','--tv','192.168.1.50','--state',path.resolve('private.json')]).command,'pair-start');
  assert.throws(()=>tool.parseArgs(['pair-start','--tv','8.8.8.8','--state',path.resolve('private.json')]));
  assert.throws(()=>tool.parseArgs(['pair-code','--state',path.resolve('private.json'),'--pin','12345']));
  assert.throws(()=>tool.parseArgs(['launch','--url','http://anything']));
});

test('safe diagnostics never display raw external error text or response content',()=>{
  assert.doesNotMatch(tool.safeErrorMessage(Error('AUTH secret PIN2468 http://host/private-nonce')),/secret|2468|http:|nonce/);
  assert.match(tool.safeErrorMessage(Object.assign(Error('private path'),{code:'EEXIST'})),/already exists/);
  let error;try{tool.parseArgs(['pair-code','--state',path.resolve('private.json'),'--pin','secret']);}catch(e){error=e;}
  assert.equal(tool.safeErrorMessage(error),'The PIN must contain exactly four digits.');
});

test('model and exact firmware gates prevent mismatched native app actions',async()=>{
  const good=await tool.verify('192.168.1.50',null,async()=>metadata());assert.equal(good.model,'V405-H9');
  await assert.rejects(()=>tool.verify('192.168.1.50',null,async()=>metadata('M657-G0')));
  await assert.rejects(()=>tool.verify('192.168.1.50',null,async()=>metadata('V405-H9','1.720.9.1-2')));
  await assert.rejects(()=>tool.verify('192.168.1.50',good,async()=>metadata('V405-H19')));
});

test('pairing state is exclusive/private; token and PIN never enter status messages',async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'native-session-test-')),filename=path.join(dir,'private.json'),events=[],calls=[];
  try{
    const transport=async(tv,op,body,token)=>{calls.push({op,body,token});if(op==='info')return metadata();if(op==='start')return {ITEM:{PAIRING_REQ_TOKEN:'private-challenge',CHALLENGE_TYPE:1}};if(op==='pair')return {ITEM:{AUTH_TOKEN:'private-auth-token'}};throw Error('Unexpected operation');};
    await tool.execute({command:'pair-start',tv:'192.168.1.50',state:filename},{transport,report:e=>events.push(e)});
    await assert.rejects(()=>tool.execute({command:'pair-start',tv:'192.168.1.50',state:filename},{transport,report:e=>events.push(e)}));
    await tool.execute({command:'pair-code',state:filename,pin:'2468'},{transport,report:e=>events.push(e)});
    const state=await tool.readState(filename);assert.equal(state.phase,'paired');assert.equal(state.token,'private-auth-token');
    if(process.platform!=='win32')assert.equal((await fs.stat(filename)).mode&0o777,0o600);
    assert.doesNotMatch(JSON.stringify(events),/private-|2468|AUTH_TOKEN|deviceId/);
    assert.equal(calls.filter(x=>x.op==='start').length,1);assert.equal(calls.find(x=>x.op==='pair').token,undefined);
    assert.equal(calls.at(-2).op,'info');assert.equal(calls.at(-1).op,'pair');
  }finally{await fs.rm(dir,{recursive:true,force:true});}
});

test('symlink state paths are refused before reading or overwriting',async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'native-session-links-'));
  try{await fs.writeFile(path.join(dir,'real'),'sensitive');await fs.symlink(path.join(dir,'real'),path.join(dir,'link'));
    await assert.rejects(()=>tool.readState(path.join(dir,'link')));await assert.rejects(()=>tool.writeState(path.join(dir,'link'),{}));
    assert.equal(await fs.readFile(path.join(dir,'real'),'utf8'),'sensitive');
  }finally{await fs.rm(dir,{recursive:true,force:true});}
});

test('nonce routes reject traversal, arbitrary files and malformed telemetry',()=>{
  assert.deepEqual(tool.classifyRoute('/secret/index.html','secret'),{kind:'asset',name:'index.html'});
  for(const u of ['/index.html','/secret/../private.json','/secret/%2e%2e/private.json','/secret/private.json','/secret/telemetry?event=ready&cookie=secret','http://host/secret/index.html'])assert.equal(tool.classifyRoute(u,'secret'),null);
});

test('only the TV JavaScript callback confirms readiness; other peers and POST are denied',()=>{
  let ready=0;const handler=tool.makeHandler({tv:'192.168.1.50',bind:'192.168.6.2',nonce:'secret',files:{'index.html':Buffer.from('ok')},onReady:()=>ready++});
  function run(peer,url,method='GET'){const r={status:null,setHeader(){},writeHead(s){this.status=s;},end(){}};handler({socket:{remoteAddress:peer},url,method},r);return r.status;}
  assert.equal(run('192.168.6.20','/secret/index.html'),403);assert.equal(run('192.168.1.50','/secret/index.html','POST'),405);
  assert.equal(run('192.168.6.2','/secret/telemetry?event=ready'),204);assert.equal(ready,0);
  assert.equal(run('192.168.1.50','/secret/index.html'),200);assert.equal(ready,0);
  assert.equal(run('::ffff:192.168.1.50','/secret/telemetry?event=ready'),204);assert.equal(ready,1);
  run('192.168.1.50','/secret/telemetry?event=ready');assert.equal(ready,1);
});

test('temporary launch uses app17 and closes its server on rejection without exposing credentials or nonce',async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'native-session-launch-')),filename=path.join(dir,'private.json');
  const {EventEmitter}=require('node:events');let server,launch;
  const createServer=handler=>{server=new EventEmitter();server.listen=(port,bind,cb)=>{server.binding={port,bind};queueMicrotask(cb);};server.close=cb=>{server.closed=true;cb();};server.closeAllConnections=()=>{};return server;};
  try{
    const meta=await tool.verify('192.168.1.50',null,async()=>metadata());
    await tool.writeState(filename,{schemaVersion:1,tv:'192.168.1.50',metadata:meta,deviceId:'test-device',phase:'paired',token:'private-token'},true);
    for(const [name,content]of Object.entries({'index.html':'<html></html>','home.js':'void 0;','home.css':'body{}','config.json':'{}'}))await fs.writeFile(path.join(dir,name),content);
    const events=[];const transport=async(tv,op,body,token)=>{if(op==='info')return metadata();launch={tv,op,body,token};throw Error('simulated rejection');};
    await assert.rejects(()=>tool.execute({command:'serve-launch',state:filename,bind:'192.168.6.2',port:8137,home:dir},{transport,createServer,report:e=>events.push(e)}));
    assert.deepEqual(server.binding,{port:8137,bind:'192.168.6.2'});assert.equal(server.closed,true);
    assert.equal(launch.op,'launch');assert.equal(launch.body.VALUE.APP_ID,'17');assert.equal(launch.body.VALUE.NAME_SPACE,4);assert.equal(launch.token,'private-token');
    assert.match(launch.body.VALUE.MESSAGE,/^http:\/\/192\.168\.6\.2:8137\/[a-f0-9]{48}\/index\.html$/);
    assert.deepEqual(events,[]);
  }finally{await fs.rm(dir,{recursive:true,force:true});}
});

test('safe API diagnostics preserve known status codes without exposing body, detail or unknown status text',()=>{
  let blocked;try{tool.validateTvResponse({STATUS:{RESULT:'blocked',DETAIL:'PIN2468 AUTH private-token'},ITEM:{AUTH_TOKEN:'private-token'}},'start');}catch(e){blocked=e;}
  assert.equal(blocked.tvStatus,'BLOCKED');assert.equal(tool.safeErrorMessage(blocked),'TV reported BLOCKED: pairing is already in progress.');
  assert.doesNotMatch(tool.safeErrorMessage(blocked),/2468|private-token/);
  assert.throws(()=>tool.validateTvResponse({STATUS:{RESULT:'private-token http://secret',DETAIL:'2468'}},'start'),{message:'TV returned an unrecognized or missing result status.'});
});

test('one own-state retry reuses device ID and preserves the file when the TV remains BLOCKED',async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'native-session-retry-')),filename=path.join(dir,'private.json');
  try{
    const meta=await tool.verify('192.168.1.50',null,async()=>metadata());
    await tool.writeState(filename,{schemaVersion:1,tv:'192.168.1.50',metadata:meta,deviceId:'same-owned-device',phase:'starting'},true);
    const original=await fs.readFile(filename,'utf8'),calls=[],events=[];
    const blocked=async(tv,op,body)=>{calls.push({op,body});if(op==='info')return metadata();return tool.validateTvResponse({STATUS:{RESULT:'BLOCKED'}},op);};
    await assert.rejects(()=>tool.execute({command:'pair-retry',state:filename},{transport:blocked,report:e=>events.push(e)}),{tvStatus:'BLOCKED'});
    assert.equal(await fs.readFile(filename,'utf8'),original);assert.deepEqual(calls.map(x=>x.op),['info','start']);assert.equal(calls[1].body.DEVICE_ID,'same-owned-device');assert.deepEqual(events,[]);
    await tool.execute({command:'pair-retry',state:filename},{transport:async(tv,op)=>op==='info'?metadata():{ITEM:{CHALLENGE_TYPE:1,PAIRING_REQ_TOKEN:987654}},report:e=>events.push(e)});
    const state=await tool.readState(filename);assert.equal(state.deviceId,'same-owned-device');assert.equal(state.phase,'awaiting_pin');assert.equal(state.challenge.requestToken,987654);
    assert.doesNotMatch(JSON.stringify(events),/987654|same-owned-device/);
  }finally{await fs.rm(dir,{recursive:true,force:true});}
});

test('retry refuses paired and awaiting-PIN states without network requests or state changes',async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'native-session-keep-'));
  try{
    const meta=await tool.verify('192.168.1.50',null,async()=>metadata());
    for(const phase of ['paired','awaiting_pin']){
      const filename=path.join(dir,phase+'.json');
      await tool.writeState(filename,{schemaVersion:1,tv:'192.168.1.50',metadata:meta,deviceId:'owned',phase,...(phase==='paired'?{token:'secret'}:{challenge:{type:1,requestToken:123}})},true);
      const before=await fs.readFile(filename,'utf8');let calls=0;
      await assert.rejects(()=>tool.execute({command:'pair-retry',state:filename},{transport:async()=>{calls++;throw Error('unexpected network');}}));
      assert.equal(calls,0);assert.equal(await fs.readFile(filename,'utf8'),before);
    }
  }finally{await fs.rm(dir,{recursive:true,force:true});}
});

test('an incomplete successful challenge is saved privately and blocks another retry',async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'native-session-partial-')),filename=path.join(dir,'private.json');
  try{
    const meta=await tool.verify('192.168.1.50',null,async()=>metadata());
    await tool.writeState(filename,{schemaVersion:1,tv:'192.168.1.50',metadata:meta,deviceId:'owned',phase:'starting'},true);
    await assert.rejects(()=>tool.execute({command:'pair-retry',state:filename},{transport:async(tv,op)=>op==='info'?metadata():{ITEM:{PAIRING_REQ_TOKEN:'private-challenge'}}}));
    const state=await tool.readState(filename);assert.equal(state.phase,'pairing_response_incomplete');assert.equal(state.challenge.requestToken,'private-challenge');
    let calls=0;await assert.rejects(()=>tool.execute({command:'pair-retry',state:filename},{transport:async()=>{calls++;}}));assert.equal(calls,0);
  }finally{await fs.rm(dir,{recursive:true,force:true});}
});

test('Windows-compatible writes use exclusive creation and r+ before handle truncation',async(t)=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'native-session-windows-')),filename=path.join(dir,'private.json');
  const originalOpen=fs.open,flags=[];
  t.mock.method(fs,'open',async(file,flag,...args)=>{
    flags.push(flag);
    if(typeof flag==='number'&&(flag&require('node:fs').constants.O_TRUNC))throw Object.assign(Error('simulated Windows numeric truncate-open failure'),{code:'EINVAL'});
    return originalOpen(file,flag,...args);
  });
  try{
    await tool.writeState(filename,{phase:'starting',padding:'x'.repeat(1000)},true);
    await tool.writeState(filename,{phase:'awaiting_pin',challenge:{type:1,requestToken:'synthetic-secret'}});
    assert.deepEqual(flags,['wx','r+']);
    assert.deepEqual(JSON.parse(await fs.readFile(filename,'utf8')),{phase:'awaiting_pin',challenge:{type:1,requestToken:'synthetic-secret'}});
  }finally{t.mock.restoreAll();await fs.rm(dir,{recursive:true,force:true});}
});
