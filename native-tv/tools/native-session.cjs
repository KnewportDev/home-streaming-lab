#!/usr/bin/env node
'use strict';
// PIN pairing and a temporary Conjure app17 test; no root or system changes.
// Protocol: https://vizio-pm.s3-us-west-1.amazonaws.com/conjure-launcher.html
const fs=require('node:fs/promises'), C=require('node:fs').constants;
const path=require('node:path'), crypto=require('node:crypto');
const https=require('node:https'), http=require('node:http');
const {isPrivateIPv4,normalizeMetadata}=require('./inspect-tv.cjs');
const FIRMWARE='1.720.9.1-1', MODELS=new Set(['V405-H9','V405-H19']);
const ROUTES=Object.freeze({info:['GET','/state/device/deviceinfo'],start:['PUT','/pairing/start'],pair:['PUT','/pairing/pair'],launch:['PUT','/app/launch']});
const ASSETS={'index.html':'text/html; charset=utf-8','home.css':'text/css; charset=utf-8','home.js':'text/javascript; charset=utf-8','config.json':'application/json; charset=utf-8'};
const problem=message=>Object.assign(Error(message),{safeForDisplay:true});
const fail=message=>{throw problem(message);};
const HELP='Native TV session (Node.js24; no dependencies)\n\n'+
  '  node tools/native-session.cjs pair-start --tv 192.168.1.50 --state ABSOLUTE_PRIVATE_FILE\n'+
  '  node tools/native-session.cjs pair-retry --state ABSOLUTE_PRIVATE_FILE\n'+
  '  node tools/native-session.cjs pair-restart --state ABSOLUTE_PRIVATE_FILE\n'+
  '  node tools/native-session.cjs pair-code --state ABSOLUTE_PRIVATE_FILE --pin FOUR_DIGIT_PIN\n'+
  '  node tools/native-session.cjs serve-launch --state ABSOLUTE_PRIVATE_FILE --bind 192.168.1.20 --port 8137 --home HOME_DIRECTORY\n\n'+
  'State parent directory must exist; pair-start exclusively creates a new private file.\n'+
  'pair-restart preserves a private recovery snapshot, waits 30 seconds, and requests one fresh PIN.\n'+
  'Home requires index.html, home.css, home.js, and config.json.\n'+
  'Each action verifies V405-H9/H19 and firmware1.720.9.1-1.\n'+
  'A launch acceptance is separate from the TV JavaScript readiness callback.\n'+
  'Keep serve-launch running; Ctrl+C stops only its local server.\n';
function privateIp(ip){if(!isPrivateIPv4(ip))fail('A private IPv4 address is required.');return ip;}

function parseArgs(argv){
  if(argv.includes('--help')||argv.includes('-h'))return {command:'help'};
  const [command,...args]=argv, out={command};
  const allowed={ 'pair-start':['tv','state'], 'pair-retry':['state'], 'pair-restart':['state'], 'pair-code':['state','pin'], 'serve-launch':['state','bind','port','home'] };
  if(!allowed[command])fail('Use pair-start, pair-retry, pair-restart, pair-code, or serve-launch.');
  for(let i=0;i<args.length;i+=2){const key=args[i]?.replace(/^--/,'');
    if(!args[i]?.startsWith('--')||!allowed[command].includes(key)||out[key]!==undefined||!args[i+1]||args[i+1].startsWith('--'))fail('Invalid or duplicate command option.');
    out[key]=args[i+1];
  }
  for(const key of allowed[command])if(key!=='port'&&!out[key])fail('A required command option is missing.');
  if(!path.isAbsolute(out.state))fail('--state must be an absolute private file path.');
  if(out.tv)privateIp(out.tv);if(out.bind)privateIp(out.bind);
  if(command==='pair-code'&&!/^\d{4}$/.test(out.pin))fail('The PIN must contain exactly four digits.');
  if(command==='serve-launch'){out.port=Number(out.port||8137);if(!Number.isInteger(out.port)||out.port<1024||out.port>65535)fail('Use a port from1024 to65535.');}
  return out;
}

async function checkedStatePath(filename){
  if(!path.isAbsolute(filename))fail('State path must be absolute.');
  const parent=path.dirname(filename), actual=await fs.realpath(parent);
  const comparable=s=>process.platform==='win32'?s.toLowerCase():s;
  if(comparable(actual)!==comparable(path.resolve(parent)))fail('State directories must not use symbolic links.');
  try{const stat=await fs.lstat(filename);if(!stat.isFile()||stat.isSymbolicLink())fail('State must be a regular file, never a symbolic link.');return stat;}
  catch(e){if(e.code!=='ENOENT')throw e;return null;}
}
async function writeState(filename,state,exclusive=false){
  const serialized=JSON.stringify(state),before=await checkedStatePath(filename);
  if(!exclusive&&!before)fail('The existing state file is missing.');
  // Windows rejects O_WRONLY|O_TRUNC without O_CREAT. Open an existing file
  // without truncation, verify its identity, then truncate via its handle.
  const handle=await fs.open(filename,exclusive?'wx':'r+',0o600);
  try{
    const opened=await handle.stat();if(!opened.isFile())fail('Invalid state file.');
    if(!exclusive){
      const after=await checkedStatePath(filename);
      if(!after||before.dev!==opened.dev||before.ino!==opened.ino||after.dev!==opened.dev||after.ino!==opened.ino)fail('State file changed during the update; it was not overwritten.');
    }
    await handle.chmod(0o600);if(!exclusive)await handle.truncate(0);
    await handle.writeFile(serialized);await handle.sync();
  }finally{await handle.close();}
}
async function readState(filename){
  await checkedStatePath(filename);
  const handle=await fs.open(filename,C.O_RDONLY|(C.O_NOFOLLOW||0));
  try{const stat=await handle.stat();if(!stat.isFile()||stat.size>32768)fail('Invalid state file.');
    if(process.platform!=='win32'&&(stat.mode&0o077))fail('State file permissions must be600.');
    const state=JSON.parse(await handle.readFile('utf8'));privateIp(state.tv);
    if(state.schemaVersion!==1||!MODELS.has(state.metadata?.model)||state.metadata?.firmware?.system!==FIRMWARE||typeof state.deviceId!=='string')fail('State does not match the supported device profile.');
    return state;
  }finally{await handle.close();}
}

function validateTvResponse(data,operation){
  const result=typeof data?.STATUS?.RESULT==='string'?data.STATUS.RESULT.toUpperCase():'';
  if(result==='SUCCESS')return data;
  const descriptions={BLOCKED:operation==='start'?'pairing is already in progress':'another operation is in progress',BUSY:'the TV is busy',REQUIRES_PAIRING:'pairing is required',INVALID_PARAMETER:'the TV rejected a request parameter',MAX_CHALLENGES_EXCEEDED:'too many pairing attempts',PAIRING_DENIED:'the PIN was not accepted',VALUE_OUT_OF_RANGE:'a value was outside the accepted range',CHALLENGE_INCORRECT:'the pairing challenge was not accepted',FAILURE:'the operation failed',URI_NOT_FOUND:'the endpoint is unavailable',ABORTED:'the operation was aborted'};
  if(Object.hasOwn(descriptions,result)){const error=problem(`TV reported ${result}: ${descriptions[result]}.`);error.tvStatus=result;throw error;}
  fail('TV returned an unrecognized or missing result status.');
}
function request(tv,operation,body,token){
  privateIp(tv);if(!Object.hasOwn(ROUTES,operation))fail('Unsupported TV operation.');
  if((operation==='start'||operation==='pair')&&token)fail('Pairing requests cannot send an auth header.');
  const [method,url]=ROUTES[operation], bytes=body?Buffer.from(JSON.stringify(body)):null;
  return new Promise((resolve,reject)=>{
    let done=false,timer;const finish=(err,data)=>{if(done)return;done=true;clearTimeout(timer);err?reject(err):resolve(data);};
    const headers={'Content-Type':'application/json','Accept':'application/json','Connection':'close'};
    if(bytes)headers['Content-Length']=bytes.length;if(token)headers.AUTH=token;
    const req=https.request({hostname:tv,port:7345,path:url,method,headers,agent:false,rejectUnauthorized:false},res=>{
      if(res.statusCode!==200){finish(problem(`TV request was rejected (HTTP ${Number(res.statusCode)||0}).`));res.destroy();return;}
      const chunks=[];let size=0;
      res.on('data',chunk=>{size+=chunk.length;if(size>131072){finish(problem('TV response exceeded its limit.'));req.destroy();}else chunks.push(chunk);});
      res.on('error',()=>finish(problem('TV response failed.')));
      res.on('end',()=>{if(done)return;let data;try{data=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{finish(problem('TV returned invalid JSON.'));return;}try{finish(null,validateTvResponse(data,operation));}catch(error){finish(error);}});
    });
    req.on('error',()=>finish(problem('TV connection failed.')));
    timer=setTimeout(()=>{finish(problem('TV request timed out.'));req.destroy();},3000);req.end(bytes);
  });
}
async function verify(tv,previous,transport=request){
  const data=await transport(tv,'info');
  const metadata=normalizeMetadata(tv,{smartcast:{status:'ok',httpStatus:200,data}});
  if(metadata.identity!=='vizio'||!MODELS.has(metadata.model)||metadata.firmware.system!==FIRMWARE)fail('TV model or firmware does not match the verified V405-H9/H19 profile.');
  if(previous&&(metadata.model!==previous.model||metadata.firmware.system!==previous.firmware.system))fail('TV identity or firmware changed since pairing began.');
  return metadata;
}

async function beginPairing(state,filename,transport,report){
  const response=await transport(state.tv,'start',{DEVICE_ID:state.deviceId,DEVICE_NAME:'Native TV Session'});
  const item=response?.ITEM,challenge={};
  const token=item?.PAIRING_REQ_TOKEN,type=item?.CHALLENGE_TYPE;
  const validToken=(typeof token==='string'&&token.length>0&&token.length<=4096)||(Number.isSafeInteger(token)&&token>=0);
  const validType=Number.isInteger(type)&&type>=0&&type<=255;
  if(validToken)challenge.requestToken=token;if(validType)challenge.type=type;
  // A successful start may already have displayed a PIN. Preserve any usable
  // challenge fields privately, even if its response is incomplete, and never
  // silently start a new challenge over that uncertain state.
  state.challenge=challenge;
  state.phase=validToken&&validType?'awaiting_pin':'pairing_response_incomplete';
  if(state.phase==='awaiting_pin')delete state.restartPending;
  await writeState(filename,state);
  if(state.phase!=='awaiting_pin')fail('TV pairing response was incomplete. Available challenge fields were preserved privately; do not start another pairing over this state.');
  report({event:'pairing_started',model:state.metadata.model,firmware:state.metadata.firmware.system,instruction:'Read the four-digit PIN on the TV and use pair-code.'});
}

function classifyRoute(url,nonce){
  if(typeof url!=='string'||url.length>512||url.includes('%')||url.includes('\\'))return null;
  const prefix='/'+nonce+'/';if(!url.startsWith(prefix))return null;
  const suffix=url.slice(prefix.length);
  if(suffix==='telemetry?event=ready')return {kind:'telemetry'};
  if(Object.hasOwn(ASSETS,suffix))return {kind:'asset',name:suffix};
  return null;
}
async function loadAssets(home){
  const dir=path.resolve(home);if(await fs.realpath(dir)!==dir)fail('Home directory must not be a symbolic link.');
  const files={};
  for(const name of Object.keys(ASSETS)){
    const filename=path.join(dir,name),stat=await fs.lstat(filename);
    if(!stat.isFile()||stat.isSymbolicLink()||stat.size>1048576)fail('Home assets must be regular files under1MiB.');
    files[name]=await fs.readFile(filename);
  }
  JSON.parse(files['config.json'].toString('utf8'));
  // Same-origin callback runs in the TV page. No external service, cookies or
  // identifiers are read. Loading HTML alone is not treated as JS execution.
  files['home.js']=Buffer.concat([files['home.js'],Buffer.from('\n;(function(){function ready(){var x=new XMLHttpRequest();x.open("GET",location.pathname.replace(/[^/]*$/,"")+"telemetry?event=ready",true);x.send();}if(document.readyState==="complete")ready();else window.addEventListener("load",ready);})();\n')]);
  return files;
}
function makeHandler({tv,bind,nonce,files,onReady}){
  let ready=false;const peers=new Set([tv,bind,'127.0.0.1','::1']);
  return (req,res)=>{
    const peer=req.socket.remoteAddress?.replace(/^::ffff:/,'');
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
    if(!peers.has(peer)){res.writeHead(403);res.end();return;}
    if(req.method!=='GET'){res.writeHead(405);res.end();return;}
    const route=classifyRoute(req.url,nonce);
    if(!route){res.writeHead(404);res.end();return;}
    if(route.kind==='telemetry'){
      if(peer===tv&&!ready){ready=true;onReady();}
      res.writeHead(204);res.end();return;
    }
    res.setHeader('Content-Type',ASSETS[route.name]);res.writeHead(200);res.end(files[route.name]);
  };
}

async function execute(options,{transport=request,createServer=http.createServer,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),report=x=>process.stdout.write(JSON.stringify(x)+'\n')}={}){
  if(options.command==='pair-start'){
    privateIp(options.tv);
    const metadata=await verify(options.tv,null,transport);
    const state={schemaVersion:1,tv:options.tv,metadata,deviceId:crypto.randomUUID(),phase:'starting'};
    await writeState(options.state,state,true);
    await beginPairing(state,options.state,transport,report);return;
  }
  const state=await readState(options.state);
  if(options.command==='pair-retry'){
    if(state.phase!=='starting'||Object.hasOwn(state,'token')||Object.hasOwn(state,'challenge')||Object.hasOwn(state,'restartPending'))fail('Retry is only available for an untouched starting state without a token or challenge. Existing pairing state was preserved.');
    await verify(state.tv,state.metadata,transport);
    await beginPairing(state,options.state,transport,report);return;
  }
  if(options.command==='pair-restart'){
    const challenge=state.challenge,token=challenge?.requestToken,type=challenge?.type;
    const validToken=(typeof token==='string'&&token.length>0&&token.length<=4096)||(Number.isSafeInteger(token)&&token>=0);
    const validType=Number.isInteger(type)&&type>=0&&type<=255;
    if(state.phase!=='awaiting_pin'||Object.hasOwn(state,'token')||Object.hasOwn(state,'restartPending')||!validToken||!validType)fail('Restart requires this client\'s complete pending challenge without a pairing credential. Existing pairing state was preserved.');
    await verify(state.tv,state.metadata,transport);
    // VIZIO's launcher startOver() waits 30 seconds, then returns to ordinary
    // pairing/start with the same client ID. This target rejects cancellation.
    // https://vizio-pm.s3-us-west-1.amazonaws.com/conjure-launcher.html
    const previous={...state},snapshot=options.state+'.recovery-'+crypto.randomUUID()+'.json';
    await writeState(snapshot,previous,true);
    state.phase='restart_waiting';state.restartPending=true;
    // Keep the previous challenge privately and persist the guard before the
    // wait or network action. A lost response cannot cause an automatic replay.
    await writeState(options.state,state);
    report({event:'pairing_restart_wait',seconds:30,instruction:'Waiting 30 seconds before one fresh pairing request.'});
    try{
      await wait(30000);
      state.phase='starting';await writeState(options.state,state);
      await beginPairing(state,options.state,transport,report);
    }
    catch(error){
      if(error.tvStatus==='BLOCKED'&&state.phase==='starting'){
        await writeState(options.state,previous);
        const blocked=problem('TV reported BLOCKED: pairing is already in progress. Press Back on the TV remote to dismiss its pairing screen, then run pair-restart once.');
        blocked.tvStatus='BLOCKED';throw blocked;
      }
      if(state.phase==='starting'||state.phase==='restart_waiting'){state.phase='restart_uncertain';await writeState(options.state,state);}
      throw error;
    }
    return;
  }
  await verify(state.tv,state.metadata,transport);
  if(options.command==='pair-code'){
    if(!/^\d{4}$/.test(options.pin)||state.phase!=='awaiting_pin'||!state.challenge)fail('A pending pairing challenge and four-digit PIN are required.');
    const r=await transport(state.tv,'pair',{DEVICE_ID:state.deviceId,CHALLENGE_TYPE:state.challenge.type,PAIRING_REQ_TOKEN:state.challenge.requestToken,RESPONSE_VALUE:options.pin});
    if(typeof r.ITEM?.AUTH_TOKEN!=='string'||!r.ITEM.AUTH_TOKEN||r.ITEM.AUTH_TOKEN.length>4096)fail('TV did not return a usable pairing credential.');
    state.token=r.ITEM.AUTH_TOKEN;state.phase='paired';delete state.challenge;
    await writeState(options.state,state);report({event:'paired',model:state.metadata.model,firmware:state.metadata.firmware.system});return;
  }
  if(options.command!=='serve-launch'||state.phase!=='paired'||typeof state.token!=='string')fail('Complete PIN pairing before launching.');
  privateIp(options.bind);if(options.bind===state.tv)fail('Bind must be the PC interface, not the TV.');
  const port=Number(options.port||8137);if(!Number.isInteger(port)||port<1024||port>65535)fail('Invalid listening port.');
  const files=await loadAssets(options.home),nonce=crypto.randomBytes(24).toString('hex');
  let tvReady=false;
  const server=createServer(makeHandler({tv:state.tv,bind:options.bind,nonce,files,onReady:()=>{tvReady=true;report({event:'tv_javascript_ready',nativeAdapter:'not_tested',root:'not_tested'});}}));
  server.headersTimeout=5000;server.requestTimeout=5000;server.maxHeadersCount=32;
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,options.bind,()=>{server.removeListener('error',reject);resolve();});});
  const close=()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections?.();});
  try{
    const url=`http://${options.bind}:${port}/${nonce}/index.html`;
    await transport(state.tv,'launch',{VALUE:{NAME_SPACE:4,APP_ID:'17',MESSAGE:url}},state.token);
    report({event:'launch_accepted',ready:tvReady,instruction:'Keep this process open for the TV JavaScript callback; Ctrl+C stops its server.'});
  }catch(e){await close();throw e;}
  const stop=()=>{close().then(()=>report({event:'server_stopped'}));};process.once('SIGINT',stop);
  return {server,close:async()=>{process.removeListener('SIGINT',stop);await close();}};
}
function safeErrorMessage(error){
  if(error?.safeForDisplay===true)return error.message;
  const messages={ENOENT:'A required state directory, state file, or home asset is missing.',EEXIST:'The state file already exists. Use pair-code or choose a new state path.',EACCES:'File or network permission was denied.',EPERM:'Permission was denied.',EADDRINUSE:'The local server port is already in use.',EADDRNOTAVAIL:'The bind address is not an interface on this PC.'};
  if(messages[error?.code])return messages[error.code];
  if(error instanceof SyntaxError)return 'State or config.json contains invalid JSON.';
  return 'Native session failed. Use --help and check the TV connection and local files.';
}
async function main(argv=process.argv.slice(2)){const options=parseArgs(argv);if(options.command==='help'){process.stdout.write(HELP);return;}return execute(options);}
module.exports={parseArgs,verify,validateTvResponse,classifyRoute,makeHandler,loadAssets,writeState,readState,execute,safeErrorMessage,main};
if(require.main===module)main().catch(error=>{process.stderr.write(safeErrorMessage(error)+'\n');process.exitCode=1;});
