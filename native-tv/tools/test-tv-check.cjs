#!/usr/bin/env node
// SPDX-License-Identifier: MIT
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createHash } = require('node:crypto');
const html = fs.readFileSync(path.join(__dirname, '../home/tv-check.html'), 'utf8');
const script = /<script id="tv-check-script">([\s\S]*?)<\/script>/.exec(html)[1];
const css = /<style id="tv-check-style">([\s\S]*?)<\/style>/.exec(html)[1];
const ENDPOINT = 'http://127.0.0.1:7346/state/device/deviceinfo';
const MAX_BYTES = 131072;
const good = () => ({ STATUS: { RESULT: 'SUCCESS' }, ITEM: { MODEL_NAME: 'V405-H9', VERSION: '1.720.9.1-1' } });

function page(options = {}) {
  const elements = {}, listeners = {}, requests = [], timers = new Map();
  let nextTimer = 0;
  const doc = {
    activeElement: null,
    getElementById(id) {
      if (!elements[id]) elements[id] = {
        textContent: '', attributes: {}, onclick: null,
        setAttribute(name, value) { this.attributes[name] = value; },
        focus() { doc.activeElement = this; },
      };
      return elements[id];
    },
    addEventListener(name, callback) { (listeners[name] ||= []).push(callback); },
  };
  function XHR() { this.readyState = 0; this.status = 0; this.aborted = false; this.headers = {}; requests.push(this); }
  XHR.prototype.open = function (...args) { this.openArgs = args; };
  XHR.prototype.send = function (body) { this.sent = true; this.body = body; };
  XHR.prototype.abort = function () { this.aborted = true; if (this.onabort) this.onabort(); };
  XHR.prototype.getResponseHeader = function (name) { return this.headers[name] ?? null; };
  XHR.prototype.setRequestHeader = function () { assert.fail('No request headers or credentials are allowed.'); };
  const host = {
    document: doc, XMLHttpRequest: XHR, location: { href: 'https://example.github.io/project/tv-check.html' },
    setTimeout(callback, delay) { const id = ++nextTimer; timers.set(id, { callback, delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
    fetch() { assert.fail('This page must not use fetch.'); },
  };
  for (const name of ['localStorage', 'sessionStorage', 'navigator']) {
    Object.defineProperty(host, name, { get() { assert.fail('No storage or user-agent inspection: ' + name); } });
  }
  if (options.vizio) Object.defineProperty(host, 'VIZIO', { get() { assert.fail('SDK getters must not run.'); } });
  if (options.noXHR) host.XMLHttpRequest = undefined;
  const context = { window: host, module: { exports: {} } };
  vm.runInNewContext(script, context, { timeout: 1000 });
  function dispatch(name, event) { for (const listener of listeners[name] || []) listener(event); }
  function key(code, repeat = false) {
    const event = { keyCode: code, repeat, prevented: false, preventDefault() { this.prevented = true; } };
    dispatch('keydown', event); return event;
  }
  function respond(request, data, status = 200) {
    request.status = status; request.responseText = typeof data === 'string' ? data : JSON.stringify(data); request.onload();
  }
  function screen() { return Object.values(elements).map(element => element.textContent).join('\n'); }
  return { elements, doc, host, requests, timers, dispatch, key, respond, screen, click: () => elements['check-button'].onclick() };
}

test('check page is self-contained with matching inline CSP hashes and one network origin', () => {
  const csp = /http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(html)[1];
  for (const source of [script, css]) {
    const hash = createHash('sha256').update(source).digest('base64');
    assert(csp.includes("'sha256-" + hash + "'"));
  }
  assert.match(csp, /default-src 'none'/);
  assert.match(csp, /connect-src http:\/\/127\.0\.0\.1:7346;/);
  assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval/);
  assert.doesNotMatch(html, /<(?:script|img|iframe)[^>]+src=|<link\b|@import|url\(/i);
  assert.match(html, /id="page-value">Open</);
  assert.match(html, /id="js-value">Waiting/);
  assert.match(html, /id="api-value">Not checked</);
  assert.doesNotMatch(script, /\b(?:let|const|class)\s|=>|\?\./);
});

test('default load is passive and reports JS and SDK presence without invoking getters', () => {
  for (const vizio of [false, true]) {
    const p = page({ vizio });
    assert.equal(p.requests.length, 0);
    assert.equal(p.timers.size, 0);
    assert.equal(p.elements['js-value'].textContent, 'Running');
    assert.equal(p.elements['bridge-value'].textContent, vizio ? 'Present' : 'Not detected');
    assert.equal(p.doc.activeElement, p.elements['check-button']);
  }
});

test('explicit check makes one bounded unauthenticated fixed GET and recognizes observed response shapes', () => {
  for (const data of [good(), { STATUS: { RESULT: 'SUCCESS' }, ITEM: { VALUE: good().ITEM } }, { STATUS: { RESULT: 'SUCCESS' }, ITEMS: [{ VALUE: good().ITEM }] }]) {
    const p = page(); p.click(); p.click();
    assert.equal(p.requests.length, 1, 'no concurrent check or retry');
    const request = p.requests[0];
    assert.deepEqual(request.openArgs, ['GET', ENDPOINT, true]);
    assert.equal(request.body, null);
    assert.equal(request.withCredentials, false);
    assert.equal(request.timeout, 3000);
    assert.equal(request.responseType, 'text');
    assert.equal([...p.timers.values()][0].delay, 3000);
    p.respond(request, data);
    assert.equal(p.elements['api-value'].textContent, 'Target matched');
    assert.match(p.elements['api-detail'].textContent, /V405-H9.*1\.720\.9\.1-1/);
    assert.equal(p.timers.size, 0);
    assert.equal(p.elements['check-button'].attributes['aria-disabled'], 'false');
  }
});

test('captured VIZIO deviceinfo shape reads only the nested firmware field', () => {
  // Shape source: https://github.com/raman325/vizaio/blob/aa737707836ac1d97df753192640595583e7823e/tests/captured/device_info.json
  // Values are synthetic, preserving the known target and keeping captured identifiers out.
  for (const [version, message] of [['1.720.9.1-1', 'Target matched'], ['other-firmware', 'Different TV or firmware'], [null, 'Response not recognized']]) {
    const data = { STATUS: { RESULT: 'SUCCESS' }, ITEMS: [{ CNAME: 'deviceinfo', TYPE: 'T_DEVICE_INFO_V1', VALUE: {
      MODEL_NAME: 'V405-H9', SYSTEM_INFO: { VERSION: version, SERIAL_NUMBER: 'PRIVATE_NESTED_SERIAL', TVAD_ID: 'PRIVATE_AD_ID' },
    } }] };
    const p = page(); p.click(); p.respond(p.requests[0], data);
    assert.equal(p.elements['api-value'].textContent, message);
    assert.doesNotMatch(p.screen(), /PRIVATE_|other-firmware/);
  }
});

test('raw responses, identifiers and mismatched target values never reach the screen', () => {
  const secret = 'SECRET_SERIAL_TOKEN_IP_192.168.1.50';
  const cases = [
    [good(), 'Target matched'],
    [{ STATUS: { RESULT: 'SUCCESS' }, ITEM: { MODEL_NAME: secret, VERSION: '1.720.9.1-1' } }, 'Different TV or firmware'],
    [{ STATUS: { RESULT: 'SUCCESS' }, ITEM: { MODEL_NAME: 'V405-H9', VERSION: secret } }, 'Different TV or firmware'],
    [{ STATUS: { RESULT: 'SUCCESS' }, ITEM: { MODEL_NAME: 'V405-H19', VERSION: '1.720.9.1-1' } }, 'Different TV or firmware'],
    [{ STATUS: { RESULT: 'FAILURE', DETAIL: secret } }, 'Response not recognized'],
    [{ STATUS: { RESULT: 'SUCCESS' }, ITEM: { SERIAL: secret } }, 'Response not recognized'],
    [secret, 'Response not recognized'],
  ];
  for (const [data, message] of cases) {
    if (typeof data === 'object') data.private = { AUTH_TOKEN: secret, SERIAL_NUMBER: secret, IP: secret };
    const p = page(); p.click(); p.respond(p.requests[0], data);
    assert.equal(p.elements['api-value'].textContent, message);
    assert(!p.screen().includes(secret));
  }
});

test('response limits stop advertised, streamed and multi-byte oversized bodies', () => {
  const advertised = page(); advertised.click();
  advertised.requests[0].headers['Content-Length'] = String(MAX_BYTES + 1);
  advertised.requests[0].readyState = 2; advertised.requests[0].onreadystatechange();
  assert.equal(advertised.requests[0].aborted, true);
  assert.equal(advertised.elements['api-value'].textContent, 'Response exceeded the limit');
  const streamed = page(); streamed.click();
  streamed.requests[0].onprogress({ loaded: MAX_BYTES + 1 });
  assert.equal(streamed.requests[0].aborted, true);
  const multibyte = page(); multibyte.click();
  multibyte.respond(multibyte.requests[0], JSON.stringify({ data: 'é'.repeat(MAX_BYTES / 2) }));
  assert.equal(multibyte.elements['api-value'].textContent, 'Response exceeded the limit');
  const boundary = page(); boundary.click();
  const json = JSON.stringify(good());
  boundary.respond(boundary.requests[0], json + ' '.repeat(MAX_BYTES - Buffer.byteLength(json)));
  assert.equal(boundary.elements['api-value'].textContent, 'Target matched');
  assert.equal(boundary.timers.size, 0);
});

test('timeouts and opaque failures stay ambiguous and late callbacks cannot claim success', () => {
  for (const event of ['onerror', 'ontimeout', 'deadline', 'status0']) {
    const p = page(); p.click();
    const request = p.requests[0];
    if (event === 'deadline') [...p.timers.values()][0].callback();
    else if (event === 'status0') p.respond(request, good(), 0);
    else request[event]();
    assert.equal(p.elements['api-value'].textContent, 'Unable to read; browser policy or connection');
    assert.equal(request.aborted, true);
    assert.equal(p.timers.size, 0);
    p.respond(request, good());
    assert.equal(p.elements['api-value'].textContent, 'Unable to read; browser policy or connection');
    assert.doesNotMatch(p.screen(), /no internet|offline|rooted|installed/i);
    assert.equal(p.requests.length, 1);
  }
});

test('CSP reporting only recognizes the fixed endpoint during or after a failed check', () => {
  const p = page();
  p.dispatch('securitypolicyviolation', { blockedURI: ENDPOINT });
  assert.equal(p.requests.length, 0);
  p.click();
  p.dispatch('securitypolicyviolation', { blockedURI: 'https://private.invalid/?token=SECRET' });
  assert.equal(p.elements['api-value'].textContent, 'Checking…');
  p.dispatch('securitypolicyviolation', { blockedURI: ENDPOINT });
  assert.equal(p.elements['api-value'].textContent, 'Browser policy blocked the check');
  assert.equal(p.requests[0].aborted, true);
  assert.doesNotMatch(p.screen(), /private\.invalid|SECRET|127\.0\.0\.1/);
  const late = page(); late.click(); late.requests[0].onerror();
  late.dispatch('securitypolicyviolation', { blockedURI: ENDPOINT });
  assert.equal(late.elements['api-value'].textContent, 'Browser policy blocked the check');
});

test('remote arrows move focus, OK records input, repeated OK does not retrigger, and Back leaves', () => {
  const p = page();
  p.key(39); assert.equal(p.doc.activeElement, p.elements['back-button']);
  p.key(37); assert.equal(p.doc.activeElement, p.elements['check-button']);
  p.key(40); assert.equal(p.doc.activeElement, p.elements['back-button']);
  p.key(38); assert.equal(p.doc.activeElement, p.elements['check-button']);
  assert.equal(p.requests.length, 0);
  p.key(13);
  assert.equal(p.elements['remote-value'].textContent, 'OK received');
  assert.equal(p.elements['remote-detail'].textContent, '5 key events on this page.');
  p.respond(p.requests[0], good()); p.key(13, true);
  assert.equal(p.requests.length, 1);
  for (const code of [8, 27, 461, 10009]) {
    const back = page(); back.click(); back.key(code);
    assert.equal(back.host.location.href, 'index.html');
    assert.equal(back.requests[0].aborted, true);
    assert.equal(back.timers.size, 0);
  }
  const button = page(); button.elements['back-button'].onclick();
  assert.equal(button.host.location.href, 'index.html');
  assert.equal(button.requests.length, 0);
  const unrelated = page(); assert.equal(unrelated.key(65).prevented, false);
  assert.equal(unrelated.requests.length, 0);
});

test('missing XHR reports an unavailable check without any SDK or network fallback', () => {
  const p = page({ noXHR: true, vizio: true }); p.click();
  assert.equal(p.elements['api-value'].textContent, 'Connection check unavailable');
  assert.equal(p.requests.length, 0);
  assert.equal(p.timers.size, 0);
});
