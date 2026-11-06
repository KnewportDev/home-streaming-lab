# Engineering notes

## Passive network status and visible execution checks — 6 November 2026

The paired inspector's optional `--network` mode adds three fixed informational GETs to its existing four-read path: static and dynamic `network/connection_status`, then `network/connection_type`. The [extracted vendor companion SDK](https://github.com/vindeckyy/smartcast-backdoor/blob/aea6dec77bf3c6613c46b2ef45de5444e5f3dccc/extracted/companion-lib.js) compares `ITEMS[0].ELEMENTS[0]` from the static route with `ITEMS[0].VALUE` from the dynamic route. The inspector additionally requires bounded, recognized enum values; malformed or unavailable data remains unknown. It reads no network-address endpoint and retains the 3-second / 128-KiB per-request limits.

The [live redacted report](evidence/native-network-2026-11-06.json) completed seven requests against V405-H9 / `1.720.9.1-1`. All four original checks succeeded. Both connection-status reads succeeded and produced `reportedConnected: true`; the connection type did not match the output allowlist and remains `unknown` / `invalid_response`. No TV writes were sent. This does not resolve DNS, TLS, public-page loading, or the earlier on-screen “no network detected” message.

The next experiment uses standalone [TV Check](../home/tv-check.html), with separate visible receipts for HTML, JavaScript execution, and remote-key events. It has no background requests, automatic probes, credentials, or receipt server. Only its explicit **Check TV connection** button sends a fixed unauthenticated GET to `http://127.0.0.1:7346/state/device/deviceinfo`, bounded to 3 seconds and 128 KiB. Browser status `0` is inconclusive, including when browser policy prevents reading the response; it must not be labeled “no Internet.” The guide's origin guard was our policy, not a measured H9 restriction. Its native app controls stay disabled.

The planned publication target is [the TV Check page](https://knewportdev.github.io/home-streaming-lab/tv-check.html). Launch will reuse the existing paired state. Publication, TV Check launch, desktop browser QA, and physical TV receipts are not yet recorded. A photo of the television is needed because `/app/current` reports launch metadata rather than screen contents or script execution. The cable-guide design is unchanged.

The new full suite passed **69 tests locally on Linux, with 0 failures and 0 skips**. Hosted results for this revision remain pending. Before these changes, merged-main [run 42152947388](https://github.com/KnewportDev/home-streaming-lab/actions/runs/42152947388) passed **57 Linux tests and 56 Windows tests**; that remains the verified historical baseline. The preview allowlist now has seven files including TV Check; the native preparation bundle has eight including its manifest.

The device-information parser also accepts `ITEMS[0].VALUE.SYSTEM_INFO.VERSION`, the shape in the [pinned vizaio capture](https://github.com/raman325/vizaio/blob/aa737707836ac1d97df753192640595583e7823e/tests/captured/device_info.json). A regression covers matching, mismatched, and malformed nested versions without exposing adjacent identifiers. Source attributes preserve LF line endings so inline CSP hashes and package byte hashes remain stable on Windows checkouts.

## Windows CI temporary-directory paths

Adding a Windows job exposed a difference between local and hosted test environments. In [run 42152466657](https://github.com/KnewportDev/home-streaming-lab/actions/runs/42152466657), the new inspector and packaging tests passed, but 16 existing session tests stopped at the state-directory check. The error was `State directories must not use symbolic links.` Linux passed all 57 tests.

Those fixtures used the temporary-directory path returned by the operating system without resolving it. The session code compares a private state directory with its canonical path; Windows temporary paths can have aliases. The fixtures now call `fs.realpath()` after creating each disposable directory, matching the canonical paths already used by the new inspector tests.

The production path guard and the deliberate linked-path rejection test remain intact. The existing 24 session tests passed locally after this fixture change. [PR #2](https://github.com/KnewportDev/home-streaming-lab/pull/2) merged, and [run 42152947388](https://github.com/KnewportDev/home-streaming-lab/actions/runs/42152947388) passed the 57-test Linux and 56-test Windows jobs. This was a test-environment correction, with no changes to pairing or the TV.

These notes record observed behavior and the decisions it led to. The baseline below is from **5 November 2026**. Local network addresses, raw device responses, and pairing credentials are deliberately absent.

## Device observations

The TV's standard metadata endpoint reported V405-H9, firmware `1.720.9.1-1`, ViziOS `mtk5691-1.6.1770.1`, SmartCast API `3.9.1-2640.0002`, Conjure `128.1.9`, and Home `26.09.01.21`. Older notes said H19; the live API identity is the basis for current work.

| Observation | Engineering consequence |
| --- | --- |
| DIAL-only discovery found no TV. General SSDP returned a private responder advertising a bare HTTP location on port 9080. | Discovery now sends both searches and retains bounded private responder candidates. It verifies identity through fixed metadata endpoints instead of fetching an arbitrary advertised URL. |
| Standard SmartCast and Cast metadata requests responded. | Device identity and firmware can be checked before pairing or app actions. Numeric platform fields alone are not used as proof of a physical chip model. |
| Historical `/install` and `/scpl/` paths returned HTTP 404. | Those historical paths did not provide a working installation route in this session. This does not prove that every possible route is absent. |
| Checked SSH, telnet, ADB, debugging, and internal-server ports timed out from the LAN. | No access was established through those checks. A timeout does not establish whether a service exists internally. |
| A standard pairing start displayed a PIN on the TV. | The request caused a remote side effect, even though the client subsequently failed to save the returned challenge. |

The discovery behavior is covered by the `V405-H9 bare port9080 SSDP announcement` regression in [test-inspect-tv.cjs](../tools/test-inspect-tv.cjs). The implementation is [inspect-tv.cjs](../tools/inspect-tv.cjs).

## Windows pairing-state write failure

### Symptom

The television displayed a pairing PIN, but the CLI reported failure. Its private state remained at `starting`, without a challenge or authentication token. That made a network failure, rejected API request, malformed response, and failed local write initially plausible explanations.

The pairing challenge matters: the displayed PIN alone is insufficient for the documented pairing request. Repeating a start can also leave the TV reporting `BLOCKED`, which the upstream API documentation describes as pairing already in progress.

### Diagnosis

A redacted error stack located the failure at the existing-state `fs.open` call. An isolated probe on the actual Windows PC, using a disposable file and **Node.js v24.22.1**, produced:

| Operation | Observed result |
| --- | --- |
| `fs.open(file, O_WRONLY \| O_TRUNC)` | `EINVAL` |
| Numeric flags on that runtime: `1 \| 512` = `513` | Same failing call |
| `fs.open(file, 'r+')` | Succeeded |

This isolated local persistence from the TV request. It did not establish a general failure of numeric flags on every Windows or Node version. `O_NOFOLLOW` was absent on that runtime; blaming that constant would not explain the observed numeric `513` failure.

### Fix

[native-session.cjs](../tools/native-session.cjs) now serializes the state before opening the file. New state uses exclusive creation with `'wx'`. Updating existing state opens it with `'r+'`, then checks that the handle refers to the expected regular file before truncating through the handle. It writes the complete JSON, syncs, and closes the handle.

The existing path checks, symlink rejection, and file-identity comparison remain in place. POSIX mode `0600` is requested; Windows access control also depends on the private directory's ACL, so the mode alone is not treated as a complete Windows permissions policy. The update is an in-place write, not a power-loss-atomic transaction.

Recovery is state-aware. `pair-retry` is restricted to this client's untouched `starting` state, reuses its device ID, and makes one request. It refuses paired or awaiting-PIN states. If a successful start returns only part of a challenge, available fields are saved privately and another automatic start is refused.

### Validation

The Windows file probe established that `'r+'` opened the disposable file successfully on the affected machine. The offline regression then simulated `EINVAL` for numeric truncating opens and verified the replacement implementation:

- New and existing writes use `'wx'` and `'r+'`, respectively.
- Replacing a longer JSON value with a shorter one leaves no trailing bytes.
- The updated file can be read back as valid state.
- Separate tests preserve paired, awaiting-PIN, and incomplete-challenge states during recovery.

The test is named `Windows-compatible writes use exclusive creation and r+ before handle truncation` in [test-native-session.cjs](../tools/test-native-session.cjs). It uses synthetic state and a temporary directory. This validates file handling; live pairing completion is recorded separately below.

### Reproduce the offline checks

From `native-tv/`, with Node.js 24:

```sh
node --check home/home.js
node --test tools/test-inspect-tv.cjs tools/test-native-session.cjs tools/test-usb-diagnostic.cjs
node --test --test-name-pattern="Windows-compatible writes" tools/test-native-session.cjs
```

Recorded baseline: **34 tests passed, 0 failed, 0 skipped** for the full suite. Tests use synthetic inputs, mocked TV transports, loopback servers, and temporary files. No TV credentials or home-network access are required.

To compare the underlying open behavior on a Windows runtime, this optional PowerShell probe creates and removes only its own temporary files:

```powershell
@'
const fs = require('node:fs/promises');
const { constants: C } = require('node:fs');
const os = require('node:os'), path = require('node:path');
(async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'vizio-open-probe-'));
  try {
    for (const [label, flags] of [['numeric', C.O_WRONLY | C.O_TRUNC], ['r+', 'r+']]) {
      const file = path.join(dir, label === 'numeric' ? 'numeric.json' : 'handle.json');
      await fs.writeFile(file, '{"fixture":true}\n', { flag: 'wx' });
      try {
        const handle = await fs.open(file, flags);
        await handle.close();
        console.log(label + ': success');
      } catch (error) { console.log(label + ': ' + error.code); }
    }
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
})().catch(() => { process.exitCode = 1; });
'@ | node
```

Other operating systems or runtime versions may produce different results. The cross-platform regression intentionally simulates the observed failure so it remains useful when CI runs on Linux.

## Recovering an old saved pairing challenge

The client can retain an `awaiting_pin` challenge after the on-screen PIN is no longer available. Reusing an earlier PIN failed on the target; the saved state still had no authentication credential. The original `pair-retry` command correctly refused to overwrite this pending challenge, but there was no explicit recovery command.

The target rejected both the older challenge-based cancellation request and the client-ID/name cancellation form used by maintained SmartCast clients with `INVALID_PARAMETER`. Read-only device verification still passed, and the original pending state was preserved. These responses establish rejected cancellation requests; they do not establish that the challenge expired.

The [official VIZIO launcher's](https://vizio-pm.s3-us-west-1.amazonaws.com/conjure-launcher.html) `startOver` function instead instructs a 30-second wait and returns to ordinary pairing start with the same client identifier. `pair-restart` follows that bounded flow: verify the target, save an exclusive private recovery snapshot, persist a guard, wait, and issue one start. A definitive `BLOCKED` response restores the pending state and requires the owner to dismiss the TV's pairing screen. Uncertain requests and failed saves remain guarded against replay.

Recovery regressions cover ordering, snapshot preservation, invalid states, device mismatch, known rejection, lost responses, failed state writes, and incomplete challenges. They use synthetic state and mocked responses. A fresh PIN still must come from the actual television; offline tests do not complete pairing.

On the target Windows PC, the original file-symlink fixture could not be created without extra privileges. The test now falls back to a real directory junction and verifies both read and write rejection through the parent-path check; production path checks were unchanged. The latest **24-test session suite passed on Windows with Node.js 24.22.1: 0 failed, 0 skipped**.

## Pairing and page delivery

Ordinary PIN pairing completed successfully. The TV accepted an authenticated Conjure launch request, and a subsequent authenticated current-app read reported **app 17, namespace 4**. These observations verify pairing and the control path.

The PC asset server answered locally, but no JavaScript readiness callback arrived from the TV. The owner reported “no network detected.” An explicit inbound Node block was observed in Windows; the process was not elevated and no firewall rules were changed. Rendering remains unverified.

The new delivery path uses `launch-page` to request the [public HTTPS interface](https://knewportdev.github.io/home-streaming-lab/). The paired credential is used only for the TV control request; no PC asset server or inbound firewall change is needed. The helper emitted `page_launch_accepted` for this URL. The public page uses shared example configuration with native app controls disabled. Local `serve-launch` injects its readiness callback; public static files send no automatic receipt callback. The HTTPS request still requires direct TV-screen and remote-control observations.

## Delivery evidence and next experiment

The source repository is public and Pages uses GitHub Actions. The workflow checks JavaScript syntax, runs the offline suite, and packages an allowlisted preview ZIP. The allowlist now includes standalone TV Check for seven files. The same allowlist feeds Pages publishing after a successful main-branch build; pull requests do not deploy. `config.json` comes from the shared example, with no private state or credentials. Deployment permissions belong only to the Pages job. Publication of the new TV Check page is still pending.

The earlier [hosted run for commit afabe7c](https://github.com/KnewportDev/home-streaming-lab/actions/runs/42116511358) passed its 23-test suite. The [recovery build](https://github.com/KnewportDev/home-streaming-lab/actions/runs/42120822505) then passed 30 tests. [Run 42124719065](https://github.com/KnewportDev/home-streaming-lab/actions/runs/42124719065), at commit `3dfa54ff948a9d4a8e867678b226c8c6ecef22ee`, passed both the **34-test offline job** and the **Pages deployment job**. Pages settings confirmed the live URL.

The actual deployed site was opened in a desktop browser. The interface rendered, Settings opened, selecting Cobalt changed the theme, and Escape closed Settings and restored focus. A screenshot was captured. This verifies the deployed web interface in that browser; it does not establish that the TV has rendered it.

The next observation is a TV-screen photo of the standalone check after publication and launch, followed by remote-key receipts and then guide-navigation checks. API acceptance, local callback evidence, browser rendering, TV-screen observations, and persistent installation remain separate milestones. Root access, replacement firmware, internal installation, and persistence remain unverified.

## References

- [Node.js 24 file-system flags](https://nodejs.org/docs/latest-v24.x/api/fs.html#file-system-flags) and [file-handle truncation](https://nodejs.org/docs/latest-v24.x/api/fs.html#filehandletruncatelen): documented API semantics; the specific `EINVAL` result above comes from the local Windows probe.
- [VIZIO Conjure launcher](https://vizio-pm.s3-us-west-1.amazonaws.com/conjure-launcher.html): pairing and authenticated app-launch request structure.
- [exiva SmartCast API](https://github.com/exiva/Vizio_SmartCast_API): pairing fields and result-code documentation.
- [Extracted vendor companion SDK, pinned source](https://github.com/vindeckyy/smartcast-backdoor/blob/aea6dec77bf3c6613c46b2ef45de5444e5f3dccc/extracted/companion-lib.js): `Lg` / `Vg` connection-status reads and comparison, plus `Um` / `qm` connection-type read. The SDK source came from another model; the live report above records this H9's results.
