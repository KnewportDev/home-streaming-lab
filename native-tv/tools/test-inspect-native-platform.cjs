'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {EventEmitter}=require('node:events');
const tool=require('./inspect-native-platform.cjs');
const TV='192.168.1.50',TOKEN='1.2.3-auth-secret';
const metadata=(model='V405-H9',firmware='1.720.9.1-1')=>({STATUS:{RESULT:'SUCCESS'},ITEM:{MODEL_NAME:model,VERSION:firmware}});
const success=item=>({STATUS:{RESULT:'SUCCESS'},ITEM:item});
async function fixture(t,changes={}){
  const dir=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'native-platform-'))),filename=path.join(dir,'paired.json');
  t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const state={schemaVersion:1,tv:TV,deviceId:'synthetic-client-id',phase:'paired',token:TOKEN,metadata:{model:'V405-H9',firmware:{system:'1.720.9.1-1'}},...changes};
  await fs.writeFile(filename,JSON.stringify(state),{mode:0o600,flag:'wx'});
  return {dir,filename,state};
}
function fakeHttp(respond){
  const calls=[];
  function request(options,receive){
    const req=new EventEmitter();req.destroy=()=>{req.destroyed=true;};
    req.end=body=>{calls.push({options,body,req});queueMicrotask(()=>{
      const res=new EventEmitter();res.headers={};res.statusCode=200;res.destroy=()=>{res.destroyed=true;};
      respond({options,receive,req,res});
    });};return req;
  }
  return {request,calls};
}
function emitJson(receive,res,data){receive(res);res.emit('data',Buffer.from(JSON.stringify(data)));res.emit('end');}

test('inspection CLI accepts one absolute paired-state path and one optional network flag',()=>{
  assert.deepEqual(tool.parseArgs(['--help']),{help:true});
  assert.deepEqual(tool.parseArgs(['--state',path.resolve('paired.json')]),{state:path.resolve('paired.json')});
  const filename=path.resolve('paired.json');
  assert.deepEqual(tool.parseArgs(['--state',filename,'--network']),{state:filename,network:true});
  assert.deepEqual(tool.parseArgs(['--network','--state',filename]),{network:true,state:filename});
  for(const args of [[],['--state','relative.json'],['--tv',TV],['--state',filename,'--url','/reboot'],['--help','--state','anything'],['--network'],['--state',filename,'--network','--network'],['--state',filename,'--network','true'],['--state',filename,'--state',filename],['--state',filename,'--network=1']])assert.throws(()=>tool.parseArgs(args));
});

test('inspection verifies before authentication, reads only fixed routes, redacts output, and preserves state',async t=>{
  const {dir,filename}=await fixture(t),before=await fs.readFile(filename),stat=await fs.stat(filename),calls=[];
  const transport=async(tv,operation,token)=>{
    calls.push({tv,operation,token});
    if(operation==='info')return {...metadata(),ITEM:{...metadata().ITEM,SERIAL_NUMBER:'private-serial',MAC:'11:22:33:44:55:66',FRIENDLY_NAME:'private-name'}};
    if(operation==='currentApp')return success({VALUE:{APP_ID:'17',NAME_SPACE:4,MESSAGE:'https://example.github.io/private-project/'}});
    if(operation==='versions')return success({API:'3.9.1-2640.0002',HOME:'26.09.01.21',BINARIES:{VIZIOS:'mtk5691-1.6.1770.1',CONJURE:'128.1.9',COBALT:'v-1.'+TV,SCPL:TOKEN,VIZIONDK:'11-22-33-44-55-66',UNKNOWN:'private-unknown'},SERIAL_NUMBER:'9.8.7-private',VIZIOSDK:'9.8.7-private'});
    if(operation==='tvInfo')return {STATUS:{RESULT:'SUCCESS'},ITEMS:[{CNAME:'cast_version',VALUE:'1.40.169511'},{CNAME:'serial_number',VALUE:'private-serial'},{CNAME:'esn',VALUE:'private-esn'},{CNAME:'constructor',VALUE:'1.2.3'}]};
    throw Error('Unexpected operation');
  };
  const report=await tool.inspect({state:filename},{transport,now:()=>new Date('2026-11-06T00:00:00Z')});
  assert.deepEqual(calls.map(x=>x.operation),['info','currentApp','versions','tvInfo']);
  assert.equal(calls[0].token,undefined);assert.ok(calls.slice(1).every(x=>x.tv===TV&&x.token===TOKEN));
  assert.equal(report.target.model,'V405-H9');assert.equal(report.target.firmware,'1.720.9.1-1');assert.equal(report.target.platformIdentifier,'mtk5691');assert.equal(report.target.platformIsHardwareVerification,false);
  assert.deepEqual(report.currentApp,{id:'17',namespace:4,publicGithubPagesUrl:true});assert.equal(report.componentVersions.conjure,'128.1.9');assert.equal(report.componentVersions.cast,'1.40.169511');
  assert.equal(report.requestCount,4);assert.equal(Object.hasOwn(report,'network'),false);assert.ok(Object.values(report.verification).every(x=>x==='unverified'));
  assert.doesNotMatch(JSON.stringify(report),/192\.168|auth-secret|synthetic-|private-|11:22:33|11-22-33|MESSAGE|SERIAL_NUMBER|AUTH_TOKEN|function Object/);
  assert.deepEqual(await fs.readFile(filename),before);assert.equal((await fs.stat(filename)).mtimeMs,stat.mtimeMs);assert.deepEqual(await fs.readdir(dir),['paired.json']);
});

test('legacy TV information is read only after a definite missing endpoint, never after other failures',async t=>{
  const {filename}=await fixture(t);
  for(const code of ['URI_NOT_FOUND','HTTP404','REQUIRES_PAIRING','timeout','invalid_response','redirect_refused']){
    const calls=[];
    const report=await tool.inspect({state:filename},{transport:async(tv,operation)=>{
      calls.push(operation);if(operation==='info')return metadata();
      if(operation==='tvInfo'){
        if(code==='URI_NOT_FOUND'||code==='REQUIRES_PAIRING')return {STATUS:{RESULT:code,DETAIL:TOKEN}};
        throw Object.assign(Error(TOKEN),{inspectionCode:code==='HTTP404'?'unavailable':code});
      }
      if(operation==='tvInfoLegacy')return success({CONJURE:'128.1.9'});
      return success({});
    }});
    const fallback=code==='URI_NOT_FOUND'||code==='HTTP404';
    assert.equal(calls.includes('tvInfoLegacy'),fallback);assert.equal(report.requestCount,fallback?5:4);
    assert.equal(report.checks.tvInformationSource,fallback?'legacy':'primary');
    assert.equal(JSON.stringify(report).includes(TOKEN),false);
  }
});

test('unpaired, invalid, public-target and changed-model states stop before authenticated reads',async t=>{
  for(const change of [{phase:'awaiting_pin'},{token:undefined},{token:'bad\nheader'},{tv:'8.8.8.8'},{metadata:{model:'V405-H19',firmware:{system:'1.720.9.1-1'}}}]){
    const {filename}=await fixture(t,change);let calls=0;
    for(const network of [undefined,true])await assert.rejects(()=>tool.inspect({state:filename,network},{transport:async()=>{calls++;return metadata();}}));assert.equal(calls,0);
  }
  const {filename}=await fixture(t);
  for(const response of [metadata('M657-G0'),metadata('V405-H19'),metadata('V405-H9','1.720.9.1-2'),{STATUS:{RESULT:'FAILURE',DETAIL:TOKEN}}]){
    for(const network of [undefined,true]){
      const calls=[];
      await assert.rejects(()=>tool.inspect({state:filename,network},{transport:async(tv,operation,token)=>{calls.push({operation,token});return response;}}));
      assert.deepEqual(calls,[{operation:'info',token:undefined}]);
    }
  }
});

test('transport sends bodyless HTTPS GETs to one private target and refuses redirects or arbitrary routes',async()=>{
  const fake=fakeHttp(({receive,res})=>emitJson(receive,res,success({}))),transport=tool.createTransport({request:fake.request});
  for(const route of ['info','currentApp','versions','tvInfo','tvInfoLegacy','networkStatusStatic','networkStatusDynamic','networkType'])await transport(TV,route,route==='info'?undefined:TOKEN);
  assert.deepEqual(fake.calls.map(x=>x.options.path),['/state/device/deviceinfo','/app/current','/system/versions','/menu_native/dynamic/tv_settings/admin_and_privacy/system_information/tv_information','/menu_native/dynamic/tv_settings/system/system_information/tv_information','/menu_native/static/tv_settings/network/connection_status','/menu_native/dynamic/tv_settings/network/connection_status','/menu_native/dynamic/tv_settings/network/connection_type']);
  assert.ok(fake.calls.every(x=>x.options.hostname===TV&&x.options.port===7345&&x.options.protocol==='https:'&&x.options.method==='GET'&&x.body===undefined));
  assert.equal(fake.calls[0].options.headers.AUTH,undefined);assert.ok(fake.calls.slice(1).every(x=>x.options.headers.AUTH===TOKEN));
  for(const [tv,route,token]of [['8.8.8.8','info'],['localhost','info'],[TV,'/reboot',TOKEN],[TV,'launch',TOKEN],[TV,'info',TOKEN],[TV,'currentApp'],[TV,'networkType'],[TV,'/menu_native/dynamic/tv_settings/network/start_ap_search',TOKEN]])await assert.rejects(()=>transport(tv,route,token));
  assert.equal(fake.calls.length,8);
  const redirect=fakeHttp(({receive,res})=>{res.statusCode=302;res.headers.location='https://external.invalid/'+TOKEN;receive(res);});
  await assert.rejects(()=>tool.createTransport({request:redirect.request})(TV,'currentApp',TOKEN),e=>e.inspectionCode==='redirect_refused');assert.equal(redirect.calls.length,1);
});

test('response and deadline limits terminate requests without exposing content',async()=>{
  const boundary=fakeHttp(({receive,res})=>{const raw=JSON.stringify(success({}));receive(res);res.emit('data',Buffer.from(raw));res.emit('data',Buffer.alloc(tool.MAX_BODY_BYTES-Buffer.byteLength(raw),0x20));res.emit('end');});
  assert.equal((await tool.createTransport({request:boundary.request})(TV,'versions',TOKEN)).STATUS.RESULT,'SUCCESS');
  for(const advertised of [true,false]){
    const fake=fakeHttp(({receive,res})=>{
      if(advertised)res.headers['content-length']=String(tool.MAX_BODY_BYTES+1);
      receive(res);if(!advertised){res.emit('data',Buffer.alloc(tool.MAX_BODY_BYTES));res.emit('data',Buffer.from(TOKEN));}
    });
    await assert.rejects(()=>tool.createTransport({request:fake.request})(TV,advertised?'networkStatusStatic':'currentApp',TOKEN),e=>e.inspectionCode==='response_too_large');assert.equal(fake.calls[0].req.destroyed,true);
  }
  let scheduled,cleared=false;const stalled=fakeHttp(()=>{});
  const transport=tool.createTransport({request:stalled.request,setTimer:(callback,delay)=>{scheduled=delay;queueMicrotask(callback);return 7;},clearTimer:id=>{assert.equal(id,7);cleared=true;}});
  await assert.rejects(()=>transport(TV,'networkType',TOKEN),e=>e.inspectionCode==='timeout');assert.equal(scheduled,3000);assert.equal(cleared,true);assert.equal(stalled.calls[0].req.destroyed,true);assert.equal(tool.MAX_BODY_BYTES,131072);
  assert.doesNotMatch(tool.safeErrorMessage(Error('AUTH '+TOKEN+' '+TV)),/auth-secret|192\.168|AUTH/);
});

test('malformed and rejected responses produce bounded statuses and never leak server details',async()=>{
  for(const sample of [{status:404,code:'unavailable'},{status:401,code:'authentication_required'},{status:200,raw:TOKEN,code:'invalid_response'},{status:200,data:{STATUS:{RESULT:'URI_NOT_FOUND',DETAIL:TOKEN}},code:'unavailable'},{status:200,data:{STATUS:{RESULT:'REQUIRES_PAIRING',DETAIL:TOKEN}},code:'authentication_required'}]){
    const fake=fakeHttp(({receive,res})=>{res.statusCode=sample.status;receive(res);if(sample.status===200){res.emit('data',Buffer.from(sample.raw||JSON.stringify(sample.data)));res.emit('end');}});
    await assert.rejects(()=>tool.createTransport({request:fake.request})(TV,'versions',TOKEN),e=>{assert.equal(e.inspectionCode,sample.code);assert.equal(tool.safeErrorMessage(e).includes(TOKEN),false);return true;});
  }
});

test('network opt-in adds exactly three passive reads with the same target and credentials, without changing state',async t=>{
  const {dir,filename}=await fixture(t),before=await fs.readFile(filename),stat=await fs.stat(filename);
  const responses=new Map([
    ['/state/device/deviceinfo',metadata()],['/app/current',success({})],['/system/versions',success({})],
    ['/menu_native/dynamic/tv_settings/admin_and_privacy/system_information/tv_information',success({})],
    ['/menu_native/static/tv_settings/network/connection_status',{STATUS:{RESULT:'SUCCESS',DETAIL:TOKEN},ITEMS:[{ELEMENTS:['Connected','Disconnected'],SSID:'private-network'}]}],
    ['/menu_native/dynamic/tv_settings/network/connection_status',{STATUS:{RESULT:'SUCCESS'},ITEMS:[{VALUE:'Connected'}]}],
    ['/menu_native/dynamic/tv_settings/network/connection_type',{STATUS:{RESULT:'SUCCESS'},ITEMS:[{VALUE:'WiFi',IP_ADDRESS:TV}]}]
  ]);
  const fake=fakeHttp(({options,receive,res})=>{assert.ok(responses.has(options.path));emitJson(receive,res,responses.get(options.path));});
  const report=await tool.inspect({state:filename,network:true},{transport:tool.createTransport({request:fake.request})});
  assert.deepEqual(fake.calls.map(call=>call.options.path),[...responses.keys()]);assert.equal(report.requestCount,7);
  assert.equal(fake.calls[0].options.headers.AUTH,undefined);
  assert.ok(fake.calls.slice(1).every(call=>call.options.headers.AUTH===TOKEN));
  assert.ok(fake.calls.every(call=>call.options.hostname===TV&&call.options.port===7345&&call.options.protocol==='https:'&&call.options.method==='GET'&&call.body===undefined));
  assert.equal(report.network.reportedConnected,true);assert.equal(report.network.connectionType,'Wi-Fi');
  assert.ok(Object.values(report.network.checks).every(status=>status==='ok'));
  assert.match(report.network.note,/does not verify DNS, TLS, Internet access/);
  assert.doesNotMatch(JSON.stringify(report),/auth-secret|192\.168|private-network|ELEMENTS|SSID|IP_ADDRESS|DETAIL/);
  assert.deepEqual(await fs.readFile(filename),before);assert.equal((await fs.stat(filename)).mtimeMs,stat.mtimeMs);assert.deepEqual(await fs.readdir(dir),['paired.json']);
});

test('network enums are bounded and missing, malformed, or failed readings stay unknown without leaking details',async t=>{
  const {filename}=await fixture(t),items=value=>({STATUS:{RESULT:'SUCCESS'},ITEMS:[value]});
  const base={elements:['Connected','Disconnected'],value:'Connected',type:'Ethernet',connected:true,connectionType:'Ethernet'};
  const cases=[
    {...base,value:'Disconnected',connected:false},
    {...base,elements:['Conectado','Desconectado'],value:'Desconectado',type:'Wireless',connected:false,connectionType:'wireless'},
    {...base,elements:[true,false],value:false,type:'Wired',connected:false,connectionType:'wired'},
    {...base,type:'wi-fi',connectionType:'Wi-Fi'},
    {...base,elements:undefined,connected:null},
    {...base,elements:[],connected:null},
    {...base,elements:['Connected',false],connected:null},
    {...base,elements:Array(17).fill('Connected'),connected:null},
    {...base,elements:['x'.repeat(65)],value:'x'.repeat(65),connected:null},
    {...base,value:{state:'Connected'},connected:null},
    {...base,value:'unexpected-state',connected:null},
    {...base,value:undefined,connected:null},
    {...base,type:TOKEN+' '+TV,connectionType:'unknown'},
    {...base,staticStatus:'URI_NOT_FOUND',connected:null,expectedStatus:'unavailable'},
    {...base,dynamicStatus:'REQUIRES_PAIRING',connected:null,expectedStatus:'authentication_required'},
    {...base,dynamicStatus:TOKEN,connected:null,expectedStatus:'api_error'},
    {...base,timeout:true,connected:null,expectedStatus:'timeout'}
  ];
  for(const sample of cases){
    const calls=[];
    const report=await tool.inspect({state:filename,network:true},{transport:async(tv,operation,token)=>{
      calls.push({tv,operation,token});if(operation==='info')return metadata();
      if(operation==='networkStatusStatic')return sample.staticStatus?{STATUS:{RESULT:sample.staticStatus,DETAIL:TOKEN}}:items({ELEMENTS:sample.elements});
      if(operation==='networkStatusDynamic'){
        if(sample.timeout)throw Object.assign(Error(TOKEN+' '+TV),{inspectionCode:'timeout'});
        return sample.dynamicStatus?{STATUS:{RESULT:sample.dynamicStatus,DETAIL:TOKEN}}:items({VALUE:sample.value});
      }
      if(operation==='networkType')return items({VALUE:sample.type});
      return success({});
    }});
    assert.equal(report.network.reportedConnected,sample.connected);assert.equal(report.network.connectionType,sample.connectionType);assert.equal(report.requestCount,7);
    if(sample.expectedStatus)assert.ok(Object.values(report.network.checks).includes(sample.expectedStatus));
    assert.ok(calls.slice(1).every(call=>call.tv===TV&&call.token===TOKEN));
    assert.doesNotMatch(JSON.stringify(report),/auth-secret|192\.168|unexpected-state|ELEMENTS|DETAIL/);
  }
  let calls=0;
  await assert.rejects(()=>tool.inspect({state:filename,network:'true'},{transport:async()=>{calls++;return metadata();}}));assert.equal(calls,0);
});
