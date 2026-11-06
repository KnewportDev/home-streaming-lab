#!/usr/bin/env node
'use strict';

// Informational routes only. Some SmartCast GET routes trigger actions; never
// discover or recursively follow menu paths here.
// Primary client source: https://github.com/raman325/vizaio/blob/main/src/vizaio/endpoints.py
// Passive network reads: extracted vendor SDK getIsNetworkConnected/getNetworkConnectionType,
// https://github.com/vindeckyy/smartcast-backdoor/blob/aea6dec77bf3c6613c46b2ef45de5444e5f3dccc/extracted/companion-lib.js
// Lg reads static ITEMS[0].ELEMENTS[0] and dynamic ITEMS[0].VALUE; Vg compares
// them strictly. Um/qm read connection_type. These do not test Internet access.
const https=require('node:https'),path=require('node:path');
const {readState,verify,validateTvResponse}=require('./native-session.cjs');
const {isPrivateIPv4}=require('./inspect-tv.cjs');
const TIMEOUT_MS=3000,MAX_BODY_BYTES=128*1024;
const ROUTES=Object.freeze({
  info:'/state/device/deviceinfo',
  currentApp:'/app/current',
  versions:'/system/versions',
  tvInfo:'/menu_native/dynamic/tv_settings/admin_and_privacy/system_information/tv_information',
  tvInfoLegacy:'/menu_native/dynamic/tv_settings/system/system_information/tv_information',
  networkStatusStatic:'/menu_native/static/tv_settings/network/connection_status',
  networkStatusDynamic:'/menu_native/dynamic/tv_settings/network/connection_status',
  networkType:'/menu_native/dynamic/tv_settings/network/connection_type'
});
const ERRORS=Object.freeze({
  arguments:'Use --state with one absolute path to an existing private paired-state file, optionally with --network once.',
  state:'A valid private paired state for V405-H9 firmware 1.720.9.1-1 is required.',
  target:'The TV could not be verified against the paired model and firmware. No authenticated inspection was performed.',
  route:'Only the fixed informational TV routes are supported.',
  unavailable:'The informational endpoint is unavailable.',
  authentication_required:'The TV requires valid existing pairing credentials.',
  redirect_refused:'The TV returned a redirect; it was not followed.',
  http_error:'The TV rejected the informational request.',
  api_error:'The TV did not accept the informational request.',
  invalid_response:'The TV returned an invalid informational response.',
  response_too_large:'The TV response exceeded the inspection limit.',
  timeout:'The informational TV request timed out.',
  unreachable:'The informational TV request could not be completed.'
});
const error=code=>Object.assign(new Error(ERRORS[code]||'Native platform inspection failed.'),{inspectionCode:code});
const tokenValid=value=>typeof value==='string'&&value.length>0&&value.length<=4096&&!/[^\x21-\x7e]/.test(value);
function safeErrorMessage(value){return ERRORS[value?.inspectionCode]||'Native platform inspection failed. Check the existing private state and TV connection.';}
function parseArgs(argv){
  if(argv.length===1&&(argv[0]==='--help'||argv[0]==='-h'))return {help:true};
  const options={};
  for(let i=0;i<argv.length;i++){
    if(argv[i]==='--state'&&!Object.hasOwn(options,'state')&&typeof argv[i+1]==='string'&&path.isAbsolute(argv[i+1]))options.state=argv[++i];
    else if(argv[i]==='--network'&&!Object.hasOwn(options,'network'))options.network=true;
    else throw error('arguments');
  }
  if(!options.state)throw error('arguments');
  return options;
}
function checkedResponse(data){
  try{return validateTvResponse(data,'inspect');}
  catch{
    const status=typeof data?.STATUS?.RESULT==='string'?data.STATUS.RESULT.toUpperCase():'';
    if(status==='URI_NOT_FOUND')throw error('unavailable');
    if(['REQUIRES_PAIRING','INVALID_AUTH_TOKEN','UNAUTHORIZED','FORBIDDEN'].includes(status))throw error('authentication_required');
    throw error('api_error');
  }
}
function createTransport({request=https.request,setTimer=setTimeout,clearTimer=clearTimeout}={}){
  return async function transport(tv,operation,token){
    if(!isPrivateIPv4(tv)||!Object.hasOwn(ROUTES,operation))throw error('route');
    if(operation==='info'?token!==undefined:!tokenValid(token))throw error('state');
    return new Promise((resolve,reject)=>{
      let finished=false,timer;
      const finish=(problem,data)=>{if(finished)return;finished=true;if(timer!==undefined)clearTimer(timer);problem?reject(problem):resolve(data);};
      const headers={Accept:'application/json',Connection:'close'};
      if(operation!=='info')headers.AUTH=token;
      let req;
      try{
        req=request({protocol:'https:',hostname:tv,port:7345,path:ROUTES[operation],method:'GET',headers,agent:false,rejectUnauthorized:false},res=>{
          const status=res.statusCode;
          if(status!==200){
            finish(error(status===404?'unavailable':status===401||status===403?'authentication_required':status>=300&&status<400?'redirect_refused':'http_error'));
            res.destroy();return;
          }
          if(Number(res.headers?.['content-length'])>MAX_BODY_BYTES){finish(error('response_too_large'));res.destroy();req.destroy();return;}
          const chunks=[];let size=0;
          res.on('data',chunk=>{
            if(finished)return;
            const bytes=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);size+=bytes.length;
            if(size>MAX_BODY_BYTES){finish(error('response_too_large'));res.destroy();req.destroy();return;}
            chunks.push(bytes);
          });
          res.on('error',()=>finish(error('unreachable')));
          res.on('aborted',()=>finish(error('unreachable')));
          res.on('end',()=>{
            if(finished)return;
            let data;try{data=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{finish(error('invalid_response'));return;}
            try{finish(null,checkedResponse(data));}catch(problem){finish(problem);}
          });
        });
        req.on('error',()=>finish(error('unreachable')));
        timer=setTimer(()=>{finish(error('timeout'));req.destroy();},TIMEOUT_MS);
        req.end();
      }catch{finish(error('unreachable'));if(req)req.destroy();}
    });
  };
}

const COMPONENTS=Object.freeze({
  api:'smartcastApi',apiversion:'smartcastApi',smartcastapi:'smartcastApi',
  vizios:'viziOs',home:'home',conjure:'conjure',scpl:'scpl',cobalt:'cobalt',
  viziosdk:'vizioSdk',viziondk:'vizioNdk',chromiumversion:'chromium',
  castversion:'cast',castcore:'cast'
});
const keyName=value=>String(value).toLowerCase().replace(/[^a-z0-9]/g,'');
const sensitiveKey=value=>/serial|token|auth|macaddress|^mac$|esn|uuid|deviceid|friendlyname|castname|ssid|^ip$|ipaddress/.test(keyName(value));
function walk(value,visit){
  let nodes=0;
  function next(item,depth){
    if(!item||typeof item!=='object'||depth>10||++nodes>4096)return;
    visit(item);
    for(const [key,child]of Object.entries(item))if(!sensitiveKey(key))next(child,depth+1);
  }
  next(value,0);
}
function reportSecrets(state,responses){
  const secrets=new Set([state.token,state.deviceId,state.tv]);
  for(const response of responses)walk(response,item=>{
    for(const [key,value]of Object.entries(item))if(sensitiveKey(key)&&(typeof value==='string'||typeof value==='number'))secrets.add(String(value));
    if(typeof item.CNAME==='string'&&sensitiveKey(item.CNAME)&&(typeof item.VALUE==='string'||typeof item.VALUE==='number'))secrets.add(String(item.VALUE));
  });
  return [...secrets].filter(value=>typeof value==='string'&&value.length>0);
}
function safeValue(value,secrets){
  if(typeof value!=='string'&&typeof value!=='number')return null;
  const text=String(value);
  if(text.length>96||/[\s:/\\@]/.test(text)||secrets.some(secret=>text.includes(secret)))return null;
  if(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(text))return null;
  if(/(?:[0-9a-f]{2}[:-]){5}[0-9a-f]{2}/i.test(text))return null;
  // Look ahead at every position so an address embedded in a version-like
  // string cannot hide behind an overlapping four-number match.
  if([...text.matchAll(/(?=((?:\d{1,3}\.){3}\d{1,3}))/g)].some(match=>isPrivateIPv4(match[1])))return null;
  return text;
}
function versionValue(value,secrets){
  const text=safeValue(value,secrets);
  return text&&/^(?:(?:mtk[cd]?\d*|v)-?)?\d+(?:[._-][A-Za-z0-9]+)+$/i.test(text)?text:null;
}
function componentVersions(responses,secrets){
  const out={};
  function add(name,value){
    const normalized=keyName(name);if(!Object.hasOwn(COMPONENTS,normalized))return;
    const key=COMPONENTS[normalized],version=versionValue(value,secrets);if(version&&!Object.hasOwn(out,key))out[key]=version;
  }
  for(const response of responses)walk(response,item=>{
    for(const [name,value]of Object.entries(item))if(Object.hasOwn(COMPONENTS,keyName(name)))add(name,value);
    if(typeof item.CNAME==='string')add(item.CNAME,item.VALUE);
  });
  return out;
}
function publicGithubPagesUrl(value){
  if(typeof value!=='string'||value.length>2048||/[\s\\%?#]/.test(value))return false;
  try{
    const url=new URL(value);
    return url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&
      /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.github\.io$/.test(url.hostname)&&/^\/[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*\/?$/.test(url.pathname);
  }catch{return false;}
}
function currentApp(data,secrets){
  const item=data?.ITEM||data?.ITEMS?.[0],value=item?.VALUE||item;
  const id=safeValue(value?.APP_ID,secrets);
  return {id:id&&/^[A-Fa-f0-9]{1,16}$/.test(id)?id:null,
    namespace:Number.isSafeInteger(value?.NAME_SPACE)&&value.NAME_SPACE>=0&&value.NAME_SPACE<=65535?value.NAME_SPACE:null,
    publicGithubPagesUrl:publicGithubPagesUrl(value?.MESSAGE)};
}
function networkPrimitive(value){
  return typeof value==='boolean'||Number.isSafeInteger(value)&&value>=0&&value<=65535||
    typeof value==='string'&&value.length>0&&value.length<=64&&value.trim().length>0&&!/[\x00-\x1f\x7f]/.test(value);
}
function networkReport(staticResult,dynamicResult,typeResult){
  const first=result=>Array.isArray(result.data?.ITEMS)?result.data.ITEMS[0]:undefined;
  const elements=first(staticResult)?.ELEMENTS,value=first(dynamicResult)?.VALUE;
  const validElements=Array.isArray(elements)&&elements.length>0&&elements.length<=16&&elements.every(item=>networkPrimitive(item)&&typeof item===typeof elements[0]);
  const validValue=networkPrimitive(value);
  // A different value only proves a reported disconnected state when it is
  // another advertised enum value. Unknown or malformed values stay unknown.
  const recognized=staticResult.status==='ok'&&dynamicResult.status==='ok'&&validElements&&validValue&&elements.includes(value);
  const rawType=first(typeResult)?.VALUE;
  const typeNames={wifi:'Wi-Fi','wi-fi':'Wi-Fi',ethernet:'Ethernet',wired:'wired',wireless:'wireless'};
  const typeKey=typeof rawType==='string'&&rawType.length<=32?rawType.trim().toLowerCase():'';
  const connectionType=typeResult.status==='ok'&&Object.hasOwn(typeNames,typeKey)?typeNames[typeKey]:'unknown';
  return {
    scope:'tv_reported_local_network',reportedConnected:recognized?value===elements[0]:null,connectionType,
    checks:{
      connectionStatusStatic:staticResult.status==='ok'&&!validElements?'invalid_response':staticResult.status,
      connectionStatusDynamic:dynamicResult.status==='ok'&&(!validValue||validElements&&!elements.includes(value))?'invalid_response':dynamicResult.status,
      connectionType:typeResult.status==='ok'&&connectionType==='unknown'?'invalid_response':typeResult.status
    },
    note:'This is the TV-reported local network status. Unknown fields are not disconnected states. It does not verify DNS, TLS, Internet access, or page rendering.'
  };
}
async function inspect(options,{transport=createTransport(),now=()=>new Date()}={}){
  if(!options||typeof options.state!=='string'||!path.isAbsolute(options.state)||options.network!==undefined&&typeof options.network!=='boolean')throw error('arguments');
  let state;try{state=await readState(options.state);}catch{throw error('state');}
  if(state.phase!=='paired'||!tokenValid(state.token)||state.metadata.model!=='V405-H9')throw error('state');
  let info,metadata,requestCount=0;
  async function get(operation,authenticated=true){requestCount++;return checkedResponse(await transport(state.tv,operation,authenticated?state.token:undefined));}
  try{metadata=await verify(state.tv,state.metadata,async()=>{info=await get('info',false);return info;});}
  catch{throw error('target');}
  async function optional(operation){
    try{return {status:'ok',data:await get(operation)};}
    catch(problem){return {status:Object.hasOwn(ERRORS,problem?.inspectionCode)?problem.inspectionCode:'unreachable'};}
  }
  const app=await optional('currentApp'),versions=await optional('versions');
  let tvInfo=await optional('tvInfo'),tvInformationSource='primary';
  const primaryTvInfoStatus=tvInfo.status;
  if(tvInfo.status==='unavailable'){tvInfo=await optional('tvInfoLegacy');tvInformationSource='legacy';}
  let network;
  if(options.network){
    const networkStatic=await optional('networkStatusStatic'),networkDynamic=await optional('networkStatusDynamic'),networkType=await optional('networkType');
    network=networkReport(networkStatic,networkDynamic,networkType);
  }
  const responses=[versions.data,info,tvInfo.data],secrets=reportSecrets(state,[...responses,app.data]);
  const components=componentVersions(responses,secrets);
  const reportedPlatform=safeValue(metadata.platform,secrets),buildPlatform=/^(mtk\d{3,6})-/i.exec(components.viziOs||'')?.[1]||null;
  const platform=reportedPlatform&&/^(?:mtk|mt)\d{3,6}$/i.test(reportedPlatform)?reportedPlatform:buildPlatform;
  return {
    schemaVersion:1,mode:'read_only_native_platform',inspectedAt:now().toISOString(),
    target:{model:metadata.model,firmware:metadata.firmware.system,platformIdentifier:platform,platformIsHardwareVerification:false},
    componentVersions:components,currentApp:currentApp(app.data,secrets),
    checks:{deviceInfo:'ok',currentApp:app.status,systemVersions:versions.status,tvInformation:tvInfo.status,tvInformationSource,primaryTvInfoStatus},
    ...(network?{network}:{}),
    requestCount,
    verification:{rootAccess:'unverified',bootloaderUnlock:'unverified',replacementFirmware:'unverified',recovery:'unverified',persistentInstallation:'unverified'},
    note:'LAN metadata and current-app state do not establish screen rendering, shell access, firmware installation, or a recovery route.'
  };
}
async function main(argv=process.argv.slice(2)){
  const options=parseArgs(argv);
  if(options.help){process.stdout.write('Read-only native platform inspection (Node.js 24; no dependencies).\n\n  node tools/inspect-native-platform.cjs --state ABSOLUTE_PRIVATE_PAIRED_FILE [--network]\n\nReads one verified V405-H9 using four informational GETs, or five if TV information needs its legacy path.\n--network adds exactly three passive GETs for TV-reported local connection status and type.\nThose readings do not verify DNS, TLS, Internet access, or page rendering.\nEach request is limited to 3 seconds and 128 KiB. No pairing, scans, state writes, or TV changes.\nReports omit credentials, device identifiers, target addresses, and raw responses.\n');return;}
  const report=await inspect(options);process.stdout.write(JSON.stringify(report,null,2)+'\n');return report;
}
module.exports={parseArgs,createTransport,inspect,safeErrorMessage,TIMEOUT_MS,MAX_BODY_BYTES};
if(require.main===module)main().catch(problem=>{process.stderr.write(safeErrorMessage(problem)+'\n');process.exitCode=1;});
