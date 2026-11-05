#!/usr/bin/env node
'use strict';

// Native TV compatibility inventory. No pairing, POST, payloads or TV writes.
// API reference: https://github.com/exiva/Vizio_SmartCast_API
const http = require('node:http');
const https = require('node:https');
const dgram = require('node:dgram');
const net = require('node:net');
const fs = require('node:fs/promises');

const MAX_BODY = 128 * 1024;
const TIMEOUT = 2500;
const XML_PATHS = new Set(['/ssdp/device-desc.xml', '/device-desc.xml', '/description.xml', '/rootDesc.xml', '/upnp/desc.xml']);
const ENDPOINTS = Object.freeze({
  smartcast: { protocol: 'https:', port: 7345, path: '/state/device/deviceinfo' },
  cast: { protocol: 'http:', port: 8008, path: '/setup/eureka_info' }
});

function isPrivateIPv4(ip) {
  if (typeof ip !== 'string' || net.isIP(ip) !== 4) return false;
  const [a, b] = ip.split('.').map(Number);
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

function requirePrivate(ip) {
  if (!isPrivateIPv4(ip)) throw new Error('Use a private IPv4 address (10.x, 172.16–31.x, or 192.168.x).');
}

function validateLocation(value, responderIp) {
  requirePrivate(responderIp);
  try {
    const u = new URL(value);
    if (u.protocol !== 'http:' || u.hostname !== responderIp || u.username || u.password || u.search || u.hash) return null;
    if (![80, 8008].includes(Number(u.port || 80)) || !XML_PATHS.has(u.pathname)) return null;
    return u.href;
  } catch { return null; }
}

function parseSsdp(packet, responderIp) {
  if (!isPrivateIPv4(responderIp) || packet.length > 8192) return null;
  const body = packet.toString('utf8');
  if (!/^HTTP\/1\.[01] 200\b/i.test(body)) return null;
  const location = /^location:\s*([^\r\n]+)$/im.exec(body)?.[1]?.trim();
  const descriptionUrl = location && validateLocation(location, responderIp);
  // Some native VIZIO sets advertise only a bare :9080 LOCATION. Keep the
  // private responder as a candidate, but never fetch an unapproved LOCATION.
  return { ip: responderIp, ...(descriptionUrl ? { descriptionUrl } : {}) };
}

function safeText(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const s = String(value).slice(0, 160).replace(/[\x00-\x1f\x7f]/g, '').trim();
  if (!s) return null;
  return s.replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '[redacted]')
    .replace(/\b(?:[0-9a-f]{2}[:-]){5}[0-9a-f]{2}\b/gi, '[redacted]')
    .replace(/\b(?:serial|uuid|token|auth|mac|dsn|esn)\s*[:=]\s*\S+/gi, '[redacted]');
}

function findField(data, names) {
  const wanted = new Set(names.map(x => x.toLowerCase().replace(/[^a-z0-9]/g, '')));
  let visits = 0;
  function walk(v, depth) {
    if (!v || typeof v !== 'object' || depth > 12 || ++visits > 5000) return null;
    for (const [k, x] of Object.entries(v)) {
      if (wanted.has(k.toLowerCase().replace(/[^a-z0-9]/g, ''))) {
        const s = safeText(x);
        if (s) return s;
      }
    }
    for (const x of Object.values(v)) { const found = walk(x, depth + 1); if (found) return found; }
    return null;
  }
  return walk(data, 0);
}

function parseDescription(xml) {
  const out = {};
  if (typeof xml !== 'string' || Buffer.byteLength(xml) > MAX_BODY) return out;
  // Extract simple text only. Never resolve DTDs, entities, URLs or resources.
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) return out;
  for (const tag of ['manufacturer', 'modelName', 'modelNumber']) {
    const value = new RegExp(`<${tag}\\b[^>]*>([^<]*)</${tag}>`, 'i').exec(xml)?.[1];
    if (value) out[tag] = safeText(value.replace(/&(amp|lt|gt|quot|apos);/g, (_, e) => ({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"})[e]));
  }
  return out;
}

function apiStatus(data) {
  const result = data?.STATUS?.RESULT || data?.status?.result || '';
  return /auth|unauthorized|forbidden|access.denied|requires.pairing/i.test(String(result)) ? 'authentication_required'
    : result && result !== 'SUCCESS' ? 'api_error' : 'ok';
}

function normalizeMetadata(ip, results) {
  requirePrivate(ip);
  const sc = results.smartcast?.data || {};
  const cast = results.cast?.data || {};
  const desc = results.description?.data || {};
  const scModel = findField(sc, ['model_name', 'modelNumber', 'model']);
  const model = scModel || findField(desc, ['modelName', 'modelNumber']) || findField(cast, ['model_name', 'model']);
  const manufacturer = findField(sc, ['manufacturer', 'manufacturer_name']) || findField(desc, ['manufacturer']) || findField(cast, ['manufacturer']);
  const explicitVizio = manufacturer && /\bvizio\b/i.test(manufacturer);
  const explicitOther = manufacturer && !explicitVizio;
  const smartcastShape = sc.STATUS?.RESULT === 'SUCCESS' || sc.status?.result === 'SUCCESS';
  const vizioModel = scModel && /^(?:VIZIO\s+)?[DEMPV][0-9]{2,3}[A-Z0-9]*-[A-Z0-9]+$/i.test(scModel);
  const identity = explicitOther ? 'non_vizio' : (explicitVizio || (smartcastShape && vizioModel)) ? 'vizio' : 'unverified';
  const services = {};
  for (const key of ['smartcast', 'cast', 'description']) {
    const r = results[key];
    services[key] = r ? { status: r.status, ...(r.httpStatus ? {httpStatus:r.httpStatus} : {}) } : {status:'not_discovered'};
  }
  return {
    ip, identity, manufacturer: manufacturer || null, model: model || null,
    firmware: {
      system: findField(sc, ['firmware_version', 'firmware', 'software_version', 'version']),
      cast: findField(cast, ['build_version', 'cast_build_revision'])
    },
    platform: findField(sc, ['platform', 'board_platform', 'chipset', 'soc']) || findField(cast, ['platform', 'board_name']),
    services,
    nextStepAllowed: identity === 'vizio',
    nativeRootCompatibility: 'unknown_not_tested',
    note: identity === 'non_vizio' ? 'This is not a VIZIO. Refuse VIZIO-specific follow-up.'
      : identity === 'unverified' ? 'VIZIO identity is unverified. Refuse VIZIO-specific follow-up until identified.'
      : 'Metadata only. No root, bootloader, firmware-install or launcher compatibility has been established.'
  };
}

function fetchMetadata(ip, kind, descriptionUrl) {
  requirePrivate(ip);
  let spec;
  if (Object.hasOwn(ENDPOINTS, kind)) spec = ENDPOINTS[kind];
  else if (kind === 'description') {
    const checked = validateLocation(descriptionUrl, ip);
    if (!checked) return Promise.resolve({status:'rejected_location'});
    const u = new URL(checked);
    spec = {protocol:u.protocol, port:Number(u.port || 80), path:u.pathname};
  } else throw new Error('Unknown metadata endpoint.');
  return new Promise(resolve => {
    let done = false;
    let timer;
    const finish = r => { if (!done) { done = true; clearTimeout(timer); resolve(r); } };
    const client = spec.protocol === 'https:' ? https : http;
    const req = client.request({ hostname:ip, port:spec.port, path:spec.path, method:'GET',
      agent:false, rejectUnauthorized:false, headers:{Accept:kind === 'description' ? 'application/xml, text/xml' : 'application/json', Connection:'close'} }, res => {
      const code = res.statusCode;
      if (code === 401 || code === 403) { finish({status:'authentication_required',httpStatus:code}); res.destroy(); return; }
      if (code >= 300 && code < 400) { finish({status:'redirect_refused',httpStatus:code}); res.destroy(); return; }
      if (code !== 200) { finish({status:code === 404 ? 'not_found' : 'http_error',httpStatus:code}); res.destroy(); return; }
      const chunks = []; let total = 0;
      res.on('data', chunk => {
        total += chunk.length;
        if (total > MAX_BODY) { finish({status:'response_too_large',httpStatus:code}); req.destroy(); return; }
        chunks.push(chunk);
      });
      res.on('error', () => finish({status:'response_error',httpStatus:code}));
      res.on('end', () => {
        if (done) return;
        try {
          const text = Buffer.concat(chunks).toString('utf8');
          const data = kind === 'description' ? parseDescription(text) : JSON.parse(text);
          if (!data || typeof data !== 'object') throw new Error('Invalid metadata');
          const status = apiStatus(data);
          finish({status,httpStatus:code,...(status === 'ok' ? {data} : {})});
        } catch { finish({status:'invalid_metadata',httpStatus:code}); }
      });
    });
    req.on('error', e => finish({status:e.code === 'ECONNREFUSED' ? 'connection_refused' : 'unreachable'}));
    timer = setTimeout(() => {finish({status:'timeout'}); req.destroy();}, TIMEOUT);
    req.end();
  });
}

async function inspectDevice(device, fetcher = fetchMetadata) {
  requirePrivate(device.ip);
  const kinds = ['smartcast', 'cast'];
  if (device.descriptionUrl && validateLocation(device.descriptionUrl, device.ip)) kinds.push('description');
  const entries = await Promise.all(kinds.map(async kind => {
    try {return [kind, await fetcher(device.ip, kind, device.descriptionUrl)];}
    catch {return [kind,{status:'request_failed'}];}
  }));
  return normalizeMetadata(device.ip, Object.fromEntries(entries));
}

function discover() {
  return new Promise(resolve => {
    const socket = dgram.createSocket('udp4');
    const found = new Map(); let finished = false; let retry;
    const timer = setTimeout(finish, 4000);
    function finish() {
      if (finished) return;
      finished = true; clearTimeout(timer); clearTimeout(retry);
      try {socket.close();} catch {}
      resolve([...found.values()]);
    }
    socket.on('error', finish);
    socket.on('message', (packet, peer) => {
      const item = parseSsdp(packet, peer.address);
      if (item && (found.has(item.ip) || found.size < 16)) {
        const prior = found.get(item.ip);
        found.set(item.ip, {...prior, ...item});
      }
    });
    const messages = ['urn:dial-multiscreen-org:service:dial:1', 'ssdp:all'].map(target =>
      Buffer.from(`M-SEARCH * HTTP/1.1\r\nHOST: 239.255.255.250:1900\r\nMAN: "ssdp:discover"\r\nMX: 2\r\nST: ${target}\r\n\r\n`));
    function send() {
      for (const message of messages) if (!finished) socket.send(message, 1900, '239.255.255.250', err => {if (err) finish();});
    }
    socket.bind(0, () => {if (finished) return; try {socket.setMulticastTTL(2);} catch {} send(); retry=setTimeout(send,1500);});
  });
}

function parseArgs(argv) {
  const options = {};
  for (let i=0;i<argv.length;i++) {
    const arg=argv[i];
    if (arg === '--help' || arg === '-h') options.help=true;
    else if (arg === '--ip' || arg === '--out') {
      if (!argv[i+1] || argv[i+1].startsWith('--') || options[arg.slice(2)]) throw new Error(`Provide exactly one value for ${arg}.`);
      options[arg.slice(2)]=argv[++i];
    } else throw new Error(`Unknown option. Use --help.`);
  }
  if (options.ip) requirePrivate(options.ip);
  return options;
}

async function main(argv=process.argv.slice(2)) {
  const options=parseArgs(argv);
  if (options.help) {
    process.stdout.write('Read-only native VIZIO metadata inspection (Node.js 18+).\n\n  node tools/inspect-tv.cjs\n  node tools/inspect-tv.cjs --ip 192.168.1.42\n  node tools/inspect-tv.cjs --ip 192.168.1.42 --out tv-report.json\n\nDiscovery runs for four seconds. Turn the TV on and use the same LAN.\nOnly fixed metadata GET requests are sent. No pairing or TV changes.\nReports omit raw responses, names, serials, MACs, UUIDs and credentials.\n--out creates a new file; it does not overwrite existing files.\n');
    return;
  }
  const targets=options.ip ? [{ip:options.ip}] : await discover();
  const devices=[];
  for (let i=0;i<targets.length;i+=4) devices.push(...await Promise.all(targets.slice(i,i+4).map(t=>inspectDevice(t))));
  const report={schemaVersion:1, inspectedAt:new Date().toISOString(), mode:'read_only_metadata', discovery:options.ip ? 'explicit_ip' : 'ssdp_dial_and_all_4_seconds', devices,
    nextStep:devices.some(d=>d.identity === 'vizio') ? 'Review the reported model and firmware before choosing any separate native compatibility test.' : 'No VIZIO identity verified. Turn the TV on, use its LAN, and rerun with --ip from the TV network menu. A photo of System Information is also sufficient.'};
  const output=JSON.stringify(report,null,2)+'\n';
  if (options.out) await fs.writeFile(options.out,output,{flag:'wx',mode:0o600});
  process.stdout.write(output);
}

module.exports={isPrivateIPv4,validateLocation,parseSsdp,safeText,parseDescription,apiStatus,normalizeMetadata,inspectDevice,parseArgs,discover,main};
if (require.main === module) main().catch(() => {process.stderr.write('Inspection failed. Check arguments/private IPv4 and ensure --out names a new writable file. Use --help.\n');process.exitCode=1;});
