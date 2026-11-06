# Vizio Native

A personal IT and networking homelab for building a custom interface in a VIZIO television's own browser. The current design follows the user's 2000s Suddenlink-style cable-guide direction, informed by classic i-Guide.

The engineering problem is compatibility: finding what this particular TV exposes, integrating its control API, and proving each step on the actual firmware. The project includes a remote-friendly interface, bounded network discovery, a PIN-pairing client, and an offline test and preview pipeline.

Public source: [KnewportDev/home-streaming-lab](https://github.com/KnewportDev/home-streaming-lab), under `native-tv/`. Original project code is [MIT licensed](LICENSE).

[Public preview](https://knewportdev.github.io/home-streaming-lab/) · [Verified build and deployment](https://github.com/KnewportDev/home-streaming-lab/actions/runs/42144758476)

**Current revision:** version **0.3.0**, a deployed cable-guide interface with explicitly labeled sample listings. Commit `25c58b0cd4fcbeb21e5a843c0c6d1df40ff42bd7` passed **39 tests** in GitHub Actions and deployed to Pages. Browser checks verified the retro layout, directional navigation, program dialogs, Settings, and the empty app state; the user approved the visual direction. The five guide tests also passed on Windows, separately from the earlier **24 passing session tests**. PIN pairing and authenticated Conjure launch requests are verified. The latest read-only current-app check reported app **17**, namespace **4**, and the exact public guide URL. Actual TV-screen rendering and physical remote behavior remain unverified.

The public HTTPS guide requires no always-on PC server. Running personal continuous channels is deferred; no television content, playback source, or real electronic program guide is connected.

## Cable-guide design — 5 November 2026

The user changed the visual direction from Media Center/Aero to a 2000s Suddenlink-style guide. The new screen has six sample channels across three half-hour columns, a yellow selection, blue regular-program cells, purple movie cells, green sports cells, and light-blue kids' cells. Selected-item details appear at the upper left; decorative CSS color bars occupy the upper-right preview pane. The clock and time headers use the device's local time.

Guide, My Apps, and Settings are the main navigation. Enter opens sample-program information; it does not tune a channel or start playback. The sample guide is always labeled, has no connected television feed or electronic program-guide source, and is separate from the actual app catalog, which remains empty. Themes are **Cable Blue**, **Night Guide**, and **Classic Gray**.

The layout reference is the provider-hosted [classic i-Guide manual](https://www.wadsworthcity.com/DocumentCenter/View/1540/I-Guide-Manual---Manual-for-the-Digital-Guide-Our-Digital-Settop-Boxes-Use-PDF), especially its Picture-in-Guide and Listings By Time examples. The project keeps its own branding and implementation. See [interface controls and configuration](home/README.md).

## What this project demonstrates

| Area | Implementation and evidence |
| --- | --- |
| Network discovery | Bounded SSDP discovery, private IPv4 validation, and fixed GET-only metadata requests. A regression covers this TV's bare port-9080 announcement. |
| API integration | Model and firmware checks, ordinary VIZIO PIN pairing, explicit pairing states, and the documented Conjure app 17 launch request. |
| Windows troubleshooting | Isolated a state-write failure after the TV displayed a PIN; replaced the failing numeric open flags with a checked file handle and added a regression. |
| Local data handling | Pairing state stays in an explicit private file; reports and status messages omit credentials and device identifiers. |
| Testing and CI | 39 passing offline tests, including guide-navigation and timeline checks. CI packages an allowlisted preview and publishes Pages after a successful main-branch build. |
| Interface development | A remote-oriented cable-guide sample with directional navigation, visible yellow focus, information dialogs, and no external fonts or analytics. |

Read the [engineering notes](docs/ENGINEERING-NOTES.md) for the debugging evidence and [portfolio summary](docs/PORTFOLIO.md) for a short project explanation.

## Current device evidence

The television responded directly on the home network on 5 November 2026:

| Field | Live response |
| --- | --- |
| Reported model | V405-H9 |
| System firmware | 1.720.9.1-1 |
| ViziOS build | mtk5691-1.6.1770.1 |
| SmartCast API | 3.9.1-2640.0002 |
| Conjure | 128.1.9 |
| Home component | 26.09.01.21 |

Older notes called the set V405-H19. The live API identity is used for this build; this does not establish whether the physical retail label uses a different suffix.

The standard device-information API responds. The historical `/install` and `/scpl/` paths returned HTTP 404. Connections to the checked SSH, telnet, ADB, developer-debugging and internal-webserver ports timed out from the LAN. A network timeout does not establish whether a service exists internally.

During the local preview test, the PC server responded locally but the TV did not return its readiness callback. Windows has an explicit inbound Node block; the process was not elevated, and no firewall rules were changed. Public HTTPS delivery avoids that inbound serving path and requires no PC asset server. An earlier HTTPS launch request was accepted. The latest authenticated, read-only `/app/current` request returned `SUCCESS`, app 17, namespace 4, and `MESSAGE` equal to `https://knewportdev.github.io/home-streaming-lab/`; no relaunch was sent during that check. A separate PC request returned HTTP 200 with the expected Knewport Cable Guide and guide-grid markup. Neither check establishes what the physical TV displayed. [Engineering notes](docs/ENGINEERING-NOTES.md#pairing-and-page-delivery) record the earlier control and delivery evidence.

**Root access, a bootloader unlock, replacement firmware, internal installation and a permanent Home replacement have not been established.** The custom browser interface is a separate, testable step toward the requested native-TV setup. It does not replace the TV's Linux kernel or proprietary firmware.

## Contents

- `home/`: original, local interface source with remote-control navigation. No external fonts, ads or analytics.
- `tools/inspect-tv.cjs`: bounded, GET-only metadata discovery. Reports omit serial numbers, credentials and raw device responses.
- `tools/make-usb-diagnostic.cjs`: prepares a fixed read-only capability script in a new/empty directory. It does not contact a TV or infer that this model can execute the script.
- `tools/native-session.cjs`: standard PIN pairing and a temporary native browser test using VIZIO's documented Conjure app-launch route. Credentials stay in an explicitly selected local state file and must not be published.
- `tools/preview-home.cjs`: a local interface preview on the development computer.

## Start with the local preview

Use **Node.js 24**. No package installation is required. Run commands from `native-tv/`:

```sh
node tools/preview-home.cjs
```

Open [http://127.0.0.1:8138](http://127.0.0.1:8138). Arrows move through the sample guide, Enter opens program information, and Back/Escape closes a dialog or opens Settings. Guide/My Apps switch views; the preview binds to the local computer.

The preview automatically uses `home/config.example.json` when personal `home/config.json` is absent, so a fresh clone runs without configuration setup. Keep personal configuration in `home/config.json`, which is ignored by Git. See [the interface documentation](home/README.md) for configuration and native adapter details. Only add application launch values verified on the target television.

## Architecture

| Component | Runs on | Role |
| --- | --- | --- |
| `home/` | Computer or TV browser | Local HTML, CSS, JavaScript, remote navigation, and configuration. |
| `preview-home.cjs` | Development PC | Local interface preview. |
| `inspect-tv.cjs` | A PC on the TV's LAN | Bounded discovery and GET-only metadata inspection. |
| `native-session.cjs` | A PC on the TV's LAN | PIN pairing and authenticated Conjure app 17 launch, using either local assets or a public HTTPS page. |
| `make-usb-diagnostic.cjs` | Development PC | Prepares a fixed diagnostic CGI; it does not execute it on a TV. |

`serve-launch` serves four allowlisted assets from the PC under a random path and requests Conjure to open them. Its server injects a small readiness callback; a receipt is expected only if the TV loads and executes that page. The PC must keep serving during this test. `launch-page` instead requests a public HTTPS GitHub Pages project URL and starts no PC server.

`launch_accepted` means the control request was accepted. For local sessions, `tv_javascript_ready` means the TV returned the injected callback. Pages has no execution-receipt endpoint, so its screen and remote behavior must be observed directly. The internal native API adapter has a separate origin guard and stays disabled in both public and PC-hosted previews.

## Inspect

Node.js 24 is the development baseline; the inspection tool also supports Node.js 18 or newer:

```sh
node tools/inspect-tv.cjs
node tools/inspect-tv.cjs --ip 192.168.1.50
```

Replace the example address with the TV's private LAN address. Discovery includes the announcement format actually seen from this TV. An empty discovery result is not a compatibility verdict; the explicit private IP can still work. Store any saved reports under `.private/`.

## Native browser test

Use Node.js 24 for the session tool. PIN pairing is the ordinary VIZIO control pairing flow. The session tool checks the V405-H9/H19 family and exact firmware `1.720.9.1-1` before each action, and detects a model or firmware change after pairing begins.

The following examples use PowerShell. Replace `192.168.1.50` with the TV's address and `192.168.1.20` with the PC's LAN address. Both devices must be reachable on the same LAN.

```powershell
New-Item -ItemType Directory -Force .private | Out-Null
$tvState = Join-Path (Resolve-Path .private).Path "tv-session.json"
node tools/native-session.cjs --help
node tools/native-session.cjs pair-start --tv 192.168.1.50 --state "$tvState"
```

The first start creates a new state file exclusively. Use the PIN currently displayed on the television in place of `TV_PIN`:

```powershell
node tools/native-session.cjs pair-code --state "$tvState" --pin TV_PIN
```

Reuse an existing paired state instead of starting pairing again. Open the deployed public interface with:

```powershell
node tools/native-session.cjs launch-page --state "$tvState" --url https://knewportdev.github.io/home-streaming-lab/
```

This verifies the paired target and sends the public HTTPS URL to Conjure. It does not start an inbound server or send pairing credentials to GitHub Pages. Confirm the interface on the TV and test Settings, the accent controls, and Back. The shared configuration keeps native app control disabled.

For a local delivery test instead:

```powershell
node tools/native-session.cjs serve-launch --state "$tvState" --bind 192.168.1.20 --port 8137 --home ./home
```

Local serving requires `home/index.html`, `home/home.css`, `home/home.js`, and personal `home/config.json`. The PC must remain available and permit the TV to reach that port. No firewall changes are made by the helper. Ctrl+C stops only the PC server. On other operating systems, use an absolute state path in a private directory.

An accepted launch request alone does not prove rendering. For local delivery, check the TV readiness callback; for either route, confirm the actual screen and remote controls. Native app-control integration and permanent installation remain separate checks.

Do not publish the pairing state file, authentication token, local addresses or raw television configuration. The source archive deliberately excludes those values.

### Recover a failed start

```powershell
node tools/native-session.cjs pair-retry --state "$tvState"
```

Retry is available only for an existing `starting` state without a token or challenge. It reuses the same device identity and performs one start attempt. Paired or awaiting-PIN states are preserved and refused. A successful new start may display a new PIN.

`BLOCKED` means a pairing operation is already in progress. Retrying does not clear that TV-side condition. An incomplete successful response preserves any available challenge fields privately and stops further retries. Never fabricate a challenge token or submit guessed PINs. Windows state updates use a verified existing file handle, following the fix for the observed `EINVAL` failure.

### Refresh an old saved PIN challenge

If this client's state is `awaiting_pin` and the displayed PIN is no longer current:

```powershell
node tools/native-session.cjs pair-restart --state "$tvState"
```

The helper verifies the TV, saves a private recovery snapshot, waits 30 seconds, and makes one pairing-start request with the same client identity. This follows VIZIO's launcher recovery flow. Use the new PIN displayed on the screen. If the TV reports `BLOCKED`, dismiss its current pairing screen with Back on the physical remote before explicitly trying again. A lost response or failed state write blocks automatic replay; do not delete state to force a restart. The helper refuses paired sessions and incomplete challenges.

## Optional USB diagnostic preparation

```sh
node tools/make-usb-diagnostic.cjs --out ./new-usb-diagnostic
```

This creates only a fixed diagnostic CGI and instructions. Read the generated instructions. Copying files to USB does not demonstrate code execution. The actual USB mount and a valid native execution route must be observed before any invocation. No flashing, boot changes, network shell or persistence mechanism is included.

## Develop and verify

```sh
node --check home/home.js
node --test tools/test-inspect-tv.cjs tools/test-native-session.cjs tools/test-usb-diagnostic.cjs tools/test-home-guide.cjs
```

The deployed cable-guide revision passed **39 tests, 0 failed, 0 skipped** in [GitHub Actions](https://github.com/KnewportDev/home-streaming-lab/actions/runs/42144758476), including five checks in `test-home-guide.cjs`. Those five guide tests also passed on the target Windows PC. Separately, the earlier 24-test session suite passed there with Node.js 24.22.1, with zero failures or skips; this is not a claim that the full 39-test suite ran on Windows. The previous CI baseline was 34 passing tests. Tests use synthetic inputs, mocked TV transports, loopback servers, and temporary files; they do not contact the TV.

The repository-root workflow, `.github/workflows/native-tv.yml`, uses Node.js 24 and commit-pinned GitHub actions. It checks source and uploads a preview ZIP; successful pushes to `main` then deploy the same six allowlisted assets to GitHub Pages. Deployment permissions are isolated to the Pages job. It has no TV credentials or device access. [Run 42144758476](https://github.com/KnewportDev/home-streaming-lab/actions/runs/42144758476) passed the 39-test job and deployed commit `25c58b0cd4fcbeb21e5a843c0c6d1df40ff42bd7`.

Browser review of that deployed revision verified the cable-guide layout, directional navigation, program-information dialogs, Settings, and the empty My Apps state. A local screenshot was retained as `knewport-retro-cable-guide.png`. These checks establish browser behavior; TV rendering and remote-key delivery require observation on the TV.

See [CONTRIBUTING.md](CONTRIBUTING.md) and [AGENTS.md](AGENTS.md) for development conventions.

## Ongoing development pipeline

1. **Branch:** make a focused change under `native-tv/` and open a pull request.
2. **Checks:** GitHub Actions checks the interface's JavaScript syntax and runs the offline regression suite.
3. **Preview artifact:** a successful run provides `native-tv-preview-COMMIT_SHA.zip` in its artifacts. It contains only `index.html`, `home.css`, `home.js`, a `config.json` made from the shared example, the interface README, and the MIT license. Personal configuration and state are excluded. Artifacts are retained for 14 days.
4. **Public preview:** successful pushes to `main` publish those same six assets to Pages. Pull requests do not publish. Personal state and configuration never enter the deployed bundle.
5. **TV verification:** use the matching revision, open it through the paired launcher, and record the screen and remote controls actually observed. Local server tests also record the readiness callback.
6. **Future release:** publish release notes with the tested behavior and remaining limits. A firmware installer or persistent TV deployment remains a separate milestone.

For local development, the Node preview command above is the quickest route. The downloaded artifact is a flat static bundle that can also be served by a local HTTP server; opening its HTML directly as a file may prevent its configuration request from working.

## Next milestones

- Confirm whether the current HTTPS guide appears on the physical TV.
- Validate screen layout, remote keys, and return-to-Home behavior on the exact target firmware.
- Populate a small catalog using application identifiers observed on that TV.
- Investigate a reversible internal hosting or installation route, with backups and observed restart behavior before calling it persistent.

Personal continuous channels and a media-server setup are deferred. The current guide stays available from GitHub Pages without keeping a PC running.

## Primary references

- VIZIO's own [SmartCast app launcher](https://vizio-pm.s3-us-west-1.amazonaws.com/conjure-launcher.html).
- true[X]'s [retail SmartCast deployment guide](https://github.com/socialvibe/truex-ctv-web-reference-app/blob/develop/platforms/Vizio/README.md).
- [SmartCast API documentation](https://github.com/exiva/Vizio_SmartCast_API).
- [Vizio Open Home](https://github.com/jordanmateo-byte/vizio-open-home): a native Home modification reported on M657-G0, SX7B, firmware 7.0.120.1-1. Its hardware validation does not establish compatibility with this TV.
- [ELTON's USB CGI research](https://www.eltoncyber.com/advisories/vizio-tv-code-execution-from-a-usb-drive): demonstrated on other VIZIO models.
- [ViziOwn research](https://bh2017.exploitee.rs/2021/viziown-exploiting-vizio-smartcast/): historical root route; the named installation endpoint is not present at its old path on this device.

## License

Original project code is provided under the MIT license in `LICENSE`. Protocol documentation is cited as evidence; no third-party firmware, signing keys or proprietary binaries are bundled.

