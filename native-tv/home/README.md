# Local Cable Guide for Vizio

An original, remote-oriented interface for the stock TV browser, inspired by 2000s Suddenlink cable guides. The deployed revision has labeled sample listings, My Apps, and Settings. Its [39-test build and Pages deployment](https://github.com/KnewportDev/home-streaming-lab/actions/runs/42144758476) passed at commit `25c58b0cd4fcbeb21e5a843c0c6d1df40ff42bd7`. Browser review verified the retro layout, directional navigation, program dialogs, Settings, and the empty app state. The [public preview](https://knewportdev.github.io/home-streaming-lab/) requires no always-on PC server. Actual TV-screen rendering remains unverified.

## Sample guide

Six sample channels span three half-hour columns. Program details sit at the upper left, with decorative CSS color bars in the upper-right preview pane. Blue cells represent regular programs, purple movies, green sports, and light blue kids; the focused program is yellow. Time headers and the clock follow local device time. Listings remain visibly labeled as samples: there is no connected TV feed, real schedule source, or playback. Enter opens an information dialog only. The actual configured app catalog is separate and remains empty.

## Runtime

For development, use the project's local preview server. For a TV test, the paired `launch-page` helper can request the public HTTPS Pages URL without a PC asset server. Alternatively, `serve-launch` serves the files from the PC and injects an execution receipt. Both routes leave native app controls disabled. An internal installation route would need separate model-specific verification; the reference project's internal origin is `http://127.0.0.1:12345`.

Local serving uses `config.json` beside the page; copy the shared example for initial setup. The public bundle uses only `config.example.json`, renamed to `config.json`. Its catalog is empty and native access is disabled. Up to 12 apps are accepted, each with a nonempty `label` and an observed `launch` object containing `NAME_SPACE`, `APP_ID`, and `MESSAGE`. Conjure's app 17 identifier is verified for the test launcher; no user-facing application catalog has been verified or populated.

Set `nativeBridge.enabled` to `true` only after native installation and interface support are verified. The origin guard requires precisely HTTP, host `127.0.0.1`, port `12345`. The fixed adapter calls local `http://127.0.0.1:7346/app/get_auth_token`, reads `ITEM.VALUE`, then sends `PUT /app/launch` with header `AUTH` and JSON `{ "VALUE": <observed launch object> }`. It requires `STATUS.RESULT` to equal `SUCCESS` before reporting **request accepted**. Tokens stay in memory for that launch and are never persisted. Public HTTPS pages cannot satisfy this origin guard. They fetch only their static assets and configuration; no TV credentials, analytics, or external assets are included.

## TV check screen

`tv-check.html` is a separate, self-contained page for observing page rendering, JavaScript execution, and physical remote input. It uses the same blue-and-yellow visual language. Open it through the public preview or the local development server; it requires no other assets or configuration. Use arrows and OK/Enter, then photograph the result on the television. Back returns to the guide.

Loading the check page makes no API or receipt request. Choosing **Check TV connection** makes one unauthenticated GET to the fixed TV-local device-information endpoint, with a three-second limit and a 128-KiB response cap. Only a matching V405-H9 / 1.720.9.1-1 response is reported as verified. No credentials, raw response, addresses, serial numbers, or full user agent are displayed or saved. A blocked, timed-out, or status-zero request is inconclusive about Internet access.

The main guide's origin guard is a deliberate project rule. It is not evidence that this H9 browser has blocked the request; the optional check measures that separately. A matching metadata result would establish only that particular browser-to-API read, not native app control, root, an installed Home, or boot behavior. All results stay on screen; `/app/current` cannot read them back.

## Remote

| Control | Behavior |
| --- | --- |
| Guide Left/Right | Move between programs; stop at the outside boundaries. |
| Guide Up/Down | Move between channels while preserving the logical half-hour slot across programs that span columns. Up from the first channel reaches Guide navigation. |
| Top navigation Left/Right | Move through Guide, My Apps, and Settings; landing on Guide or My Apps switches that view. Down enters the active view. |
| Enter/OK | Open the selected sample program's information, activate a navigation control, or request a configured app through the existing guarded adapter. Sample programs never start playback. |
| Back/Escape | Close an open dialog and restore its opener; otherwise open Settings. |
| Tab in a dialog | Keep focus inside the dialog. |

Settings changes only appearance and shows available device details. It sends no TV settings command. With no configured apps, My Apps remains an honest empty state. The page uses system fonts and ES5-style JavaScript. Directional navigation, dialogs, Settings, and the app empty state were verified in the deployed browser preview; physical TV remote behavior still needs verification.

## Appearance and development

The design was revised on **5 November 2026** from Media Center/Aero to a 2000s cable-guide layout. The reference is the provider-hosted [classic i-Guide manual](https://www.wadsworthcity.com/DocumentCenter/View/1540/I-Guide-Manual---Manual-for-the-Digital-Guide-Our-Digital-Settop-Boxes-Use-PDF). Branding, CSS, and sample data are original. Cable Blue, Night Guide, and Classic Gray use the stable internal keys `sage`, `glacier`, and `amber`, respectively. Only the chosen accent is stored, under `local-home.cable-accent`; no credentials are stored by the page. Storage failure leaves the interface usable for the current session.

From the `native-tv` project directory, run `node tools/preview-home.cjs`, then open the printed localhost URL on that computer. It serves only the four interface assets and never sends commands to the TV. Restart the preview process after editing files. This browser preview does not prove on-TV compatibility.

The [current Pages build](https://github.com/KnewportDev/home-streaming-lab/actions/runs/42144758476) passed 39 tests with zero failures or skips and deployed commit `25c58b0cd4fcbeb21e5a843c0c6d1df40ff42bd7`. The five checks in `tools/test-home-guide.cjs` also passed on Windows, in addition to the earlier separate 24-test Windows session suite. Browser review covered this cable-guide revision, with a local capture retained as `knewport-retro-cable-guide.png`. The previous CI baseline remains [34 passing tests](https://github.com/KnewportDev/home-streaming-lab/actions/runs/42125250207).

No actual television feed or EPG is connected. Personal continuous channels and a media server are deferred; the public HTTPS guide remains usable without a PC serving its assets.

## Primary compatibility evidence

- [Open Home architecture](https://github.com/jordanmateo-byte/vizio-open-home/blob/main/docs/ARCHITECTURE.md): stock-browser HTML/CSS/JS runtime and internal static origin. Its published hardware validation is M657-G0 / SX7B firmware 7.0.120.1-1, not V405-H9.
- [Open Home runtime source](https://github.com/jordanmateo-byte/vizio-open-home/blob/main/src/runtime.js): exact local authorization and app-launch endpoints, request body, token extraction and success response.
- [Exiva SmartCast API](https://github.com/exiva/Vizio_SmartCast_API): external paired SmartCast control API. This package uses the on-TV local interface above, not external HTTPS control.

The interface and implementation here are original. Native integration follows the cited protocol evidence. There are no copied upstream assets, app identifiers or installed vendor components. Actual firmware behavior, remote key delivery, origin policy, local API access and installation persistence still require verification on the target TV. No root, flash or boot modification has been performed by this package.

## License — MIT

Copyright (c) 2026 Knewport and contributors

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## Local execution receipt

The local `serve-launch` server injects a same-origin `GET telemetry?event=ready` receipt. Only a callback from the expected TV is recorded as `tv_javascript_ready`; a PC request does not count. This verifies execution of the injected callback, while screen appearance and remote behavior require direct observation. Public static files contain no receipt request. The page does not use cookies. Optional local `device` configuration supplies model/firmware information. The sample-listing label remains visible independently of the actual app catalog.

## Current hardware identification

A read-only device-information check reported model `V405-H9`, firmware `1.720.9.1-1`, ViziOS `mtk5691-1.6.1770.1`. Pairing succeeded. The latest authenticated `/app/current` read returned `SUCCESS`, app 17 / namespace 4, and the exact public guide URL in `MESSAGE`; no new launch request was sent during that check. A separate PC request received HTTP 200 and the expected guide markup. The PC-hosted attempt previously failed to render; Windows has an explicit inbound Node block and no firewall changes were made. The cable-guide revision is deployed and browser-verified. Actual TV rendering, physical remote behavior, native loopback compatibility, root access, and persistent installation remain unestablished.
