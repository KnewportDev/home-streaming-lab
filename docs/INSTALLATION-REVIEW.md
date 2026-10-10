# Installation review - 2026-10-10

No Sunshine installer has been executed. No firewall, network-profile, router, or UPnP settings have been changed. ViGEmBus is not installed. Installation, firewall changes, driver installation, and streaming tests are still awaiting approval.

One approved process-only PowerShell override was used for project verification and ended. Persistent execution policies remain unchanged.

## Inspected download

[Official Sunshine release](https://github.com/LizardByte/Sunshine/releases/tag/v2026.914.233613)

Asset: `Sunshine-Windows-AMD64-installer.msi`, 33,710,080 bytes.

SHA256 verified against the release metadata:

```text
1d7fed8beecd5889dc7ff14cf9f42d6d38f37c3066c13c6c2a5f4e91847e0ccf
```

Authenticode verification returned Valid. Publisher certificate subject: CN=David Lane, O=David Lane, L=KISSIMMEE, S=Florida, C=US.

Installer and upstream source copies are outside the project repository.

## Verified MSI feature selection

Inspection of the actual MSI found the optional feature `CM_C_firewall`, shown as **Scripts > Add Firewall Exclusions**. It can be deselected. No previous Sunshine installation was found on the host.

The planned route is the official MSI with that feature omitted, followed by the separately approved narrow rules in the [LAN proposal](NETWORK-PROPOSAL.md). The earlier conclusion that no firewall-skip route had been verified is superseded by this MSI inspection. The unsupported lite ZIP is no longer part of the plan.

This is an inspected installation plan, not a completed installation. Confirm the feature selection before proceeding and verify the resulting rules afterward.

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

ViGEmBus is not installed. The proposed free controller route requires the official [ViGEmBus 1.22.0 release](https://github.com/nefarius/ViGEmBus/releases/tag/v1.22.0).

ViGEmBus is a kernel-mode virtual-controller driver whose project is retired. It is end-of-life and no longer maintained; review the author's [end-of-life statement](https://docs.nefarius.at/projects/ViGEm/End-of-Life/) before deciding whether to install it. Its installation requires separate explicit approval. No driver installation, successful controller emulation, or tested DualSense feature support is claimed here.

## Approval gates

1. **Completed:** The original helper scripts passed all 20 tests. The inventory and sample report ran in one approved temporary PowerShell process, which ended. See the [validation record](VALIDATION.md).
2. **Pending Sunshine installation:** Approve the inspected official MSI with `CM_C_firewall` deselected and its remaining system/service/startup effects.
3. **Pending firewall configuration:** Keep the current network profile Public. Approve only the specific program/interface/exact-client-IP rules in the [LAN proposal](NETWORK-PROPOSAL.md), with no remote web UI, UPnP, or router port forwarding.
4. **Pending controller driver:** Review and explicitly approve the official end-of-life ViGEmBus 1.22.0 route before installing it.
5. **Pending hardware tests:** Pairing, controller checks, and a real Moonlight session still need to happen after the relevant approvals and setup.

This review does not itself grant permission to execute any of those pending steps.

## Rollback plan

Before approved installation, record the original service and firewall state privately. Use Windows Installed Apps to uninstall Sunshine if needed, then verify its service and project-created rules were removed. Remove only changes documented as created for this project. The network profile stays Public throughout the proposed route. Keep user game files and unrelated firewall rules intact.

If ViGEmBus is separately approved and installed, document its own uninstall path and verification. Do not treat removal of Sunshine as removal of the controller driver.
