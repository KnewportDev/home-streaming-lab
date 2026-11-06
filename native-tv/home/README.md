# Local Cable Guide for Vizio

An original, remote-oriented interface for the stock TV browser, following the user's 2000s Suddenlink-style cable-guide direction. The current revision adds labeled sample listings and retains My Apps and Settings. Its 39-test offline suite passes; browser and TV-screen checks of this revision are pending. The [public preview](https://knewportdev.github.io/home-streaming-lab/) and pairing/launch pipeline were verified on the previous interface revision; that evidence does not verify the new skin.

## Sample guide

Six sample channels span three half-hour columns. Program details sit at the upper left, with decorative CSS color bars in the upper-right preview pane. Blue cells represent regular programs, purple movies, green sports, and light blue kids; the focused program is yellow. Time headers and the clock follow local device time. Listings remain visibly labeled as samples: there is no connected TV feed, real schedule source, or playback. Enter opens an information dialog only. The actual configured app catalog is separate and remains empty.

## Runtime

For development, use the project's local preview server. For a TV test, the paired `launch-page` helper can request the public HTTPS Pages URL without a PC asset server. Alternatively, `serve-launch` serves the files from the PC and injects an execution receipt. Both routes leave native app controls disabled. An internal installation route would need separate model-specific verification; the reference project's internal origin is `http://127.0.0.1:12345`.

Local serving uses `config.json` beside the page; copy the shared example for initial setup. The public bundle uses only `config.example.json`, renamed to `config.json`. Its catalog is empty and native access is disabled. Up to 12 apps are accepted, each with a nonempty `label` and an observed `launch` object containing `NAME_SPACE`, `APP_ID`, and `MESSAGE`. Conjure's app 17 identifier is verified for the test launcher; no user-facing application catalog has been verified or populated.

Set `nativeBridge.enabled` to `true` only after native installation and interface support are verified. The origin guard requires precisely HTTP, host `127.0.0.1`, port `12345`. The fixed adapter calls local `http://127.0.0.1:7346/app/get_auth_token`, reads `ITEM.VALUE`, then sends `PUT /app/launch` with header `AUTH` and JSON `{ "VALUE": <observed launch object> }`. It requires `STATUS.RESULT` to equal `SUCCESS` before reporting **request accepted**. Tokens stay in memory for that launch and are never persisted. Public HTTPS pages cannot satisfy this origin guard. They fetch only their static assets and configuration; no TV credentials, analytics, or external assets are included.

## Remote

| Control | Behavior |
| --- | --- |
| Guide Left/Right | Move between programs; stop at the outside boundaries. |
| Guide Up/Down | Move between channels while preserving the logical half-hour slot across programs that span columns. Up from the first channel reaches Guide navigation. |
| Top navigation Left/Right | Move through Guide, My Apps, and Settings; landing on Guide or My Apps switches that view. Down enters the active view. |
| Enter/OK | Open the selected sample program's information, activate a navigation control, or request a configured app through the existing guarded adapter. Sample programs never start playback. |
| Back/Escape | Close an open dialog and restore its opener; otherwise open Settings. |
| Tab in a dialog | Keep focus inside the dialog. |

Settings changes only appearance and shows available device details. It sends no TV settings command. With no configured apps, My Apps remains an honest empty state. The page uses system fonts and ES5-style JavaScript. These are the new keyboard behavior contracts; current browser and TV verification are pending.

## Appearance and development

The design was revised on **5 November 2026** from Media Center/Aero to a 2000s cable-guide layout. The reference is the provider-hosted [classic i-Guide manual](https://www.wadsworthcity.com/DocumentCenter/View/1540/I-Guide-Manual---Manual-for-the-Digital-Guide-Our-Digital-Settop-Boxes-Use-PDF). Branding, CSS, and sample data are original. Cable Blue, Night Guide, and Classic Gray use the stable internal keys `sage`, `glacier`, and `amber`, respectively. Only the chosen accent is stored, under `local-home.cable-accent`; no credentials are stored by the page. Storage failure leaves the interface usable for the current session.

From the `native-tv` project directory, run `node tools/preview-home.cjs`, then open the printed localhost URL on that computer. It serves only the four interface assets and never sends commands to the TV. Restart the preview process after editing files. This browser preview does not prove on-TV compatibility.

The [previous Pages build](https://github.com/KnewportDev/home-streaming-lab/actions/runs/42125250207) passed 34 tests and deployed commit `3344fc26faae28eee06c36cd209a1da2066055ac`. Earlier browser checks covered the previous Media Center interface, including Settings, Cobalt, and Escape/focus restoration. The current guide revision adds `tools/test-home-guide.cjs`; its five new checks pass, bringing the full offline suite to 39. Browser layout and deployment verification remain pending.

## Primary compatibility evidence

- [Open Home architecture](https://github.com/jordanmateo-byte/vizio-open-home/blob/main/docs/ARCHITECTURE.md): stock-browser HTML/CSS/JS runtime and internal static origin. Its published hardware validation is M657-G0 / SX7B firmware 7.0.120.1-1, not V405-H9.
- [Open Home runtime source](https://github.com/jordanmateo-byte/vizio-open-home/blob/main/src/runtime.js): exact local authorization and app-launch endpoints, request body, token extraction and success response.
- [Exiva SmartCast API](https://github.com/exiva/Vizio_SmartCast_API): external paired SmartCast control API. This package uses the on-TV local interface above, not external HTTPS control.

The interface and implementation here are original. Native integration follows the cited protocol evidence. There are no copied upstream assets, app identifiers or installed vendor components. Actual firmware behavior, remote key delivery, origin policy, local API access and installation persistence still require verification on the user's TV. No root, flash or boot modification has been performed by this package.

## License — MIT

Copyright (c) 2026 Local Home contributors

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## Local execution receipt

The local `serve-launch` server injects a same-origin `GET telemetry?event=ready` receipt. Only a callback from the expected TV is recorded as `tv_javascript_ready`; a PC request does not count. This verifies execution of the injected callback, while screen appearance and remote behavior require direct observation. Public static files contain no receipt request. The page does not use cookies. Optional local `device` configuration supplies model/firmware information. The sample-listing label remains visible independently of the actual app catalog.

## Current hardware identification

A read-only device-information check reported model `V405-H9`, firmware `1.720.9.1-1`, ViziOS `mtk5691-1.6.1770.1`. Pairing succeeded and an authenticated current-app read confirmed Conjure app 17 / namespace 4. The PC-hosted attempt did not render successfully; Windows has an explicit inbound Node block and no firewall changes were made. The previous Media Center interface was deployed over HTTPS, and its TV launch request was accepted. Actual TV rendering, the new cable-guide skin, native loopback compatibility, and persistent installation remain unverified.
