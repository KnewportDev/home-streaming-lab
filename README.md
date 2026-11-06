# Home Media Lab

Windows troubleshooting, PowerShell automation, and networked-TV development — with source, test coverage, and explicit verification limits.

This personal lab contains two projects. Start with the evidence below, then follow the project guides for setup and implementation details.

## Projects

### Vizio Native
**Node.js · JavaScript · HTML/CSS · LAN discovery**

A custom 2000s cable-guide interface intended for the VIZIO TV’s own browser, with a blue listing grid, yellow selection, program details, and clearly labeled sample channels. It is supported by bounded discovery, device inspection, and PIN-pairing tools. A Windows state-file failure is documented alongside its regression coverage.

[Project guide](native-tv/README.md) · [Debugging case](native-tv/docs/ENGINEERING-NOTES.md#windows-pairing-state-write-failure) · [Source and tests](native-tv/tools/) · [Preview workflow](.github/workflows/native-tv.yml)

**Status:** 39 offline tests pass, including five cable-guide navigation and timeline checks. PIN pairing succeeded and the TV accepted an authenticated app 17 launch. The local page did not load: the TV displayed “no network detected,” and the PC has an explicit inbound Node.js firewall block. The [live HTTPS cable guide](https://knewportdev.github.io/home-streaming-lab/) is deployed and [its 39-test build passed](https://github.com/KnewportDev/home-streaming-lab/actions/runs/42144758476). Browser guide navigation, program details, and settings were verified. The TV’s authenticated current-app response reports app 17 with the public guide URL; its physical screen and remote behavior still need direct verification. Persistent installation remains unverified.

**Current scope:** finish the TV interface and use the TV or onn for everyday streaming. GitHub Pages hosts the guide, so it needs no continuously running PC web server. The guide currently contains labeled sample listings; personal media channels, real program data, and a continuously running channel server are deferred.

### PC-to-TV streaming
**Windows · PowerShell · Sunshine / Moonlight**

A streaming-host lab covering inventory, network planning, configuration troubleshooting, and session reporting. The clearest case study is a configuration key that looked correct but failed because of a UTF-8 byte-order mark.

[Streaming guide](docs/STREAMING-LAB.md) · [Troubleshooting case](docs/TROUBLESHOOTING-UTF8-BOM.md) · [PowerShell tools](scripts/) · [Validation record](docs/VALIDATION.md)

**Status:** the repository records a verified configuration repair, 20 report-calculation and input-validation checks, and a local PC game benchmark. TV streaming, audio, controller behavior, and end-to-end latency still require testing. Synthetic CSV examples are labeled as sample data.

## Evidence by skill

| Area | Inspect |
| --- | --- |
| Windows fault isolation | [Byte-level configuration diagnosis](docs/TROUBLESHOOTING-UTF8-BOM.md) and [state-file debugging](native-tv/docs/ENGINEERING-NOTES.md) |
| PowerShell automation | [Readiness checker](scripts/Test-HostReadiness.ps1), [report generator](scripts/New-StreamingReport.ps1), [checks](tests/Run-Tests.ps1) |
| Networking | [Bounded discovery](native-tv/tools/inspect-tv.cjs), [LAN proposal](docs/NETWORK-PROPOSAL.md), [stream test plan](docs/TEST-PLAN.md) |
| Repeatable verification | [Offline Node.js tests](native-tv/tools/) and [GitHub Actions definition](.github/workflows/native-tv.yml) |

## Working method

Make a small change, retain a recovery path, check the result, and record what remains unknown. AI assists with code, troubleshooting, and documentation; this portfolio does not claim wholly independent authorship. Test results and hardware observations are treated separately.

The native-TV guide uses the TV’s reported V405-H9 identity. Older streaming notes retain the earlier V405-H19 identification and their original dates.

## Run and read more

- [Native TV local preview and offline tests](native-tv/README.md#start-with-the-local-preview)
- [Streaming tools and full setup notes](docs/STREAMING-LAB.md#run-the-tools)
- [Streaming installation review](docs/INSTALLATION-REVIEW.md)
- [License](LICENSE) · [Native TV license and references](native-tv/README.md#license)

Sunshine and Moonlight are separate upstream projects; their source is not bundled here.
