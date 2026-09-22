/*
  Phantom ESP8266 - Stage 1 Birth Firmware
  Target: ESP8266 / ESP-01 / ESP-12E / NodeMCU

  Serial @ 115200:
    HELP
    IDENTITY
    ERASE_IDENTITY
    REGENERATE_IDENTITY
    REBOOT

  EEPROM:
    0..159   reserved for application/Wi-Fi
    160..367 factory identity
*/

#include <Arduino.h>
#include <EEPROM.h>
#include <ESP8266WiFi.h>
#include <bearssl/bearssl.h>

extern "C" {
#include "user_interface.h"
}

static const uint16_t EEPROM_SIZE = 512;

static const uint16_t IDENTITY_BASE_ADDR    = 160;
static const uint16_t IDENTITY_MAGIC_ADDR   = 160; // 8 bytes
static const uint16_t IDENTITY_VERSION_ADDR = 168; // 1 byte
static const uint16_t DEVICE_ID_ADDR        = 176; // 32 bytes
static const uint16_t CHIP_ID_ADDR          = 208; // 16 bytes
static const uint16_t DEVICE_SECRET_ADDR    = 224; // 65 bytes
static const uint16_t IDENTITY_CHECK_ADDR   = 296; // 65 bytes
static const uint16_t IDENTITY_END_ADDR     = 368;

static const char IDENTITY_MAGIC[] = "PHBIRTH";
static const uint8_t IDENTITY_VERSION = 1;

String deviceId;
String chipIdHex;
String deviceSecretHex;
String identityCheckHex;
bool identityValid = false;

String toUpperHex(uint32_t value) {
  char buffer[16];
  snprintf(buffer, sizeof(buffer), "%06X", value);
  return String(buffer);
}

void writeFixedString(uint16_t address, uint16_t maxLength, const String &value) {
  for (uint16_t i = 0; i < maxLength; i++) EEPROM.write(address + i, 0);

  uint16_t n = value.length();
  if (n >= maxLength) n = maxLength - 1;

  for (uint16_t i = 0; i < n; i++) EEPROM.write(address + i, value[i]);
}

String readFixedString(uint16_t address, uint16_t maxLength) {
  String result;
  result.reserve(maxLength);

  for (uint16_t i = 0; i < maxLength; i++) {
    uint8_t b = EEPROM.read(address + i);
    if (b == 0 || b == 0xFF) break;
    result += (char)b;
  }
  return result;
}

bool magicMatches() {
  for (uint8_t i = 0; i < 7; i++) {
    if ((char)EEPROM.read(IDENTITY_MAGIC_ADDR + i) != IDENTITY_MAGIC[i]) {
      return false;
    }
  }
  return EEPROM.read(IDENTITY_VERSION_ADDR) == IDENTITY_VERSION;
}

void writeMagic() {
  for (uint8_t i = 0; i < 8; i++) EEPROM.write(IDENTITY_MAGIC_ADDR + i, 0);
  for (uint8_t i = 0; i < 7; i++) EEPROM.write(IDENTITY_MAGIC_ADDR + i, IDENTITY_MAGIC[i]);
  EEPROM.write(IDENTITY_VERSION_ADDR, IDENTITY_VERSION);
}

String bytesToHex(const uint8_t *data, size_t len) {
  static const char HEX_CHARS[] = "0123456789abcdef";
  String out;
  out.reserve(len * 2);

  for (size_t i = 0; i < len; i++) {
    out += HEX_CHARS[(data[i] >> 4) & 0x0F];
out += HEX_CHARS[data[i] & 0x0F];
  }

  return out;
}

String sha256Hex(const String &input) {
  br_sha256_context ctx;
  uint8_t digest[32];

  br_sha256_init(&ctx);
  br_sha256_update(&ctx, input.c_str(), input.length());
  br_sha256_out(&ctx, digest);

  return bytesToHex(digest, sizeof(digest));
}

String generateRandomSecretHex() {
  uint8_t secret[32];

  for (uint8_t i = 0; i < sizeof(secret); i += 4) {
    uint32_t r = os_random();

    secret[i] = (uint8_t)(r & 0xFF);
    secret[i + 1] = (uint8_t)((r >> 8) & 0xFF);
    secret[i + 2] = (uint8_t)((r >> 16) & 0xFF);
    secret[i + 3] = (uint8_t)((r >> 24) & 0xFF);
  }

  return bytesToHex(secret, sizeof(secret));
}

String calculateIdentityCheck(
  const String &id,
  const String &chip,
  const String &secret
) {
  String canonical = String("PHANTOM|V1|") + id + "|" + chip + "|" + secret;
  return sha256Hex(canonical);
}

void clearIdentityRegion() {
  for (uint16_t a = IDENTITY_BASE_ADDR; a < IDENTITY_END_ADDR; a++) {
    EEPROM.write(a, 0xFF);
  }

  EEPROM.commit();

  deviceId = "";
  chipIdHex = "";
  deviceSecretHex = "";
  identityCheckHex = "";
  identityValid = false;
}

bool loadIdentity() {
  if (!magicMatches()) {
    identityValid = false;
    return false;
  }

  String storedDeviceId = readFixedString(DEVICE_ID_ADDR, 32);
  String storedChipId = readFixedString(CHIP_ID_ADDR, 16);
  String storedSecret = readFixedString(DEVICE_SECRET_ADDR, 65);
  String storedCheck = readFixedString(IDENTITY_CHECK_ADDR, 65);

  String actualChipId = toUpperHex(ESP.getChipId());

  if (storedDeviceId.length() == 0 ||
      storedChipId.length() == 0 ||
      storedSecret.length() != 64 ||
      storedCheck.length() != 64) {
    identityValid = false;
    return false;
  }

  if (storedChipId != actualChipId) {
    Serial.println();
    Serial.println(F("!!! IDENTITY CHIP MISMATCH !!!"));
    Serial.print(F("Stored Chip ID : "));
    Serial.println(storedChipId);
    Serial.print(F("Actual Chip ID : "));
    Serial.println(actualChipId);
    identityValid = false;
    return false;
  }

  String expectedCheck =
    calculateIdentityCheck(storedDeviceId, storedChipId, storedSecret);

  if (!storedCheck.equalsIgnoreCase(expectedCheck)) {
    Serial.println();
    Serial.println(F("!!! IDENTITY INTEGRITY CHECK FAILED !!!"));
    identityValid = false;
    return false;
  }

  deviceId = storedDeviceId;
  chipIdHex = storedChipId;
  deviceSecretHex = storedSecret;
  identityCheckHex = storedCheck;
  identityValid = true;

  return true;
}

bool createIdentity() {
  chipIdHex = toUpperHex(ESP.getChipId());
  deviceId = String("PH-7") + chipIdHex;
  deviceSecretHex = generateRandomSecretHex();

  if (deviceSecretHex.length() != 64) {
    Serial.println(F("ERROR: Secret generation failed."));
    return false;
  }

  identityCheckHex =
    calculateIdentityCheck(deviceId, chipIdHex, deviceSecretHex);

  clearIdentityRegion();

  writeMagic();
  writeFixedString(DEVICE_ID_ADDR, 32, deviceId);
  writeFixedString(CHIP_ID_ADDR, 16, chipIdHex);
  writeFixedString(DEVICE_SECRET_ADDR, 65, deviceSecretHex);
  writeFixedString(IDENTITY_CHECK_ADDR, 65, identityCheckHex);

  if (!EEPROM.commit()) {
    Serial.println(F("ERROR: EEPROM commit failed."));
    return false;
  }

  delay(50);
  return loadIdentity();
}

void printIdentity() {
  Serial.println();
  Serial.println(F("========================================"));
  Serial.println(F(" PHANTOM DEVICE BIRTH IDENTITY"));
  Serial.println(F("========================================"));

  Serial.print(F("Hardware Chip ID : "));
  Serial.println(toUpperHex(ESP.getChipId()));

  Serial.print(F("Birth State      : "));
  Serial.println(identityValid ? F("VALID") : F("MISSING / INVALID"));

  if (identityValid) {
    Serial.print(F("Device ID        : "));
    Serial.println(deviceId);

    Serial.print(F("Stored Chip ID   : "));
    Serial.println(chipIdHex);

    // Factory/test firmware only. Final production firmware must not print this.
    Serial.print(F("Device Secret    : "));
    Serial.println(deviceSecretHex);

    Serial.print(F("Integrity SHA256 : "));
    Serial.println(identityCheckHex);
  }

  Serial.println(F("========================================"));
  Serial.println();
}

void printHelp() {
  Serial.println(F("Commands:"));
  Serial.println(F("  IDENTITY"));
  Serial.println(F("  ERASE_IDENTITY"));
  Serial.println(F("  REGENERATE_IDENTITY"));
  Serial.println(F("  REBOOT"));
  Serial.println(F("  HELP"));
  Serial.println();
}

void handleSerial() {
  if (!Serial.available()) return;

  String command = Serial.readStringUntil('\n');
  command.trim();
  command.toUpperCase();

  if (command.length() == 0) return;

  if (command == "IDENTITY") {
    loadIdentity();
    printIdentity();
  }
  else if (command == "ERASE_IDENTITY") {
    Serial.println(F("Erasing factory identity region..."));
    clearIdentityRegion();
    Serial.println(F("IDENTITY ERASED."));
    Serial.println(F("Rebooting; Birth Firmware will create a fresh identity."));
    delay(1500);
    ESP.restart();
  }
  else if (command == "REGENERATE_IDENTITY") {
    Serial.println(F("Regenerating identity..."));
    clearIdentityRegion();

    if (createIdentity()) {
      Serial.println(F("NEW IDENTITY CREATED."));
      printIdentity();
    } else {
      Serial.println(F("ERROR: Identity generation failed."));
    }
  }
  else if (command == "REBOOT") {
    Serial.println(F("Rebooting..."));
    delay(250);
    ESP.restart();
  }
  else if (command == "HELP") {
    printHelp();
  }
  else {
    Serial.print(F("Unknown command: "));
    Serial.println(command);
    printHelp();
  }
}

void setup() {
  Serial.begin(115200);
  Serial.setTimeout(100);
  delay(700);

  Serial.println();
  Serial.println();
  Serial.println(F("========================================"));
  Serial.println(F(" PHANTOM ESP8266 BIRTH FIRMWARE V1"));
  Serial.println(F("========================================"));

  EEPROM.begin(EEPROM_SIZE);

  WiFi.mode(WIFI_OFF);
  WiFi.forceSleepBegin();
  delay(1);

  if (loadIdentity()) {
    Serial.println(F("Existing valid factory identity found."));
    Serial.println(F("Identity NOT regenerated."));
  } else {
    Serial.println(F("No valid factory identity found."));
    Serial.println(F("Creating new factory identity..."));

    if (createIdentity()) {
      Serial.println(F("BIRTH COMPLETE."));
    } else {
      Serial.println(F("BIRTH FAILED."));
    }
  }

  printIdentity();
  printHelp();

  Serial.println(F("READY FOR STAGE-2 FINAL FIRMWARE."));
}

void loop() {
  handleSerial();
  delay(5);
}
