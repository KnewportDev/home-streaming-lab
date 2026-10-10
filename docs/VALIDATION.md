# Validation - 2026-10-10

Executed on Windows PowerShell 5.1.26100.9444.

- All four PowerShell source files parsed without syntax errors.
- All 20 tests passed: percentile behavior, missing values, provenance, invalid numbers, extra columns, duplicate IDs, codec/dimension validation, and generated-report labeling.
- The readiness checker completed at 18:23:08 UTC. Its output is local-only in results/host-inventory.local.json.
- The sample report was generated and inspected. The prominent SAMPLE DATA label is present; the missing decode metric remains not recorded. Median FPS is 59.7 for the synthetic example, not the host.
- One explicitly approved PowerShell process used Process=Bypass. It was exited. A subsequent process confirmed every policy scope remained Undefined, matching the original persistent configuration. No persistent policy was changed.

## Observed host

Ryzen 7 5800X, 8 cores / 16 logical processors; 31.9 GiB memory; Radeon RX 5700 XT, driver 32.0.21045.5002; Windows 11 Pro build 26200.

The wireless adapter negotiated 433.3 Mbps. Ethernet was disconnected. This is an adapter link-rate observation, not measured throughput.

At the initial 18:23 UTC inventory, Sunshine and ViGEmBus were not installed. Later on October 10, 2026, both were installed and verified running. Configuration validation remains pending; installation alone does not verify streaming or controller behavior.

The [installation review](INSTALLATION-REVIEW.md) records the pre-installation assessment. Sunshine and ViGEmBus installation is now complete. TV pairing, controller tests, and the first end-to-end stream have not been completed.

## Confirmed display

The TV model was confirmed by the owner as Vizio V405-H19 on October 10, 2026. Its HDMI behavior, Game Low Latency setting, and performance with this streaming setup have not yet been tested.

## Still pending

Configuration validation, onn 4K Plus (2025) setup and TV pairing, Vizio display capabilities, DualSense input tests, and real Moonlight session measurements. The client purchase was confirmed later on October 10, 2026; it has not yet been tested with this setup. Start with H.264 1080p60 SDR; do not assume 4K or HEVC works because the client package advertises those formats.
