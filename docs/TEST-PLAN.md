# First real stream

Status: pending approval, client setup, and display check. No performance claims yet.

1. Connect the onn 4K Plus (2025) by HDMI to the user-confirmed Vizio V405-H19 and verify the 1080p60 input mode. For the first test, set Game Low Latency to On and record the setting, following the [Vizio manual](https://cdn.vizio.com/user-manual/PDF/2020/TV/V5-Series_V405-H9_V405-H19_V505-H9_V505-H19_V605-H3_V655-H4_V655-H9_V655-H19_V705-H3_V705-H13_UM-ENG.pdf). This is a planned setting, not a completed check or measured display latency.
2. Install [Moonlight Game Streaming](https://play.google.com/store/apps/details?id=com.limelight) from Google Play on the client. Confirm the listing is by Cameron Gutman and the app ID is `com.limelight`. After explicit approval, install Sunshine with the optional `CM_C_firewall` feature (Scripts > Add Firewall Exclusions) deselected, as recorded in the [installation review](INSTALLATION-REVIEW.md).
3. Keep host and client on the intended home LAN. Prefer Ethernet on the host where physically available. A 433.3 Mbps Wi-Fi link rate is not a throughput test. Keep the current Public network profile. Before pairing, verify the approved program/interface/exact-client-IP rules in the [LAN proposal](NETWORK-PROPOSAL.md). If the host interface or client IP changes, review the rule scope again.
4. Pair Moonlight with Sunshine using the displayed PIN and human-controlled Sunshine credentials. Do not put credentials or PINs in the repository.
5. Pair the DualSense to the client. Verify menus, face buttons, both sticks, triggers and disconnect/reconnect. Do not assume advanced DualSense features are supported. ViGEmBus is currently absent. The proposed free route uses official ViGEmBus 1.22.0, an end-of-life kernel driver; review its risks and obtain explicit approval before installing it. See the [controller-driver review](INSTALLATION-REVIEW.md#controller-driver).
6. Start H.264, 1920x1080, 60 FPS, SDR. Record the selected bitrate and actual session duration. Capture Moonlight's available performance-overlay values manually.
7. Run a repeatable scene for five minutes after warmup. Record average FPS, network latency, decode latency and dropped-frame percentage only if the overlay exposes those values with matching units. Otherwise leave fields blank.
8. Check controller input and audio/video sync. Repeat after changing exactly one variable. Network tests alone do not establish end-to-end input latency.
9. Generate a report from measured rows. Keep raw local results excluded from Git. Review the report before publishing any selected, sanitized findings.

Success criteria should be chosen before comparing runs: stable interaction without recurring freezes or disconnects, acceptable visual quality and controller response, and repeatable observations. This project intentionally does not invent universal latency thresholds.
