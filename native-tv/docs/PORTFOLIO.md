# Vizio Native — portfolio summary

A personal TV overhaul project combining a retro cable guide, LAN discovery, authenticated device control, and a GitHub development workflow. The goal is to have the VIZIO itself boot into a custom system, with a self-hosted media server added later.

[Repository](https://github.com/KnewportDev/home-streaming-lab) · [Browser preview](https://knewportdev.github.io/home-streaming-lab/) · [Native-system issue #1](https://github.com/KnewportDev/home-streaming-lab/issues/1)

## Resume bullet

Developing a VIZIO TV overhaul with dependency-free Node.js tools for LAN discovery, authenticated control, and private session storage; published a retro cable-guide interface through GitHub Actions with Linux and Windows checks, reproducible interface packaging, and documented native-system requirements.

## Project explanation

“I want my TV to boot into a system I control, starting with the blue-and-yellow cable guide I remember from the 2000s. The project uses the TV's reported model and firmware to guide compatibility work, and the source lives in my GitHub repository.

“The working pieces are a browser interface, bounded network discovery, ordinary PIN pairing, and authenticated launch requests. A useful troubleshooting case involved a PIN appearing on the TV while the client failed to save its state. Testing the file-open operation on Windows isolated an EINVAL error; the fix uses a checked file handle, with an offline regression for that failure.

“The guide is published on GitHub Pages, so it doesn't need a PC running to serve its assets. The development pipeline checks Linux and Windows before publishing. A separate TV check screen helps distinguish page loading, JavaScript, remote input, and local API access. The next stage is proving native execution and recovery on the actual TV before making anything persistent. A personal media server and real channel schedules come later.”

## Work covered

| Area | Implementation and evidence |
| --- | --- |
| Network discovery | Bounded SSDP searches, private IPv4 validation, and fixed metadata requests in [inspect-tv.cjs](../tools/inspect-tv.cjs). A regression covers the TV's bare port-9080 announcement. |
| Device API integration | Model/firmware checks, PIN pairing, private session state, and Conjure launch requests in [native-session.cjs](../tools/native-session.cjs). |
| Windows troubleshooting | [Engineering notes](ENGINEERING-NOTES.md#windows-pairing-state-write-failure) document the failed state write, the isolated file-operation test, and the checked-handle fix. |
| Interface development | [Guide source](../home/) implements directional navigation, visible focus, information dialogs, themes, and an empty app state. The listings are labeled samples. |
| Native capability research | [Platform inspection](../tools/inspect-native-platform.cjs) reads informational endpoints from the paired TV. [Native-system evidence](NATIVE-SYSTEM.md) records model-specific findings and missing proof. |
| Browser troubleshooting | [TV check screen](../home/tv-check.html) separates visible rendering and remote input from an optional bounded local metadata request, without credentials or telemetry. |
| Reproducible packaging | [Native preparation tool](../tools/package-native-home.cjs) assembles shared interface assets and a SHA-256 content manifest without private configuration or session data. |
| GitHub delivery | Repository-root `.github/workflows/native-tv.yml` runs offline checks, attaches artifacts, and publishes the browser preview from `main`. It has no TV credentials. |

## Results so far

The TV reports **V405-H9**, firmware **1.720.9.1-1**, and ViziOS **mtk5691-1.6.1770.1**. PIN pairing completed and an authenticated launch was accepted. A later current-app read reported Conjure app 17, namespace 4, and the exact public guide URL. These checks verify the control path; physical screen rendering and remote behavior still need observation.

The native-preparation baseline passed **57 Linux tests and 56 Windows tests** and deployed in [Actions run 42152947388](https://github.com/KnewportDev/home-streaming-lab/actions/runs/42152947388). Browser review covered the guide layout, directional navigation, program dialogs, Settings, and empty My Apps state. The inspector also completed all four informational requests on the actual TV; its [redacted report](evidence/native-platform-2026-11-06.json) is included as evidence.

An additional [seven-request inspection](evidence/native-network-2026-11-06.json) found that the TV reported a connected local network. The connection-type value remained unknown under the report's whitelist. This is a useful distinction when diagnosing the earlier network error, but it does not prove Internet access or browser rendering. The standalone check screen makes those separate observations visible on the TV.

The PC-hosted delivery test received no TV readiness callback. An inbound Node block was observed on Windows, and no firewall rules were changed. Public HTTPS delivery removes the need for a PC asset server. Detailed commands and pairing-state reuse are in [TV setup](TV-SETUP.md).

Root, a tested backup/restore procedure, bootloader control, an internal installation, and a permanent Home replacement remain unverified. The interface package is not a replacement OS. Those distinctions are part of the project record and determine the next hardware steps.

## Direction

Keep the Suddenlink-style guide as the interface while working toward native boot and local operation on the TV. First verify the screen and remote, then establish a supported execution path and recovery method. A complete system replacement also needs working support for the panel, inputs, audio, storage, networking, and power control.

A self-hosted server for personal media, schedules, and guide data is a later phase. No real television feed, playback source, or electronic program guide is connected yet, and no continuously running PC is required for the current public guide.

## References and licensing

The visual reference is the [classic i-Guide manual](https://www.wadsworthcity.com/DocumentCenter/View/1540/I-Guide-Manual---Manual-for-the-Digital-Guide-Our-Digital-Settop-Boxes-Use-PDF). Protocol work references [VIZIO's launcher](https://vizio-pm.s3-us-west-1.amazonaws.com/conjure-launcher.html), the [SmartCast API documentation](https://github.com/exiva/Vizio_SmartCast_API), and [Vizio Open Home](https://github.com/jordanmateo-byte/vizio-open-home). Its reported hardware support is for a different model and firmware. The [README](../README.md#references-and-credits) keeps the full research credits.

Original project code is [MIT licensed](../LICENSE). The source includes no third-party firmware or proprietary binaries.
