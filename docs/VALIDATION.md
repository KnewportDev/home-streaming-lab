# Validation record

Last updated: October 11, 2026. Local host and game checks are recorded separately from TV streaming tests.

## PowerShell checks - October 10

Executed on Windows PowerShell 5.1.26100.9444.

- All four PowerShell source files parsed without syntax errors.
- All 20 tests passed: percentile behavior, missing values, provenance, invalid numbers, extra columns, duplicate IDs, codec/dimension validation, and generated-report labeling. These are automated report-calculation and input-validation checks, not streaming/controller tests or a comprehensive test suite for the host readiness checker.
- The readiness checker completed at 18:23:08 UTC. Its output is local-only in results/host-inventory.local.json.
- The sample report was generated and inspected. The prominent SAMPLE DATA label is present; the missing decode metric remains not recorded. Median FPS is 59.7 for the synthetic example, not the host.
- One explicitly approved PowerShell process used Process=Bypass. It was exited. A subsequent process confirmed every policy scope remained Undefined, matching the original persistent configuration. No persistent policy was changed.

## Observed host

Ryzen 7 5800X, 8 cores / 16 logical processors; 31.9 GiB memory; Radeon RX 5700 XT, driver 32.0.21045.5002; Windows 11 Pro build 26200.

The wireless adapter negotiated 433.3 Mbps. Ethernet was disconnected. This is an adapter link-rate observation, not measured throughput.

At the initial 18:23 UTC inventory on October 10, Sunshine and ViGEmBus were absent. Both were installed later that day. The [installation review](INSTALLATION-REVIEW.md) preserves the pre-installation assessment and links it to the current status.

## Host setup - October 11

- CPU: Ryzen 7 5800X.
- GPU: Radeon RX 5700 XT with 8 GB VRAM.
- Memory: 32 GB installed; 31.9 GiB reported by the inventory.
- Sunshine: version 2026.914.233613, installed and healthy.
- ViGEmBus: installed driver version 1.21.442.0, signed and healthy. This is the observed driver version; the pre-installation review links the 1.22.0 release package.
- Sunshine controller output: Xbox 360 virtual controller configured. No controller remapper was known to be active during these checks.

These checks establish the recorded host state. Successful DualSense input through Moonlight still needs an end-to-end test.

## Configuration troubleshooting

A UTF-8 byte-order mark caused the first configuration key to be parsed with an extra leading character. A backed-up, three-byte-only repair was verified against the original bytes; the restarted service log recognized the corrected key. See the [incident record](TROUBLESHOOTING-UTF8-BOM.md). This specific repair is verified; broader configuration validation and end-to-end streaming tests remain pending.

## Confirmed display

The TV model was confirmed by the owner as Vizio V405-H19 on October 10, 2026. Its HDMI behavior, Game Low Latency setting, and performance with this streaming setup have not yet been tested.

## Game installation

At 22:07 UTC on October 10, 2026, the Rockstar launcher offered Play for Red Dead Redemption 2, and its executable and game archives were present on the hard drive. This verifies installation only. At that point, the game had not been launched. The October 11 local benchmark below supersedes that launch status; TV streaming, controller input through the TV client, and latency remain unverified.

## Local RDR2 benchmark - October 11

Red Dead Redemption 2, Rockstar edition, ran its built-in benchmark on the PC. Holding X for about four seconds started the benchmark.

| Setting | Recorded value |
| --- | --- |
| Output resolution | 1920×1080 |
| Graphics API | Vulkan |
| HDR | Off |
| Textures | Ultra |
| TAA | High |
| Shadows | High |
| Anisotropic filtering | 16× |

Only the settings above are recorded here; this is not a complete exported graphics configuration. Upscaling and other unlisted settings are not asserted.

| Built-in benchmark metric | FPS |
| --- | ---: |
| Average | 95.35 |
| Minimum | 32.57 |
| Maximum | 139.89 |

This is one local game benchmark. The minimum is the game's reported minimum FPS, not a 1% low. No frame-time distribution, repeat-run comparison, TV stream statistics or full controller-to-display latency was measured. The average does not establish a locked 60 FPS experience.

The numeric result is recorded here rather than in the streaming-session CSV, whose fields describe a Moonlight session. Raw logs, configuration files and screenshots remain private.

## Still pending

The five-minute TV smoke-test result has not been recorded. Confirm the onn/Moonlight connection, Vizio display settings, video stability, audio and sync, DualSense buttons/sticks/triggers, and disconnect/reconnect behavior. Do not mark the end-to-end path as passed until those observations are available.

The planned baseline remains H.264 1080p60 SDR. Record the actual codec, resolution, target frame rate, bitrate and duration used. Leave unavailable overlay metrics blank, and keep network/decode latency distinct from full input latency. See the [test plan](TEST-PLAN.md).
