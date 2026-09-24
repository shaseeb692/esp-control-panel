# ESP Control Center â€” Master Brain & Roadmap

> This file is the permanent technical roadmap and architecture reference for

> the ESP Control Center smart-home platform.

>

> Last major architecture revision: September 2026

>

> Roadmap Status:

> - âœ… DONE

> - ðŸŸ¡ PARTIAL / NEEDS TESTING

> - ðŸ”„ REDO / ARCHITECTURE CHANGED

> - â¬œ TODO

> - ðŸ§ª HARDWARE TEST REQUIRED

---

# 1. PRODUCT VISION

Build a commercial, scalable smart-home platform where ESP8266/ESP32 devices

can be manufactured with common firmware builds, securely registered,

automatically discovered, claimed by users, assigned to houses/rooms,

controlled locally or through the cloud, and eventually controlled through

voice assistants.

Core principles:

- No manual Device ID entry by customer.

- No manual device type configuration by customer.

- No per-device firmware editing.

- Device capabilities are self-described.

- Frontend dynamically renders controls.

- Device identity is separate from Wi-Fi configuration.

- Wi-Fi reset must never erase factory identity.

- AP mode is setup only.

- Cloud and Local LAN are the two control modes.

- QR is fallback only, NOT the primary pairing method.

- Commercial architecture must scale to large device fleets.

---

# 2. CONTROL ARCHITECTURE

## Cloud Mode

User App / Browser

â†’ Backend

â†’ Device Command

â†’ ESP

â†’ Device Status

â†’ Backend

â†’ Realtime UI

## Local LAN Mode

User Browser

â†’ Same Router / LAN

â†’ ESP Local API

â†’ Physical Device

No router:

- App/browser control is unavailable.

- Physical/manual controls continue working.

---

# 3. DEVICE SETUP FLOW

Device powers ON.

If Wi-Fi credentials do not exist:

ESP

â†’ Setup AP Mode

â†’ Unique SSID such as ESP-Setup-A7K29F

â†’ User connects

â†’ 192.168.4.1

â†’ Select Home Wi-Fi

â†’ Save credentials

â†’ ESP connects to router

â†’ Device reaches cloud

â†’ Device registers/authenticates

â†’ Temporary pairing/discovery session

â†’ User opens Add Device

â†’ Available unclaimed device appears

â†’ User selects device

â†’ Select House

â†’ Select Room

â†’ Claim Device

â†’ Done

If Wi-Fi credentials already exist:

ESP

â†’ Attempt saved Wi-Fi

â†’ Connected

â†’ Normal Mode

If router is unavailable:

ESP keeps retrying saved Wi-Fi.

ESP MUST NOT automatically enter setup AP.

Physical SETUP button can manually enter setup AP.

---

# 4. FACTORY IDENTITY ARCHITECTURE

Production uses TWO firmware stages.

## Stage 1 â€” Birth Firmware

Factory flashes:

birth-firmware.bin

Responsibilities:

- Read ESP Chip ID.

- Generate unique DEVICE_ID.

- Generate random 256-bit DEVICE_SECRET.

- Generate integrity material.

- Store permanent identity.

- Provide factory/testing commands.

- Does NOT need internet.

- Does NOT need database access.

Current DEVICE_ID format:

PH-7XXXXXX

where XXXXXX is derived from ESP Chip ID.

## Stage 2 â€” Final Product Firmware

Factory flashes:

final-firmware.bin

Responsibilities:

- Read existing factory identity.

- Validate identity.

- NEVER generate factory identity.

- NEVER expose DEVICE_SECRET.

- Missing/invalid identity = LOCKED DEVICE.

- Run Wi-Fi setup.

- Run local control.

- Connect to cloud.

- Register/authenticate device.

Production flashing MUST preserve the identity storage area.

---

# 5. ROADMAP â€” 103 POINTS

## FOUNDATION

1. âœ… Define smart-home platform concept.

2. âœ… Select Next.js frontend.

3. âœ… Select Supabase backend/database.

4. âœ… Implement Supabase authentication.

5. âœ… Implement login flow.

6. âœ… Implement signup flow.

7. âœ… Implement password reset flow.

8. âœ… Create authenticated dashboard.

9. âœ… Create House architecture.

10. âœ… Create Room architecture.

## DEVICE MODEL

11. âœ… Create Devices architecture.

12. âœ… Create device capabilities architecture.

13. âœ… Define generic control IDs.

14. âœ… Support switch/toggle controls.

15. âœ… Support button controls.

16. âœ… Support slider controls.

17. âœ… Support number controls.

18. âœ… Remove requirement for hard-coded Motor1/Motor2 UI.

19. âœ… Device capabilities drive frontend controls.

20. ðŸŸ¡ Continue standardizing commercial device capability definitions.

## UI / UX

21. âœ… Create dynamic DeviceControlPanel.

22. âœ… Create device status UI.

23. âœ… Create control command UI.

24. âœ… Create device settings architecture.

25. âœ… Create time-based MasterThemeProvider.

26. âœ… Create dashboard sky gradient system.

27. âœ… Create glass/glassSoft/muted theme system.

28. âœ… Apply theme to authentication pages.

29. âœ… Create weather detail page architecture.

30. ðŸŸ¡ Continue UI consistency across remaining pages.

## COMMAND SYSTEM

31. âœ… Create device_commands architecture.

32. âœ… Create browser-authenticated /api/command.

33. âœ… Validate user ownership before command creation.

34. âœ… Store commands as pending.

35. âœ… ESP command polling architecture tested.

36. âœ… ESP status update architecture tested.

37. âœ… Supabase Realtime device status.

38. ðŸŸ¡ Improve command acknowledgement/retry architecture.

39. ðŸŸ¡ Improve device command failure reporting.

40. â¬œ Production command delivery optimization.

## DEVICE STATUS / ONLINE SYSTEM

41. âœ… Create device_status architecture.

42. âœ… Implement status JSON.

43. âœ… Implement online status concept.

44. âœ… Create /api/device/status.

45. âœ… Protect device status endpoint with device API authentication prototype.

46. ðŸ”„ Replace prototype/global device API authentication with per-device identity authentication.

47. ðŸŸ¡ Implement event-driven heartbeat architecture.

48. ðŸŸ¡ Implement exact stale timeout per device.

49. â¬œ Production offline/online transition handling.

50. â¬œ Device health telemetry.

## SCHEDULES

51. âœ… Design schedules per control.

52. âœ… Multiple schedules per control supported conceptually.

53. âœ… Day-of-week repeat architecture.

54. âœ… Everyday = all seven days.

55. âœ… Cross-midnight schedule semantics defined.

56. ðŸŸ¡ Supabase remains schedule source of truth.

57. â¬œ ESP compact schedule synchronization.

58. â¬œ ESP schedule RAM execution.

59. â¬œ Optional debounced flash schedule snapshot.

60. â¬œ Full schedule offline execution testing.

## DEVICE OWNERSHIP & SECURITY

61. âœ… Create device_registry.

62. âœ… Create device_claim_tokens.

63. âœ… Create device security foundation.

64. âœ… Implement secret versioning.

65. âœ… Implement lifecycle_state.

66. âœ… Implement hardware_model.

67. âœ… Implement firmware_version.

68. âœ… Implement registry metadata.

69. âœ… Implement verify_device_secret RPC foundation.

70. âœ… Implement token revocation architecture.

## ORIGINAL CLAIM SYSTEM

71. âœ… Create claim page.

72. âœ… Create ClaimDeviceClient.

73. âœ… Implement QR scanner.

74. âœ… Install html5-qrcode.

75. âœ… Fix browser camera Permissions-Policy.

76. âœ… Create /api/device/claim-session.

77. âœ… Create /api/device/claim.

78. âœ… Create transactional complete_device_claim RPC.

79. ðŸ”„ QR-primary claim flow deprecated.

80. ðŸ”„ Convert QR claim system into automatic discovery/pairing with QR retained only as fallback.

## TWO-STAGE FACTORY IDENTITY

81. âœ… Build Birth Firmware source.

82. âœ… Generate factory DEVICE_ID from ESP Chip ID.

83. âœ… Generate random 256-bit DEVICE_SECRET.

84. âœ… Generate factory identity integrity material.

85. âœ… Store factory identity separately from Wi-Fi configuration.

86. âœ… Add Birth Firmware identity test/recovery commands.

87. âœ… Birth Firmware compile successful.

88. âœ… Build Stage-2 Final Firmware source.

89. âœ… Stage-2 reads/verifies identity and does NOT generate it.

90. ðŸŸ¡ Ensure production Stage-2 flashing method preserves EEPROM identity storage.

## HARDWARE VALIDATION

91. ðŸ§ª Flash Birth Firmware on real ESP and verify Stage-1 â†’ Stage-2 identity persistence.

Required test:

Birth Firmware

â†’ generate identity

â†’ record DEVICE_ID

â†’ flash Stage-2 without full erase

â†’ Stage-2 reads same DEVICE_ID

â†’ integrity valid

â†’ secret hidden

â†’ Wi-Fi reset

â†’ identity still survives

Also test Stage-2 ERASE_IDENTITY recovery behavior.

## CLOUD REGISTRATION

92. â¬œ Build first-internet device registration endpoint.

ESP after Wi-Fi connection:

DEVICE_ID

+ device authentication proof

â†’ backend

Backend verifies device and creates/updates unclaimed registry presence.

93. â¬œ Implement backend factory identity authentication.

Must remove dependency on fleet-wide/global DEVICE_API_KEY.

Use per-device authentication.

94. â¬œ Automatically register authenticated device as UNCLAIMED.

No manual database entry.

No manual Device ID entry.

## AUTOMATIC PAIRING / DISCOVERY

95. ðŸ”„ Replace QR-primary pairing with temporary automatic pairing/discovery session.

Expected:

ESP connects

â†’ authenticates

â†’ backend creates short-lived pairing presence/session.

Pairing credential/session must be:

- temporary

- unique

- expiring

- single-use where applicable

Never use one global magic code.

96. ðŸ”„ Build Add Device automatic discovery UI.

Expected UX:

Add Device

â†’ Search for devices

â†’ available unclaimed device appears

â†’ select device

â†’ select House

â†’ select Room

â†’ Claim

â†’ Done

QR remains optional fallback/recovery mechanism.

## FINAL CLAIM FLOW

97. ðŸ”„ Update claim architecture for discovery-based claim.

Must reuse security protections from existing claim system:

- logged-in user

- house ownership verification

- room verification

- registry verification

- device not already owned

- transactional claim

- pairing session consumption/revocation

## CLOUD + LOCAL OPERATION

98. ðŸŸ¡ Complete production cloud command/status/schedule architecture.

Includes:

- commands

- status

- heartbeat

- capabilities

- schedules

- online/offline

- device events

- retries

- acknowledgements

Also retain Local LAN control:

Browser

â†’ LAN

â†’ ESP

Need production solution for browser HTTPS â†’ local device access restrictions,

CORS and Private Network Access.

## PRODUCTION VALIDATION

99. â¬œ Full end-to-end production testing.

Test:

Factory Stage 1

â†’ Stage 2

â†’ customer power-on

â†’ AP Wi-Fi setup

â†’ cloud registration

â†’ automatic discovery

â†’ claim

â†’ house/room

â†’ dynamic controls

â†’ command

â†’ status

â†’ schedule

â†’ offline

â†’ reconnect

â†’ Wi-Fi reset

â†’ ownership retained

â†’ identity retained

â†’ local LAN control.

100. â¬œ ESP Control Center Production V1 release.

Requirements before V1:

- Security review

- Device identity verified

- Pairing verified

- Ownership verified

- Cloud control stable

- Local control stable

- Schedule system stable

- Recovery flow tested

- Factory process documented

- Firmware versioning established

---

# 6. VOICE ASSISTANT EXPANSION

## 101. â¬œ Google Home / Google Assistant Integration

Goal:

Allow supported device capabilities to appear in the Google Home ecosystem and

be controlled by voice.

Examples:

"Hey Google, turn on lounge light."

"Hey Google, turn off motor one."

"Hey Google, set fan speed to 50 percent."

Architecture must map generic ESP Control Center capabilities to supported

Google smart-home device traits.

Conceptual flow:

Google Home / Assistant

â†’ ESP Control Center Cloud

â†’ authenticated user/home

â†’ device mapping

â†’ command system

â†’ ESP

â†’ status synchronization

Requirements:

- Account linking / authorization

- User-device ownership mapping

- Device discovery/sync

- Capability/trait mapping

- Execute commands

- Query/report state

- Device unlink handling

- Secure cloud-to-cloud integration

Do NOT hard-code Google logic directly into individual ESP devices.

---

## 102. â¬œ Amazon Alexa Integration

Goal:

Allow ESP Control Center devices to be exposed as Alexa smart-home devices.

Examples:

"Alexa, turn on bedroom light."

"Alexa, turn off water motor."

"Alexa, set dimmer to 40 percent."

Conceptual flow:

Alexa

â†’ ESP Control Center Cloud

â†’ authenticated account

â†’ device/capability mapping

â†’ command system

â†’ ESP

â†’ state reporting

Requirements:

- Alexa account linking

- Smart Home Skill

- Device discovery

- Capability mapping

- PowerController support

- PercentageController where applicable

- State reporting

- Device ownership verification

- Secure authorization

- Unlink/revocation support

Alexa-specific code must remain in the cloud integration layer.

ESP firmware remains generic.

---

# 7. QR POLICY

QR IS NOT REMOVED COMPLETELY.

QR is:

- fallback pairing method

- recovery method

- optional packaging/device label feature

QR is NOT:

- primary onboarding flow

- mandatory for every user

- replacement for automatic discovery

Primary flow is automatic device discovery after Wi-Fi provisioning.

---

# 8. IDENTITY STORAGE WARNING

IMPORTANT:

Current Stage-1/Stage-2 implementation uses Arduino ESP8266 EEPROM emulation.

Logical addresses such as:

160..367

are EEPROM logical offsets.

They are NOT literal physical flash addresses.

Before production, verify that the Stage-2 flashing procedure preserves the

EEPROM emulation flash sector.

Never use a production flashing process that performs an uncontrolled full

chip erase after Birth Firmware has generated the factory identity.

This must be verified on real hardware before architecture is considered

production-safe.

---

# 9. SECURITY RULES

Never:

- Ship a universal permanent device secret.

- Use Chip ID as a secret.

- Trust Device ID alone for authentication.

- Allow users to manually claim arbitrary Device IDs.

- Allow claim endpoint without authenticated user.

- Expose DEVICE_SECRET in normal firmware UI/API.

- Erase factory identity during normal Wi-Fi reset.

- Automatically regenerate factory identity in Final Firmware.

- Store plaintext device secrets in backend when hashing/verification can be

Â  used appropriately.

Device ID = identifier.

Device secret/authentication material = credential.

These must remain conceptually separate.

---

# 10. FIRMWARE FILES

Stage-1:

firmware/esp8266-birth-firmware/esp8266-birth-firmware.ino

Stage-2:

firmware/esp8266-smart-controller/esp8266-smart-controller.ino

Stage-1 creates identity.

Stage-2 consumes identity.

---

# 11. CURRENT CHECKPOINT

Current development checkpoint:

1â€“89:

Foundation largely implemented.

90:

Needs physical flash/persistence validation.

91:

Blocked until ESP hardware is available.

92â€“97:

Can continue WITHOUT ESP hardware.

98:

Partially implemented; production hardening required.

99:

Pending full integration.

100:

Production V1 target.

101:

Google Home / Google Assistant integration.

102:

Amazon Alexa integration.

103. ðŸŸ¡ PARTIAL / NEEDS HARDWARE TEST â€” MAP-V1 + HMAC-SHA256 Device Secret ID architecture implemented in Stage-1 Birth Firmware and Stage-2 Final Firmware. Stage-1 generates Identity V2, MAP-V1 encoded Chip ID, random 256-bit device secret, HMAC-SHA256 material and interleaved DEVICE_SECRET_ID. Stage-2 reads and validates Identity V2 without containing the factory HMAC generation key. Both firmwares compile successfully. Physical Stage-1 â†’ Stage-2 EEPROM preservation and identity validation test remains pending on real ESP8266 hardware.

MAP-V1 mapping is now LOCKED.

Remaining work:

- Define exact HMAC input format.

- Define key storage strategy.

- Implement Birth Firmware generation.

- Implement backend verification.

- Test copied/cloned identity rejection.

NEXT SOFTWARE TASK WITHOUT ESP:

Build the new first-internet registration + automatic device discovery

architecture and replace QR-primary onboarding while preserving QR as fallback.

**

12. COMPANY DEVICE ID ENCODING â€” MAP-V1

> LOCKED PRODUCTION MAPPING â€” MAP-V1

>

> This mapping converts each character of the hardware Chip ID into a

> company-specific encoded representation.

>

> IMPORTANT: MAP-V1 is an encoding/obfuscation layer, NOT the primary

> cryptographic security mechanism. Device authentication must still use

> cryptographic authentication such as HMAC-SHA256 with protected key material.

| Character | MAP-V1 Code |

|---|---|

| A | 001acd |

| B | b7x91 |

| C | c4p8z |

| D | d82mn |

| E | e5q71 |

| F | 021gb9 |

| G | g73wp |

| H | h19zr |

| I | i64bx |

| J | j27qm |

| K | k85tn |

| L | l43rv |

| M | 7mq2x |

| N | n91vk |

| O | 0op7x |

| P | p61bz |

| Q | q28mc |

| R | r94qx |

| S | s52kn |

| T | t83mz |

| U | u47kp |

| V | v62zr |

| W | w39px |

| X | x74qb |

| Y | 8wy4n |

| Z | z3k81 |

| 0 | 0zx71 |

| 1 | mkg |

| 2 | abk |

| 3 | tyx |

| 4 | 4pv82 |

| 5 | 5qr19 |

| 6 | 6xn43 |

| 7 | 7bk95 |

| 8 | 8mz26 |

| 9 | a0g |

### MAP-V1 Example

Hardware Chip ID:

A92F31

Encoding:

A â†’ 001acd

9 â†’ a0g

2 â†’ abk

F â†’ 021gb9

3 â†’ tyx

1 â†’ mkg

Encoded Chip ID:

001acd-a0g-abk-021gb9-tyx-mkg

### Device Secret ID Format

The encoded Chip ID may be interleaved with cryptographic authentication

material to produce the company Device Secret ID.

Conceptual format:

HMAC-SHA256 authentication material

+

MAP-V1 encoded Chip ID segments

=

DEVICE_SECRET_ID

Example structure:

a3f89b12-001acd-c74d092e-a0g-61a8f54b-abk-3c90e1f7-021gb9-82d451a9-tyx-6328b0c4-mkg-e7f8a91b2c3d4e5f

### Security Rules

- MAP-V1 must be versioned and must not silently change.

- Existing devices using MAP-V1 must remain decodable after future mapping versions are introduced.

- MAP-V1 alone must NEVER be treated as authentication.

- HMAC-SHA256 provides the cryptographic authentication layer.

- Raw permanent authentication keys must never be exposed to the browser.

- The backend must verify authentication before trusting a Device ID.

- Copying only an encoded Device ID must not be sufficient to authenticate another device.

- Production secrets/keys must never be committed to Git.

13. GIT PUSH TRACKING

> IMPORTANT: This section MUST be updated before every Git push after development work.

## Last Git Push

- **Date:** 24 September 2026
- **Location / Machine:** Office - SEO-PC
- **Branch:** main
- **Commit:** cb4d387
- **Commit Message:** Add automatic device registration and discovery APIs
- **Changes:** Added automatic device registration, verified factory provisioning, discovery-session infrastructure, and authenticated device discovery API.

## Mandatory Git Push Rule

Whenever new development work is completed:

1. Update relevant roadmap points in `brain.md`.
2. Mark completed work as `DONE`.
3. Mark partially completed work as `PARTIAL / NEEDS TESTING`.
4. Mark architecture changes as `REDO / ARCHITECTURE CHANGED`.
5. Add newly discovered tasks when required.
6. Update the Last Git Push information.
7. Stage source-code changes AND `brain.md`.
8. Commit them together whenever practical.
9. Push to GitHub.

`brain.md` must remain synchronized with the actual project state.

---

## Development Update - 24 Sep 2026

### Discovery-Based Device Claim Architecture

- DONE - `04_device_discovery_sessions`: discovery-session table, indexes, RLS and update trigger implemented.
- DONE - `05_device_discovery_helpers`: discovery expiry and active-session helpers implemented.
- DONE - `06_device_factory_registration`: factory registration foundation implemented.
- DONE - `07_auto_provision_verified_device`: verified factory devices can automatically provision into `device_registry`.
- DONE - `08_discovery_based_device_claim`: transactional discovery-session claim RPC implemented.
- DONE - `09_remove_legacy_qr_claim_system`: legacy QR/token claim database architecture removed.
- DONE - `/api/device/register`: Identity V2 / MAP-V1 / HMAC verification, automatic provisioning and discovery-session creation implemented.
- DONE - `/api/device/discover`: authenticated discovery API implemented and production build passes.
- DONE - `/api/device/claim`: migrated from raw claim-token architecture to `discovery_session_id`.
- DONE - `ClaimDeviceClient.tsx`: QR scanner, camera, QR image upload and raw token flow replaced by automatic discovery UI.
- DONE - `html5-qrcode` dependency removed.
- DONE - legacy `/api/device/claim-session` route removed.
- DONE - legacy claim-session proxy bypass removed.
- DONE - legacy `device_claim_tokens` table removed.
- DONE - legacy `complete_device_claim(...)` RPC removed.
- DONE - legacy `revoke_device_claim_tokens(...)` RPC removed.
- DONE - final Next.js production build passes after claim architecture migration.

### Current Claim Flow

Factory Birth Firmware
-> Identity V2 + MAP-V1 + DEVICE_SECRET_ID
-> Final Firmware
-> First Internet Connection
-> `/api/device/register`
-> Factory Identity Verification
-> `device_factory_registrations`
-> `auto_provision_verified_device`
-> `device_registry`
-> `device_discovery_sessions`
-> `/api/device/discover`
-> User selects discovered device
-> `/api/device/claim`
-> `complete_device_discovery_claim`
-> `device_ownership`
-> Device attached to selected room

### Remaining Work / Security

- PARTIAL / NEEDS HARDWARE TEST - Physical ESP8266 Stage-1 -> Stage-2 EEPROM identity preservation.
- PARTIAL / NEEDS HARDWARE TEST - First-online registration against the production-style backend.
- PARTIAL - Birth Firmware factory HMAC key and backend factory key need secure build-time synchronization before hardware registration testing.
- SECURITY TODO - Current `/api/device/discover` discovery scope must be hardened before Production V1 so an authenticated account cannot enumerate unrelated globally available devices.
- SECURITY TODO - Production factory HMAC key must be rotated before release.
- TODO - Complete discovery/pairing UX testing with real hardware.
- TODO - Production V1 end-to-end validation.

### Roadmap Status Update

- Point 92 - PARTIAL / NEEDS HARDWARE TEST: first-internet registration backend implemented.
- Point 93 - PARTIAL / NEEDS HARDWARE TEST: backend factory identity authentication implemented.
- Point 94 - DONE: automatic registration/provisioning foundation implemented.
- Point 95 - DONE: temporary discovery-session foundation implemented.
- Point 96 - DONE: app automatic discovery UI implemented.
- Point 97 - DONE: discovery-based device claim implemented.
- Point 98 - PARTIAL: cloud/status/schedule production hardening remains.
- Point 99 - TODO: full end-to-end testing.
- Point 100 - TODO: Production V1.
- Point 101 - TODO: Google integration.
- Point 102 - TODO: Alexa integration.
- Point 103 - PARTIAL / NEEDS HARDWARE TEST: MAP-V1 + HMAC Identity V2 implemented; physical validation remains.

### Git Tracking

Previous successful push:

- Branch: `main`
- Commit: `cb4d387`
- Message: `Add automatic device registration and discovery APIs`

Next push:

- Discovery-based claim migration and complete legacy QR/token architecture removal.
- Exact new commit hash will be recorded in the following development update.
