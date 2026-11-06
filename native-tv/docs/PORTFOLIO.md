# Portfolio summary

## Project

**Vizio Native — a networked-TV development homelab**

An ongoing project to build a custom interface in a VIZIO TV's own browser and document what the actual hardware supports. The work combines LAN discovery, API integration, Windows troubleshooting, local credential handling, JavaScript interface development, and repeatable offline checks. The current design is a 2000s Suddenlink-style cable guide with clearly labeled sample listings; it does not provide television playback or a real schedule feed.

Public repository: [KnewportDev/home-streaming-lab](https://github.com/KnewportDev/home-streaming-lab), under `native-tv/`.

[Public preview](https://knewportdev.github.io/home-streaming-lab/) · [Previous verified build](https://github.com/KnewportDev/home-streaming-lab/actions/runs/42125250207)

## Resume bullet

Built a dependency-free Node.js homelab toolkit for VIZIO TV discovery and authenticated launch requests; diagnosed Windows state-write and network-delivery issues, built a 39-test offline suite, and implemented GitHub Actions preview packaging and Pages publishing.

## 60-second project explanation

“I wanted a custom home interface that could run in my TV's own browser, so I started by finding out what the hardware actually exposed. I built bounded SSDP discovery and GET-only metadata checks, then used those results to constrain the pairing client to the model and firmware I had observed.

“One useful debugging case was a pairing attempt that displayed a PIN on the TV but failed in the client. The problem was saving state: on the Windows machine, one numeric file-open flag combination returned EINVAL. I isolated that with disposable files, changed the update to use a checked file handle, and added a regression that runs offline.

“Pairing works, and the authenticated current-app API confirms Conjure after an accepted launch. The TV could not load the PC-hosted page, so I checked the delivery path and found an inbound Node block. I added public HTTPS delivery without changing the firewall, and verified a 34-test build and Pages deployment. The interface is now being revised into a 2000s cable guide, with sample listings and remote navigation. The five new guide checks bring the offline suite to 39 passing tests. Browser verification and actual TV-screen observation are the next milestones.”

## Evidence a reviewer can inspect

| Skill | Evidence |
| --- | --- |
| LAN discovery and request boundaries | [Inspection implementation](../tools/inspect-tv.cjs) and [discovery regression tests](../tools/test-inspect-tv.cjs). |
| API integration and recoverable state | [Pairing/session client](../tools/native-session.cjs) and [session tests](../tools/test-native-session.cjs). |
| Windows fault isolation | [Failure, fix, and validation notes](ENGINEERING-NOTES.md#windows-pairing-state-write-failure). |
| Interface development | [Cable-guide source and controls](../home/), labeled sample data, and the preview command in the [README](../README.md#start-with-the-local-preview). Current skin verification is pending. |
| Repeatable delivery | Repository-root `.github/workflows/native-tv.yml`: checks, six allowlisted preview assets, and main-only Pages publishing. [Run 42125250207](https://github.com/KnewportDev/home-streaming-lab/actions/runs/42125250207) passed the previous 34-test baseline and deployed commit `3344fc26faae28eee06c36cd209a1da2066055ac`. |

## Current result and next milestone

The target is V405-H9 on firmware `1.720.9.1-1`. PIN pairing completed, a launch request was accepted, and an authenticated read confirmed app 17 / namespace 4. The local attempt returned no callback and the owner reported “no network detected.” The source and HTTPS preview are public. Previous evidence includes 34 passing CI tests, 24 passing Windows session tests, and browser checks of the earlier Media Center interface. The TV accepted the HTTPS launch request, but on-TV rendering remains pending.

On **5 November 2026**, the design changed to a six-channel sample guide with three half-hour columns, yellow focus, a program-information panel, decorative color bars, and Guide/My Apps/Settings navigation. Cable Blue, Night Guide, and Classic Gray replace the earlier appearance labels. The new guide passes all five navigation and timeline tests, with 39 passing tests overall. Its browser verification and deployment are pending. The actual app catalog remains empty, with native API controls disabled in the public preview. Root access, firmware replacement, and a persistent Home modification have not been established.

As milestones are verified, update this summary with the tested commit and hardware observations. Use the linked implementation and engineering notes to explain the design decisions and remaining work.
