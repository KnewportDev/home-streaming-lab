# Local Media Center for Vizio

An original, remote-friendly interface for the stock TV browser, with an early-2000s Media Center appearance. The [public HTTPS preview](https://knewportdev.github.io/home-streaming-lab/) is deployed and checked in a desktop browser. On the V405-H9, PIN pairing and authenticated Conjure launch requests are verified; the TV accepted the HTTPS page request, while its screen remains unverified. The earlier PC-hosted attempt produced no readiness callback and the owner saw “no network detected.”

## Runtime

For development, use the project's local preview server. For a TV test, the paired `launch-page` helper can request the public HTTPS Pages URL without a PC asset server. Alternatively, `serve-launch` serves the files from the PC and injects an execution receipt. Both routes leave native app controls disabled. An internal installation route would need separate model-specific verification; the reference project's internal origin is `http://127.0.0.1:12345`.

Local serving uses `config.json` beside the page; copy the shared example for initial setup. The public bundle uses only `config.example.json`, renamed to `config.json`. Its catalog is empty and native access is disabled. Up to 12 apps are accepted, each with a nonempty `label` and an observed `launch` object containing `NAME_SPACE`, `APP_ID`, and `MESSAGE`. Conjure's app 17 identifier is verified for the test launcher; no user-facing application catalog has been verified or populated.

Set `nativeBridge.enabled` to `true` only after native installation and interface support are verified. The origin guard requires precisely HTTP, host `127.0.0.1`, port `12345`. The fixed adapter calls local `http://127.0.0.1:7346/app/get_auth_token`, reads `ITEM.VALUE`, then sends `PUT /app/launch` with header `AUTH` and JSON `{ "VALUE": <observed launch object> }`. It requires `STATUS.RESULT` to equal `SUCCESS` before reporting **request accepted**. Tokens stay in memory for that launch and are never persisted. Public HTTPS pages cannot satisfy this origin guard. They fetch only their static assets and configuration; no TV credentials, analytics, or external assets are included.

## Remote

Arrow keys navigate only populated tiles, with up to four columns on a TV. Up from the first row reaches the profile/settings button; Down returns to the selected tile. Enter/OK activates the focused control. Back (key codes 8, 27, 461, 10009) opens/closes Settings. The empty catalog shows one working This TV button beside a noninteractive empty state. Settings contains local appearance controls and the reported model/firmware; it sends no native settings command. Modal focus is contained and restored to its opener. In Settings, Up moves to Close, Down returns to the selected accent, and Left/Right moves between the accents. The page uses system fonts and ES5-style JavaScript.

## Appearance and development

The visual direction is early-2000s media-center software: blue glass, chrome edges, soft light trails and a strong remote-focus glow. Aqua, Cobalt and Silver are local accent choices. The stable internal theme keys are `sage`, `glacier` and `amber` respectively. Only the selected accent is stored, under `local-home.accent`; no credentials are stored by the page. Storage failure leaves the interface usable for the current session. The clock and greeting use the rendering device's local time.

From the `native-tv` project directory, run `node tools/preview-home.cjs`, then open the printed localhost URL on that computer. It serves only the four interface assets and never sends commands to the TV. Restart the preview process after editing files. This browser preview does not prove on-TV compatibility.

The [verified Pages build](https://github.com/KnewportDev/home-streaming-lab/actions/runs/42124719065) passed 34 tests and deployed commit `3dfa54ff948a9d4a8e867678b226c8c6ecef22ee`. On the live site, Settings opened, Cobalt changed the theme, and Escape closed the dialog and restored focus. Those observations were made in a desktop browser.

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

The local `serve-launch` server injects a same-origin `GET telemetry?event=ready` receipt. Only a callback from the expected TV is recorded as `tv_javascript_ready`; a PC request does not count. This verifies execution of the injected callback, while screen appearance and remote behavior require direct observation. Public static files contain no receipt request. The page does not use cookies. With an empty catalog it shows one working This TV control. `testMode` displays a Preview badge; optional local `device` configuration supplies model/firmware information.

## Current hardware identification

A read-only device-information check reported model `V405-H9`, firmware `1.720.9.1-1`, ViziOS `mtk5691-1.6.1770.1`. Pairing succeeded and an authenticated current-app read confirmed Conjure app 17 / namespace 4. The PC-hosted attempt did not render successfully; Windows has an explicit inbound Node block and no firewall changes were made. The public HTTPS page is deployed, and its TV launch request was accepted. Actual TV rendering, native loopback compatibility, and persistent installation remain unverified.
