#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Original, fixed read-only diagnostic. No third-party payload is copied.
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const CGI = String.raw`#!/bin/sh
# SPDX-License-Identifier: MIT
# UNTESTED on V405-H9/H19. USB CGI eligibility is not confirmed.
# Execution proves only script execution; uid=0 is required to establish root.
# Fixed read-only commands. CGI parameters and request bodies are not read.
PATH=/usr/sbin:/usr/bin:/sbin:/bin
LC_ALL=C
export PATH LC_ALL
printf 'Content-Type: text/plain; charset=utf-8\r\nCache-Control: no-store\r\n\r\n'
printf '%s\n' 'V405-H9/H19: UNTESTED; USB CGI eligibility is not confirmed.' 'Output is evidence of script execution only. Root requires uid=0 in the identity below.'
printf '\n== Identity ==\n'
id
printf '\n== Kernel (hostname omitted) ==\n'
uname -srm
printf '\n== Kernel build ==\n'
cat /proc/version
printf '\n== Mount table: target filesystem access ==\n'
printf '%s\n' 'Sources and other mount options are omitted; target paths may be private.'
awk '{ mode="unknown"; n=split($4,opts,","); for (i=1;i<=n;i++) if (opts[i]=="ro" || opts[i]=="rw") mode=opts[i]; printf "%s %s %s\n",$2,$3,mode }' /proc/mounts
printf '\n== Command availability (not executed) ==\n'
command -v busybox || printf '%s\n' 'busybox: unavailable'
command -v python || printf '%s\n' 'python: unavailable'
command -v python3 || printf '%s\n' 'python3: unavailable'
`;

const README = `# Native USB capability diagnostic — preparation only

**Untested on VIZIO V405-H9/H19. USB CGI eligibility has not been confirmed.**
This kit is not a firmware image, installer, root guarantee, or replacement OS.
Successful output establishes that this fixed script executed in its current
process context. Root is established only if its identity reports uid=0;
even then, bootloader unlocking, persistent access, and OS replacement remain
unproven. A download, displayed source code, blank page, or error is not evidence
that the script executed.

## What is included

- capability.cgi: a static POSIX shell CGI diagnostic, with a plain-text response.
- README.md: this document.

The script prints identity, kernel information, /proc/version, a reduced
/proc/mounts table, and whether busybox, python, and python3 are on the system
command path. It does not execute those interpreters. Mount source fields and
options other than ro/rw are omitted because options can contain credentials.
Target paths remain visible; review the response before sharing it.

The script accepts no command input, ignores HTTP parameters and request bodies,
and contains no listener, installation, persistence, filesystem write, mount
change, firmware update, configuration copy, or network request. A TV's own
services may independently log requests. The generator writes only these two
files into the local empty directory you selected, never formats a drive, and
never connects to a TV.

## Preparation and stop point

1. Record the exact model and installed firmware from your own TV first. Do not
   substitute a different TV discovered on the same network.
2. Review capability.cgi. If a compatible USB CGI path has independently been
   established for your exact device and firmware, copy these two files manually
   to a suitable existing USB drive. This tool does not format or mount it.
3. Physical USB insertion is manual and only for your own identified TV. Stop
   before any launch until the applicable local webserver and the actual USB
   mount have been observed. This kit provides no automated invocation.

The published technique maps USB content into a SmartCast local webserver under
/usbparts/<actual observed mount>/... . The mount and server must come from
observations on the particular TV. Do not replace the placeholder by guessing
from examples, probe other devices, or treat an older model's exploit as
V405-H9/H19 compatibility. No launch command, guessed address, or complete launch
URL is supplied here.

The local syntax and generator tests are not TV compatibility tests. No real
TV has been contacted or modified while preparing this kit.

## Research provenance

This is an original implementation informed by these public sources, not a copy
of their payloads:

- ELTON, June 28, 2021: USB content reachable by a local webserver and CGI code
  execution; demonstrated on 2017 E50x-E1 and 2018 P65-F1, not V405-H9/H19.
  https://www.eltoncyber.com/advisories/vizio-tv-code-execution-from-a-usb-drive
- Vizio Open Home: the project reports USB CGI root on M657-G0, SX7B,
  firmware 7.0.120.1-1, group 271. Other models/firmware are unvalidated.
  https://github.com/jordanmateo-byte/vizio-open-home
- Its USB generator separates a diagnostic from write-capable bridge and backup
  scripts. This kit implements only a fixed capability diagnostic.
  https://github.com/jordanmateo-byte/vizio-open-home/blob/main/tools/usb-kit.mjs

## License

MIT License

Copyright (c) 2026 Knewport and contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;

function ensureNoSymlinkAncestors(destination) {
  const root = path.parse(destination).root;
  let current = root;
  for (const segment of destination.slice(root.length).split(path.sep)) {
    if (!segment) continue;
    current = path.join(current, segment);
    try {
      if (fs.lstatSync(current).isSymbolicLink()) {
        throw new Error(`Refusing symbolic-link path: ${current}`);
      }
    } catch (error) {
      if (error.code === 'ENOENT') return;
      throw error;
    }
  }
}

function generate(output) {
  if (typeof output !== 'string' || !output.trim()) {
    throw new Error('An explicit output directory is required.');
  }
  const directory = path.resolve(output);
  ensureNoSymlinkAncestors(directory);
  let stat;
  try { stat = fs.lstatSync(directory); } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (stat) {
    if (!stat.isDirectory()) throw new Error('Output must be a directory.');
    if (fs.readdirSync(directory).length !== 0) {
      throw new Error('Output directory must be empty. No existing files were changed.');
    }
  } else {
    // Require the parent to exist: do not create an unintended directory tree.
    fs.mkdirSync(directory, { mode: 0o700 });
  }
  // Exclusive creation prevents overwriting files even if the directory changes.
  // On an I/O error, leave any newly created file for inspection; never delete it.
  fs.writeFileSync(path.join(directory, 'capability.cgi'), CGI, {
    encoding: 'utf8', mode: 0o755, flag: 'wx',
  });
  fs.writeFileSync(path.join(directory, 'README.md'), README, {
    encoding: 'utf8', mode: 0o644, flag: 'wx',
  });
  return directory;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length === 1 && (args[0] === '--help' || args[0] === '-h')) {
    console.log('Usage: node tools/make-usb-diagnostic.cjs --out <new-or-empty-directory>');
  } else {
    try {
      if (args.length !== 2 || args[0] !== '--out' || !args[1] || args[1].startsWith('--')) {
        throw new Error('Usage: node tools/make-usb-diagnostic.cjs --out <new-or-empty-directory>');
      }
      const directory = generate(args[1]);
      console.log(`Prepared capability.cgi and README.md in ${directory}`);
      console.log('Untested V405-H9/H19; no TV connection or invocation was performed.');
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
    }
  }
}

module.exports = { generate };
