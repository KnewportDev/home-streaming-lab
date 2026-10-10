# Troubleshooting: a UTF-8 BOM in a configuration file

During the Windows streaming-host setup on October 10, 2026, a configuration file looked correct in a normal PowerShell text view, but the startup log did not recognize its first key.

## Evidence and diagnosis

The file began with the three bytes `EF BB BF`: a UTF-8 byte-order mark (BOM). The startup log showed that the parser had included the corresponding `U+FEFF` character at the start of the first key. The visible key name therefore looked right while the parsed name was different.

The configuration had been written using Windows PowerShell 5.1's UTF-8 output behavior. A normal decoded text view hid the leading marker; comparing the bytes with the parser's log exposed the mismatch.

## Controlled repair

A backup was saved before changing the file. The service was stopped, and the text was written using UTF-8 without a BOM. The repair checked both file length and every remaining byte before restarting the service:

| Check | Observed result |
| --- | --- |
| Backup prefix | `EF BB BF` |
| Backup length | 48 bytes |
| Repaired length | 45 bytes |
| Remaining content | Identical to the backup after its first three bytes |
| After restart | The startup log recognized the first key; the service was running |

These are observations from the local incident, not illustrative command output. Raw configuration files and logs are kept private; installation paths, account information, network identifiers, and security-specific setting values are omitted.

## What this verifies

The repair removed exactly three leading bytes without changing the configuration's remaining content. Log recognition after the restart verified the specific parsing fix.

It does not establish that TV pairing, controller input, video quality, latency, or the full streaming configuration works. Those checks remain in the [test plan](TEST-PLAN.md) and [validation record](VALIDATION.md).

## Working method

This was an assisted setup session with owner approval for the elevated repair. This record documents the diagnostic evidence and controlled change; it does not claim that every step was performed independently by one person.

The useful support habit is to compare what the application parsed with the actual file bytes when a setting appears correct but is ignored, preserve a rollback copy, make the smallest verified change, and check the application's behavior after restarting.
