'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const tool=require('./inspect-tv.cjs');

test('private IPv4 only; public, loopback, link-local, names and disguised addresses rejected',()=>{
  for(const ip of ['10.2.3.4','172.16.0.4','172.31.255.254','192.168.1.20']) assert.equal(tool.isPrivateIPv4(ip),true);
  for(const ip of ['8.8.8.8','127.0.0.1','169.254.169.254','172.32.0.1','::1','localhost','192.168.1.4.evil','192.168.001.1','3232235777']) assert.equal(tool.isPrivateIPv4(ip),false);
});

test('discovery metadata cannot redirect requests to another host, port or arbitrary path',()=>{
  const ip='192.168.1.2';
  assert.equal(tool.validateLocation(`http://${ip}:8008/ssdp/device-desc.xml`,ip),`http://${ip}:8008/ssdp/device-desc.xml`);
  for(const url of ['http://8.8.8.8/description.xml','http://192.168.1.3/description.xml','http://192.168.1.2:22/description.xml','http://192.168.1.2/reboot','http://user:pass@192.168.1.2/description.xml','http://192.168.1.2/description.xml?token=secret','https://192.168.1.2/description.xml']) assert.equal(tool.validateLocation(url,ip),null);
  const parsed=tool.parseSsdp(Buffer.from(`HTTP/1.1 200 OK\r\nLOCATION: http://${ip}:8008/ssdp/device-desc.xml\r\nUSN: uuid:private-secret\r\n\r\n`),ip);
  assert.deepEqual(parsed,{ip,descriptionUrl:`http://${ip}:8008/ssdp/device-desc.xml`});
});

test('report allowlist excludes serials, MAC, friendly names, tokens and UUIDs',()=>{
  const result=tool.normalizeMetadata('192.168.1.2',{smartcast:{status:'ok',httpStatus:200,data:{STATUS:{RESULT:'SUCCESS'},ITEM:{MODEL_NAME:'V405-H19',VERSION:'1.20.18.13-1',PLATFORM:'mt5691',SERIAL_NUMBER:'private-serial',AUTH_TOKEN:'private-auth',MAC:'11:22:33:44:55:66',FRIENDLY_NAME:'private-person'}}},cast:{status:'ok',data:{build_version:'1234',uuid:'private-uuid'}}});
  assert.equal(result.identity,'vizio'); assert.equal(result.model,'V405-H19'); assert.equal(result.firmware.system,'1.20.18.13-1'); assert.equal(result.platform,'mt5691');
  assert.equal(result.nativeRootCompatibility,'unknown_not_tested');
  assert.doesNotMatch(JSON.stringify(result),/private-|11:22:33:44:55:66/);
});

test('other manufacturers and unidentified Chromecast remain ineligible',()=>{
  const other=tool.normalizeMetadata('10.0.0.2',{description:{status:'ok',data:{manufacturer:'Google Inc.',modelName:'Chromecast'}}});
  assert.equal(other.identity,'non_vizio'); assert.equal(other.nextStepAllowed,false);
  const unknown=tool.normalizeMetadata('10.0.0.3',{cast:{status:'ok',data:{name:'VIZIO TV',build_version:'2345'}}});
  assert.equal(unknown.identity,'unverified'); assert.equal(unknown.nextStepAllowed,false);
});

test('XML only exposes model/manufacturer and refuses DTDs',()=>{
  assert.deepEqual(tool.parseDescription('<root><manufacturer>VIZIO</manufacturer><modelName>V405-H19</modelName><serialNumber>secret</serialNumber><UDN>uuid:secret</UDN></root>'),{manufacturer:'VIZIO',modelName:'V405-H19'});
  assert.deepEqual(tool.parseDescription('<!DOCTYPE root SYSTEM "http://example.com"><root><manufacturer>VIZIO</manufacturer></root>'),{});
});

test('inspection uses only known endpoint selectors, preserves authentication status; no real network',async()=>{
  const calls=[];
  const result=await tool.inspectDevice({ip:'192.168.1.2',descriptionUrl:'http://8.8.8.8/description.xml'},async(ip,kind)=>{calls.push([ip,kind]);return {status:kind==='smartcast'?'authentication_required':'timeout',httpStatus:kind==='smartcast'?401:undefined};});
  assert.deepEqual(calls,[['192.168.1.2','smartcast'],['192.168.1.2','cast']]);
  assert.equal(result.services.smartcast.status,'authentication_required');
  assert.equal(result.identity,'unverified'); assert.equal(result.firmware.system,null);
  await assert.rejects(()=>tool.inspectDevice({ip:'8.8.8.8'},()=>{throw Error('must never request');}));
});

test('CLI refuses unsupported switches and public targets',()=>{
  assert.deepEqual(tool.parseArgs(['--ip','10.0.0.2','--out','report.json']),{ip:'10.0.0.2',out:'report.json'});
  assert.throws(()=>tool.parseArgs(['--ip','8.8.8.8']));
  assert.throws(()=>tool.parseArgs(['--url','http://10.0.0.2/reboot']));
});

test('V405-H9 bare port9080 SSDP announcement survives as a candidate without fetching that URL',async()=>{
  const packet=Buffer.from('HTTP/1.1 200 OK\r\nLOCATION: http://192.168.1.50:9080\r\nST: upnp:rootdevice\r\nUSN: uuid:sensitive-device-id\r\n\r\n');
  const candidate=tool.parseSsdp(packet,'192.168.1.50');
  assert.deepEqual(candidate,{ip:'192.168.1.50'});
  const kinds=[];
  const report=await tool.inspectDevice(candidate,async(ip,kind)=>{
    kinds.push(kind);
    return kind==='smartcast'
      ? {status:'ok',data:{STATUS:{RESULT:'SUCCESS'},ITEM:{MODEL_NAME:'V405-H9',VERSION:'1.720.9.1-1'}}}
      : {status:'ok',data:{device_info:{manufacturer:'VIZIO',model_name:'V405-H9'},build_version:'514379118',platform:2}};
  });
  assert.deepEqual(kinds,['smartcast','cast']);
  assert.equal(report.identity,'vizio');
  assert.equal(report.model,'V405-H9');
  assert.equal(report.firmware.system,'1.720.9.1-1');
  assert.equal(report.firmware.cast,'514379118');
  assert.equal(report.nativeRootCompatibility,'unknown_not_tested');
});

test('requires-pairing API response is reported as authentication required',()=>{
  assert.equal(tool.apiStatus({STATUS:{RESULT:'REQUIRES_PAIRING'}}),'authentication_required');
  assert.equal(tool.apiStatus({STATUS:{RESULT:'INVALID_AUTH_TOKEN'}}),'authentication_required');
  assert.equal(tool.apiStatus({STATUS:{RESULT:'SUCCESS'}}),'ok');
  assert.equal(tool.apiStatus({STATUS:{RESULT:'FAILURE'}}),'api_error');
});
