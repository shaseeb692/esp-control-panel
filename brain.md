# ESP Control Center — Master Brain & Roadmap

> This file is the permanent technical roadmap and architecture reference for
> the ESP Control Center smart-home platform.
>
> Last major architecture revision: September 2026
>
> Roadmap Status:
> - ✅ DONE
> - 🟡 PARTIAL / NEEDS TESTING
> - 🔄 REDO / ARCHITECTURE CHANGED
> - ⬜ TODO
> - 🧪 HARDWARE TEST REQUIRED

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
→ Backend
→ Device Command
→ ESP
→ Device Status
→ Backend
→ Realtime UI

## Local LAN Mode

User Browser
→ Same Router / LAN
→ ESP Local API
→ Physical Device

No router:
- App/browser control is unavailable.
- Physical/manual controls continue working.

---

# 3. DEVICE SETUP FLOW

Device powers ON.

If Wi-Fi credentials do not exist:

ESP
→ Setup AP Mode
→ Unique SSID such as ESP-Setup-A7K29F
→ User connects
→ 192.168.4.1
→ Select Home Wi-Fi
→ Save credentials
→ ESP connects to router
→ Device reaches cloud
→ Device registers/authenticates
→ Temporary pairing/discovery session
→ User opens Add Device
→ Available unclaimed device appears
→ User selects device
→ Select House
→ Select Room
→ Claim Device
→ Done

If Wi-Fi credentials already exist:

ESP
→ Attempt saved Wi-Fi
→ Connected
→ Normal Mode

If router is unavailable:

ESP keeps retrying saved Wi-Fi.
ESP MUST NOT automatically enter setup AP.

Physical SETUP button can manually enter setup AP.

---

# 4. FACTORY IDENTITY ARCHITECTURE

Production uses TWO firmware stages.

## Stage 1 — Birth Firmware

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

## Stage 2 — Final Product Firmware

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

# 5. ROADMAP — 102 POINTS

## FOUNDATION

1. ✅ Define smart-home platform concept.
2. ✅ Select Next.js frontend.
3. ✅ Select Supabase backend/database.
4. ✅ Implement Supabase authentication.
5. ✅ Implement login flow.
6. ✅ Implement signup flow.
7. ✅ Implement password reset flow.
8. ✅ Create authenticated dashboard.
9. ✅ Create House architecture.
10. ✅ Create Room architecture.

## DEVICE MODEL

11. ✅ Create Devices architecture.
12. ✅ Create device capabilities architecture.
13. ✅ Define generic control IDs.
14. ✅ Support switch/toggle controls.
15. ✅ Support button controls.
16. ✅ Support slider controls.
17. ✅ Support number controls.
18. ✅ Remove requirement for hard-coded Motor1/Motor2 UI.
19. ✅ Device capabilities drive frontend controls.
20. 🟡 Continue standardizing commercial device capability definitions.

## UI / UX

21. ✅ Create dynamic DeviceControlPanel.
22. ✅ Create device status UI.
23. ✅ Create control command UI.
24. ✅ Create device settings architecture.
25. ✅ Create time-based MasterThemeProvider.
26. ✅ Create dashboard sky gradient system.
27. ✅ Create glass/glassSoft/muted theme system.
28. ✅ Apply theme to authentication pages.
29. ✅ Create weather detail page architecture.
30. 🟡 Continue UI consistency across remaining pages.

## COMMAND SYSTEM

31. ✅ Create device_commands architecture.
32. ✅ Create browser-authenticated /api/command.
33. ✅ Validate user ownership before command creation.
34. ✅ Store commands as pending.
35. ✅ ESP command polling architecture tested.
36. ✅ ESP status update architecture tested.
37. ✅ Supabase Realtime device status.
38. 🟡 Improve command acknowledgement/retry architecture.
39. 🟡 Improve device command failure reporting.
40. ⬜ Production command delivery optimization.

## DEVICE STATUS / ONLINE SYSTEM

41. ✅ Create device_status architecture.
42. ✅ Implement status JSON.
43. ✅ Implement online status concept.
44. ✅ Create /api/device/status.
45. ✅ Protect device status endpoint with device API authentication prototype.
46. 🔄 Replace prototype/global device API authentication with per-device identity authentication.
47. 🟡 Implement event-driven heartbeat architecture.
48. 🟡 Implement exact stale timeout per device.
49. ⬜ Production offline/online transition handling.
50. ⬜ Device health telemetry.

## SCHEDULES

51. ✅ Design schedules per control.
52. ✅ Multiple schedules per control supported conceptually.
53. ✅ Day-of-week repeat architecture.
54. ✅ Everyday = all seven days.
55. ✅ Cross-midnight schedule semantics defined.
56. 🟡 Supabase remains schedule source of truth.
57. ⬜ ESP compact schedule synchronization.
58. ⬜ ESP schedule RAM execution.
59. ⬜ Optional debounced flash schedule snapshot.
60. ⬜ Full schedule offline execution testing.

## DEVICE OWNERSHIP & SECURITY

61. ✅ Create device_registry.
62. ✅ Create device_claim_tokens.
63. ✅ Create device security foundation.
64. ✅ Implement secret versioning.
65. ✅ Implement lifecycle_state.
66. ✅ Implement hardware_model.
67. ✅ Implement firmware_version.
68. ✅ Implement registry metadata.
69. ✅ Implement verify_device_secret RPC foundation.
70. ✅ Implement token revocation architecture.

## ORIGINAL CLAIM SYSTEM

71. ✅ Create claim page.
72. ✅ Create ClaimDeviceClient.
73. ✅ Implement QR scanner.
74. ✅ Install html5-qrcode.
75. ✅ Fix browser camera Permissions-Policy.
76. ✅ Create /api/device/claim-session.
77. ✅ Create /api/device/claim.
78. ✅ Create transactional complete_device_claim RPC.
79. 🔄 QR-primary claim flow deprecated.
80. 🔄 Convert QR claim system into automatic discovery/pairing with QR retained only as fallback.

## TWO-STAGE FACTORY IDENTITY

81. ✅ Build Birth Firmware source.
82. ✅ Generate factory DEVICE_ID from ESP Chip ID.
83. ✅ Generate random 256-bit DEVICE_SECRET.
84. ✅ Generate factory identity integrity material.
85. ✅ Store factory identity separately from Wi-Fi configuration.
86. ✅ Add Birth Firmware identity test/recovery commands.
87. ✅ Birth Firmware compile successful.
88. ✅ Build Stage-2 Final Firmware source.
89. ✅ Stage-2 reads/verifies identity and does NOT generate it.
90. 🟡 Ensure production Stage-2 flashing method preserves EEPROM identity storage.

## HARDWARE VALIDATION

91. 🧪 Flash Birth Firmware on real ESP and verify Stage-1 → Stage-2 identity persistence.

Required test:

Birth Firmware
→ generate identity
→ record DEVICE_ID
→ flash Stage-2 without full erase
→ Stage-2 reads same DEVICE_ID
→ integrity valid
→ secret hidden
→ Wi-Fi reset
→ identity still survives

Also test Stage-2 ERASE_IDENTITY recovery behavior.

## CLOUD REGISTRATION

92. ⬜ Build first-internet device registration endpoint.

ESP after Wi-Fi connection:

DEVICE_ID
+ device authentication proof
→ backend

Backend verifies device and creates/updates unclaimed registry presence.

93. ⬜ Implement backend factory identity authentication.

Must remove dependency on fleet-wide/global DEVICE_API_KEY.

Use per-device authentication.

94. ⬜ Automatically register authenticated device as UNCLAIMED.

No manual database entry.

No manual Device ID entry.

## AUTOMATIC PAIRING / DISCOVERY

95. 🔄 Replace QR-primary pairing with temporary automatic pairing/discovery session.

Expected:

ESP connects
→ authenticates
→ backend creates short-lived pairing presence/session.

Pairing credential/session must be:

- temporary
- unique
- expiring
- single-use where applicable

Never use one global magic code.

96. 🔄 Build Add Device automatic discovery UI.

Expected UX:

Add Device
→ Search for devices
→ available unclaimed device appears
→ select device
→ select House
→ select Room
→ Claim
→ Done

QR remains optional fallback/recovery mechanism.

## FINAL CLAIM FLOW

97. 🔄 Update claim architecture for discovery-based claim.

Must reuse security protections from existing claim system:

- logged-in user
- house ownership verification
- room verification
- registry verification
- device not already owned
- transactional claim
- pairing session consumption/revocation

## CLOUD + LOCAL OPERATION

98. 🟡 Complete production cloud command/status/schedule architecture.

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
→ LAN
→ ESP

Need production solution for browser HTTPS → local device access restrictions,
CORS and Private Network Access.

## PRODUCTION VALIDATION

99. ⬜ Full end-to-end production testing.

Test:

Factory Stage 1
→ Stage 2
→ customer power-on
→ AP Wi-Fi setup
→ cloud registration
→ automatic discovery
→ claim
→ house/room
→ dynamic controls
→ command
→ status
→ schedule
→ offline
→ reconnect
→ Wi-Fi reset
→ ownership retained
→ identity retained
→ local LAN control.

100. ⬜ ESP Control Center Production V1 release.

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

## 101. ⬜ Google Home / Google Assistant Integration

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
→ ESP Control Center Cloud
→ authenticated user/home
→ device mapping
→ command system
→ ESP
→ status synchronization

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

## 102. ⬜ Amazon Alexa Integration

Goal:

Allow ESP Control Center devices to be exposed as Alexa smart-home devices.

Examples:

"Alexa, turn on bedroom light."

"Alexa, turn off water motor."

"Alexa, set dimmer to 40 percent."

Conceptual flow:

Alexa
→ ESP Control Center Cloud
→ authenticated account
→ device/capability mapping
→ command system
→ ESP
→ state reporting

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
  used appropriately.

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

1–89:
Foundation largely implemented.

90:
Needs physical flash/persistence validation.

91:
Blocked until ESP hardware is available.

92–97:
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

NEXT SOFTWARE TASK WITHOUT ESP:

Build the new first-internet registration + automatic device discovery
architecture and replace QR-primary onboarding while preserving QR as fallback.