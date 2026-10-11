# Installation review - 2026-10-10

This document preserves the October 10 pre-installation review. Sunshine and ViGEmBus were installed later that day. As of October 11, Sunshine 2026.914.233613 and the signed ViGEmBus driver 1.21.442.0 were healthy, with Xbox 360 virtual-controller output configured. See the [validation record](VALIDATION.md) for current observations.

The MSI and firewall details below describe the reviewed installation route. They do not certify every current firewall rule or establish end-to-end TV streaming. The first TV smoke-test result is pending.

One approved process-only PowerShell override was used for project verification and ended. Persistent execution policies remain unchanged.

## Inspected download

[Official Sunshine release](https://github.com/LizardByte/Sunshine/releases/tag/v2026.914.233613)

Asset: `Sunshine-Windows-AMD64-installer.msi`, 33,710,080 bytes.

SHA256 verified against the release metadata:

```text
1d7fed8beecd5889dc7ff14cf9f42d6d38f37c3066c13c6c2a5f4e91847e0ccf
```

Authenticode verification returned Valid for the official installer.

Installer and upstream source copies are outside the project repository.

## Verified MSI feature selection

Inspection of the actual MSI found the optional feature `CM_C_firewall`, shown as **Scripts > Add Firewall Exclusions**. It can be deselected. No previous Sunshine installation was found during the pre-installation inspection.

The reviewed plan called for the official MSI with that feature omitted, followed by separately approved narrow rules in the [LAN proposal](NETWORK-PROPOSAL.md). The earlier conclusion that no firewall-skip route had been verified is superseded by this MSI inspection. The unsupported lite ZIP is no longer part of the plan.

The MSI inspection established that this option exists. Installation is now complete; the installed state and any current firewall rules need their own verification rather than being inferred from this plan.

## Other installer effects

The tagged upstream setup source includes installation-root permission changes, a system PATH update, configuration migration, Sunshine service installation/start, and an autostart helper. Omitting the firewall feature does not authorize or eliminate those other effects.

The default firewall helper adds two enabled inbound program rules for `sunshine.exe`, one TCP and one UDP, without explicit profile, remote-address, or local-port restrictions. The plan avoids those broad exclusions by omitting the optional MSI firewall feature.

Service setup can create or reconfigure `SunshineService`, remove the legacy `SunshineSvc` if present, and start the service. The later autostart helper sets `SunshineService` to automatic startup. That service/startup behavior must be included in the installation approval.

Sources:

- [Installer source](https://raw.githubusercontent.com/LizardByte/Sunshine/v2026.914.233613/cmake/packaging/wix_resources/sunshine-installer.wxs)
- [Setup script](https://raw.githubusercontent.com/LizardByte/Sunshine/v2026.914.233613/src_assets/windows/misc/sunshine-setup.ps1)
- [Default firewall helper](https://raw.githubusercontent.com/LizardByte/Sunshine/v2026.914.233613/src_assets/windows/misc/firewall/add-firewall-rule.bat)
- [Service helper](https://raw.githubusercontent.com/LizardByte/Sunshine/v2026.914.233613/src_assets/windows/misc/service/install-service.bat)
- [Autostart helper](https://raw.githubusercontent.com/LizardByte/Sunshine/v2026.914.233613/src_assets/windows/misc/autostart/autostart-service.bat)

## Controller driver

The pre-installation review selected the official [ViGEmBus 1.22.0 release](https://github.com/nefarius/ViGEmBus/releases/tag/v1.22.0). The installed driver was later observed as version 1.21.442.0, signed and healthy. The release-package version and observed driver version are recorded separately.

ViGEmBus is a kernel-mode virtual-controller driver whose project is retired. It is end-of-life and no longer maintained; see the author's [end-of-life statement](https://docs.nefarius.at/projects/ViGEm/End-of-Life/). Installation was a separate approval decision. Xbox 360 virtual-controller output is now configured, but end-to-end controller input and advanced DualSense features remain unverified.

## Review gates and current status

1. **Completed:** The original helper scripts passed all 20 tests. The inventory and sample report ran in one approved temporary PowerShell process, which ended. See the [validation record](VALIDATION.md).
2. **Sunshine installed:** The review covered the official MSI, optional `CM_C_firewall` feature and remaining system/service/startup effects. Current host observations are in the validation record.
3. **Firewall scope to verify:** The [LAN proposal](NETWORK-PROPOSAL.md) describes the reviewed program/interface/exact-client-IP scope, with no remote web UI, UPnP or router port forwarding. This review does not certify the current rules.
4. **Controller driver installed:** Signed driver version 1.21.442.0 was observed healthy; the maintenance risk remains relevant.
5. **TV result pending:** Pairing, controller checks, video and audio must be verified from the real Moonlight session.

This record is documentation, not permission for additional system or security changes.

## Rollback plan

Before approved installation, record the original service and firewall state privately. Use Windows Installed Apps to uninstall Sunshine if needed, then verify its service and project-created rules were removed. Remove only changes documented as created for this project. The network profile stays Public throughout the proposed route. Keep user game files and unrelated firewall rules intact.

If ViGEmBus is separately approved and installed, document its own uninstall path and verification. Do not treat removal of Sunshine as removal of the controller driver.
