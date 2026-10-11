# Proposed LAN configuration

Status as of October 11, 2026: this document records the reviewed LAN rule scope, not a verification of the currently deployed firewall rules. Sunshine and ViGEmBus are installed; see the [validation record](VALIDATION.md). The first TV smoke-test result is pending.

## Installation route

The reviewed installation plan called for the official Sunshine MSI with its optional `CM_C_firewall` feature deselected. The installer labels it **Scripts > Add Firewall Exclusions**. Inspection of the actual MSI confirmed that this feature can be omitted. No previous Sunshine installation was found during the pre-installation inspection.

This replaces the earlier lite-ZIP proposal. The unsupported lite package is no longer needed for the planned setup. Do not modify the MSI or install broad rules with the intention of tightening them afterward.

Omitting the firewall feature does not remove the installer's other effects. The [installation review](INSTALLATION-REVIEW.md) describes the installation, service/startup behavior and other effects considered before installation. Verify the actual resulting rules separately.

## Reviewed firewall scope

Keep the current network category **Public**. The plan does not change the adapter to Private.

Before adding rules, privately verify the active home-network interface, Sunshine's full executable path, and the onn client's exact current IP address. Those identifying values do not belong in this repository.

Create exactly two inbound allow rules, each restricted to all of the following:

- The verified full path of `sunshine.exe`
- The verified home-network interface
- The Public profile
- The onn client's exact verified IP address as the remote address
- `EdgeTraversalPolicy=Block`

The proposed rules are:

| Rule name | Protocol | Local ports |
| --- | --- | --- |
| Knewport-Sunshine-LAN-TCP | TCP | 47984, 47989, 48010 |
| Knewport-Sunshine-LAN-UDP | UDP | 47998, 47999, 48000 |

This is a single-client allowlist. Do not substitute `LocalSubnet`, all remote addresses, or all interfaces. If the client address or host interface changes, recheck the scope before updating the rules.

- Manually add the host in Moonlight initially. No additional discovery rule is included.
- Keep the web interface local with `origin_web_ui_allowed = pc`. Do not open remote access to web UI port 47990.
- Keep `upnp = disabled`. No router changes or internet port forwarding are included.
- Confirm that the default base port is still 47989 before using the port list. A custom base port needs its own review.
- Verify that the MSI did not add broad Sunshine firewall exclusions. If unexpected rules or installer behavior appear, stop and review them before pairing or streaming.

This proposal does not establish whether these exact rules are currently applied. Check the active configuration privately before relying on the proposed scope; keep identifying values out of the repository.

## Controller dependency

The installed ViGEmBus driver was observed as version 1.21.442.0, signed and healthy. The original review links the official 1.22.0 release package. This kernel driver is end-of-life. Xbox 360 virtual-controller output is configured; controller input through the TV client remains unverified. See the [installation review](INSTALLATION-REVIEW.md#controller-driver).

## Rollback

Record the original service state and relevant firewall state privately before any approved changes. Remove only the two uniquely named rules above if this project created them. Leave the network category Public; no profile change is planned.

If Sunshine is installed, use Windows Installed Apps to uninstall it and verify that its service and any project-created rules are removed. Do not assume uninstall removes custom rules. Handle any separately approved controller driver separately. Keep credentials, configuration, and game files until their owner decides what to retain.

## Evidence

The actual MSI feature table was inspected for the reviewed download identified in the [installation review](INSTALLATION-REVIEW.md). The tagged port table and source headers agree on TCP base-5/base/base+21 and UDP base+9 through base+11. The web UI is base+1 and is excluded from the proposed rules.

- [Sunshine release](https://github.com/LizardByte/Sunshine/releases/tag/v2026.914.233613)
- [Network configuration source](https://raw.githubusercontent.com/LizardByte/Sunshine/v2026.914.233613/src_assets/common/assets/web/configs/tabs/Network.vue)
- [HTTP ports](https://raw.githubusercontent.com/LizardByte/Sunshine/v2026.914.233613/src/nvhttp.h)
- [RTSP port](https://raw.githubusercontent.com/LizardByte/Sunshine/v2026.914.233613/src/rtsp.h)
- [Stream ports](https://raw.githubusercontent.com/LizardByte/Sunshine/v2026.914.233613/src/stream.h)
- [Sunshine setup documentation](https://docs.lizardbyte.dev/projects/sunshine/latest/md_docs_2getting__started.html)
- [Sunshine configuration documentation](https://docs.lizardbyte.dev/projects/sunshine/latest/md_docs_2configuration.html)
