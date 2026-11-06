#!/usr/bin/env node
// SPDX-License-Identifier: MIT
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { generate } = require('./make-usb-diagnostic.cjs');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'vizio-usb-test-'));

try {
  const missing = spawnSync(process.execPath, [path.join(__dirname, 'make-usb-diagnostic.cjs')]);
  assert.notEqual(missing.status, 0, 'CLI requires an explicit output directory');
  assert.throws(() => generate(''), /explicit output/);

  const out = path.join(scratch, 'new directory with spaces');
  generate(out);
  assert.deepEqual(fs.readdirSync(out).sort(), ['README.md', 'capability.cgi']);
  const cgiPath = path.join(out, 'capability.cgi');
  const cgi = fs.readFileSync(cgiPath, 'utf8');
  assert.throws(() => generate(out), /must be empty/);
  assert.equal(fs.readFileSync(cgiPath, 'utf8'), cgi, 'existing output is unchanged');

  const hidden = path.join(scratch, 'hidden');
  fs.mkdirSync(hidden);
  fs.writeFileSync(path.join(hidden, '.keep'), 'preserve me');
  assert.throws(() => generate(hidden), /must be empty/);
  assert.deepEqual(fs.readdirSync(hidden), ['.keep']);

  const empty = path.join(scratch, 'existing empty');
  fs.mkdirSync(empty);
  generate(empty);
  const file = path.join(scratch, 'regular-file');
  fs.writeFileSync(file, 'preserve me');
  assert.throws(() => generate(file), /directory/);
  assert.equal(fs.readFileSync(file, 'utf8'), 'preserve me');
  const link = path.join(scratch, 'link');
  fs.symlinkSync(out, link, 'dir');
  assert.throws(() => generate(link), /symbolic-link/);
  assert.throws(() => generate(path.join(link, 'nested')), /symbolic-link/);

  // Validate the actual fixed shell statements, including their arguments.
  // This deliberately rejects any new command until a reviewer updates the test.
  const commands = cgi.split('\n').filter(line => line && !line.startsWith('#'));
  const mountStatement = `awk '{ mode="unknown"; n=split($4,opts,","); for (i=1;i<=n;i++) if (opts[i]=="ro" || opts[i]=="rw") mode=opts[i]; printf "%s %s %s\\n",$2,$3,mode }' /proc/mounts`;
  const allowedStatement = line => line === mountStatement || [
    /^PATH=\/usr\/sbin:\/usr\/bin:\/sbin:\/bin$/,
    /^LC_ALL=C$/,
    /^export PATH LC_ALL$/,
    /^printf '[^']*'(?: '[^']*')*$/,
    /^id$/,
    /^uname -srm$/,
    /^cat \/proc\/version$/,
    /^command -v (busybox|python|python3) \|\| printf '%s\\n' '\1: unavailable'$/,
  ].some(pattern => pattern.test(line));
  for (const line of commands) {
    assert(allowedStatement(line), `Unexpected shell statement: ${line}`);
  }
  assert(!allowedStatement('id; touch /tmp/unexpected'));
  assert(!allowedStatement("printf '%s\\n' 'ok'; touch /tmp/unexpected"));
  assert(!allowedStatement('cat /data/tv/save/sc-config.json'));
  assert.equal(commands.filter(line => line.startsWith('cat ')).join('\n'), 'cat /proc/version');
  assert.equal(commands.filter(line => line.startsWith('awk ')).join('\n'), mountStatement);
  assert(!/\$(?:\{|\(|[A-Za-z_@*?!#0-9])|`|\beval\b|\bexec\b|\bsource\b|[<>]/.test(cgi.replace(/^awk .+$/m, '')), 'no input expansion, redirection, or dynamic shell execution');
  assert(!cgi.includes('\r'), 'CGI file has Unix line endings');

  const syntax = spawnSync('/bin/sh', ['-n', cgiPath], { encoding: 'utf8' });
  assert.equal(syntax.status, 0, syntax.stderr);
  const marker = path.join(scratch, 'should-not-exist');
  const run = spawnSync('/bin/sh', [cgiPath, `touch ${marker}`], {
    encoding: 'utf8', timeout: 5000,
    env: { ...process.env, QUERY_STRING: `x=$(touch ${marker})`, CONTENT_LENGTH: '999' },
    input: `touch ${marker}\n`,
  });
  assert.equal(run.status, 0, run.stderr);
  assert(run.stdout.startsWith('Content-Type: text/plain; charset=utf-8\r\nCache-Control: no-store\r\n\r\n'));
  assert(run.stdout.includes('V405-H9/H19: UNTESTED'));
  assert(run.stdout.includes('== Identity =='));
  assert(run.stdout.includes('== Mount table: target filesystem access =='));
  assert(!fs.existsSync(marker), 'CGI input cannot request a command');
  console.log('USB diagnostic tests passed: output isolation, overwrite refusal, fixed read-only commands, shell syntax, ignored CGI input. Local host only; no TV tested.');
} finally {
  // Only the disposable directory created by this test is removed.
  fs.rmSync(scratch, { recursive: true, force: true });
}
