#include <Arduino.h>
#include <EEPROM.h>
#include <ESP8266WiFi.h>
#include <bearssl/bearssl.h>
extern "C" {
  #include "user_interface.h"
}

/* =========================================================
   ESP CONTROL CENTER
   STAGE-1 BIRTH FIRMWARE
   Identity Architecture: MAP-V1 + HMAC-SHA256

   IMPORTANT:
   - Stage-1 ONLY
   - Generates permanent factory identity
   - Final firmware must NEVER generate factory identity
   - Wi-Fi is disabled here
   ========================================================= */


/* =========================================================
   EEPROM
   ========================================================= */

#define EEPROM_SIZE 512

// 0..159 reserved for application / Wi-Fi
#define IDENTITY_START       160

#define ADDR_MAGIC           160
#define ADDR_VERSION         168

#define ADDR_DEVICE_ID       176
#define DEVICE_ID_SIZE       32

#define ADDR_CHIP_ID         208
#define CHIP_ID_SIZE         16

#define ADDR_DEVICE_SECRET   224
#define DEVICE_SECRET_SIZE   65

#define ADDR_INTEGRITY       296
#define INTEGRITY_SIZE       65

// New MAP-V1 data
#define ADDR_MAP_VERSION     368
#define MAP_VERSION_SIZE     8

#define ADDR_SECRET_ID       376
#define SECRET_ID_SIZE       136

#define IDENTITY_END         512

const char IDENTITY_MAGIC[] = "PHBIRTH";
const uint8_t IDENTITY_VERSION = 2;

const char MAP_VERSION[] = "MAP-V1";


/* =========================================================
   FACTORY HMAC KEY

   TEST KEY ONLY.

   BEFORE PRODUCTION:
   - replace through secure factory build process
   - NEVER commit production key to Git
   - NEVER place production key in brain.md
   - Stage-2 should NOT contain this factory generation key
   ========================================================= */

const char FACTORY_HMAC_KEY[] =
  "CHANGE-THIS-FACTORY-KEY-BEFORE-PRODUCTION";


/* =========================================================
   IDENTITY STRUCTURE
   ========================================================= */

struct FactoryIdentity {
  String deviceId;
  String chipId;

  String deviceSecret;

  String encodedChipId;

  String hmacHex;

  String deviceSecretId;

  String integrity;

  bool valid;
};


/* =========================================================
   EEPROM HELPERS
   ========================================================= */

void writeEEPROMString(int address, int maxLength, const String &value) {

  for (int i = 0; i < maxLength; i++) {
    EEPROM.write(address + i, 0);
  }

  int len = value.length();

  if (len > maxLength - 1) {
    len = maxLength - 1;
  }

  for (int i = 0; i < len; i++) {
    EEPROM.write(address + i, value[i]);
  }
}


String readEEPROMString(int address, int maxLength) {

  String result = "";

  for (int i = 0; i < maxLength; i++) {

    char c = (char)EEPROM.read(address + i);

    if (c == 0 || c == 0xFF) {
      break;
    }

    result += c;
  }

  return result;
}


/* =========================================================
   CHIP ID
   ========================================================= */

String getChipIdString() {

  uint32_t chip = ESP.getChipId();

  char buffer[7];

  snprintf(
    buffer,
    sizeof(buffer),
    "%06X",
    chip
  );

  return String(buffer);
}


/* =========================================================
   DEVICE ID
   ========================================================= */

String generateDeviceId(const String &chipId) {

  return "PH-7" + chipId;
}


/* =========================================================
   MAP-V1

   LOCKED COMPANY CHARACTER MAPPING
   ========================================================= */

String mapV1(char c) {

  c = toupper(c);

  switch (c) {

    case 'A': return "001acd";
    case 'B': return "b7x91";
    case 'C': return "c4p8z";
    case 'D': return "d82mn";
    case 'E': return "e5q71";
    case 'F': return "021gb9";

    case 'G': return "g73wp";
    case 'H': return "h19zr";
    case 'I': return "i64bx";
    case 'J': return "j27qm";
    case 'K': return "k85tn";
    case 'L': return "l43rv";

    case 'M': return "7mq2x";
    case 'N': return "n91vk";
    case 'O': return "0op7x";
    case 'P': return "p61bz";
    case 'Q': return "q28mc";
    case 'R': return "r94qx";

    case 'S': return "s52kn";
    case 'T': return "t83mz";
    case 'U': return "u47kp";
    case 'V': return "v62zr";
    case 'W': return "w39px";
    case 'X': return "x74qb";

    case 'Y': return "8wy4n";
    case 'Z': return "z3k81";

    case '0': return "0zx71";
    case '1': return "mkg";
    case '2': return "abk";
    case '3': return "tyx";
    case '4': return "4pv82";
    case '5': return "5qr19";
    case '6': return "6xn43";
    case '7': return "7bk95";
    case '8': return "8mz26";
    case '9': return "a0g";
  }

  return "";
}


/* =========================================================
   ENCODE CHIP ID
   ========================================================= */

String encodeChipId(const String &chipId) {

  String encoded = "";

  for (unsigned int i = 0; i < chipId.length(); i++) {

    String part = mapV1(chipId[i]);

    if (part.length() == 0) {
      return "";
    }

    if (i > 0) {
      encoded += "-";
    }

    encoded += part;
  }

  return encoded;
}


/* =========================================================
   RANDOM 256-BIT SECRET
   ========================================================= */

String generateRandomSecret() {

  uint8_t bytes[32];

  for (int i = 0; i < 32; i += 4) {

    uint32_t r = os_random();

    bytes[i]     = (r >> 24) & 0xFF;
    bytes[i + 1] = (r >> 16) & 0xFF;
    bytes[i + 2] = (r >> 8) & 0xFF;
    bytes[i + 3] = r & 0xFF;
  }

  String output = "";

  char buffer[3];

  for (int i = 0; i < 32; i++) {

    snprintf(
      buffer,
      sizeof(buffer),
      "%02x",
      bytes[i]
    );

    output += buffer;
  }

  return output;
}


/* =========================================================
   SHA256
   ========================================================= */

String sha256Hex(const String &input) {

  br_sha256_context ctx;

  unsigned char hash[32];

  br_sha256_init(&ctx);

  br_sha256_update(
    &ctx,
    input.c_str(),
    input.length()
  );

  br_sha256_out(
    &ctx,
    hash
  );

  String output = "";

  char buffer[3];

  for (int i = 0; i < 32; i++) {

    snprintf(
      buffer,
      sizeof(buffer),
      "%02x",
      hash[i]
    );

    output += buffer;
  }

  return output;
}


/* =========================================================
   HMAC-SHA256
   ========================================================= */

String hmacSHA256(
  const String &key,
  const String &message
) {

  br_hmac_key_context keyContext;

  br_hmac_context hmacContext;

  unsigned char outputHash[32];

  br_hmac_key_init(
    &keyContext,
    &br_sha256_vtable,
    key.c_str(),
    key.length()
  );

  br_hmac_init(
    &hmacContext,
    &keyContext,
    0
  );

  br_hmac_update(
    &hmacContext,
    message.c_str(),
    message.length()
  );

  br_hmac_out(
    &hmacContext,
    outputHash
  );

  String output = "";

  char buffer[3];

  for (int i = 0; i < 32; i++) {

    snprintf(
      buffer,
      sizeof(buffer),
      "%02x",
      outputHash[i]
    );

    output += buffer;
  }

  return output;
}


/* =========================================================
   DEVICE AUTH MESSAGE

   EXACT FORMAT IS VERSIONED.

   Changing this later requires a new identity version.
   ========================================================= */

String buildHmacMessage(
  const String &deviceId,
  const String &chipId,
  const String &deviceSecret
) {

  return
    "PHANTOM|V1|" +
    deviceId +
    "|" +
    chipId +
    "|" +
    deviceSecret;
}


/* =========================================================
   DEVICE SECRET ID

   HMAC is split into 8-character blocks.

   Encoded Chip ID blocks are inserted between them.

   Example:

   HMAC block 1
   MAP character 1
   HMAC block 2
   MAP character 2
   ...
   ========================================================= */

String buildDeviceSecretId(
  const String &hmacHex,
  const String &chipId
) {

  String result = "";

  /*
     SHA256 = 64 hex characters
     8 blocks × 8 chars
  */

  for (int block = 0; block < 8; block++) {

    if (result.length() > 0) {
      result += "-";
    }

    result += hmacHex.substring(
      block * 8,
      block * 8 + 8
    );

    /*
       ESP8266 Chip ID = 6 hexadecimal characters.

       Insert one MAP-V1 block after the
       first six HMAC blocks.
    */

    if (block < 6 && block < (int)chipId.length()) {

      result += "-";

      result += mapV1(
        chipId[block]
      );
    }
  }

  return result;
}


/* =========================================================
   INTEGRITY CHECK

   This detects EEPROM corruption/inconsistency.

   This is NOT the factory authentication mechanism.
   ========================================================= */

String generateIntegrity(
  const String &deviceId,
  const String &chipId,
  const String &deviceSecret,
  const String &deviceSecretId
) {

  String material =
    "PHANTOM|IDENTITY|V2|" +
    deviceId +
    "|" +
    chipId +
    "|" +
    deviceSecret +
    "|" +
    deviceSecretId;

  return sha256Hex(material);
}


/* =========================================================
   SAVE IDENTITY
   ========================================================= */

void saveIdentity(
  const FactoryIdentity &identity
) {

  writeEEPROMString(
    ADDR_MAGIC,
    8,
    IDENTITY_MAGIC
  );

  EEPROM.write(
    ADDR_VERSION,
    IDENTITY_VERSION
  );

  writeEEPROMString(
    ADDR_DEVICE_ID,
    DEVICE_ID_SIZE,
    identity.deviceId
  );

  writeEEPROMString(
    ADDR_CHIP_ID,
    CHIP_ID_SIZE,
    identity.chipId
  );

  writeEEPROMString(
    ADDR_DEVICE_SECRET,
    DEVICE_SECRET_SIZE,
    identity.deviceSecret
  );

  writeEEPROMString(
    ADDR_INTEGRITY,
    INTEGRITY_SIZE,
    identity.integrity
  );

  writeEEPROMString(
    ADDR_MAP_VERSION,
    MAP_VERSION_SIZE,
    MAP_VERSION
  );

  writeEEPROMString(
    ADDR_SECRET_ID,
    SECRET_ID_SIZE,
    identity.deviceSecretId
  );

  EEPROM.commit();
}


/* =========================================================
   LOAD + VERIFY IDENTITY
   ========================================================= */

FactoryIdentity loadIdentity() {

  FactoryIdentity identity;

  identity.valid = false;

  String magic =
    readEEPROMString(
      ADDR_MAGIC,
      8
    );

  if (magic != IDENTITY_MAGIC) {
    return identity;
  }


  uint8_t version =
    EEPROM.read(
      ADDR_VERSION
    );

  if (version != IDENTITY_VERSION) {
    return identity;
  }


  String mapVersion =
    readEEPROMString(
      ADDR_MAP_VERSION,
      MAP_VERSION_SIZE
    );

  if (mapVersion != MAP_VERSION) {
    return identity;
  }


  identity.deviceId =
    readEEPROMString(
      ADDR_DEVICE_ID,
      DEVICE_ID_SIZE
    );


  identity.chipId =
    readEEPROMString(
      ADDR_CHIP_ID,
      CHIP_ID_SIZE
    );


  identity.deviceSecret =
    readEEPROMString(
      ADDR_DEVICE_SECRET,
      DEVICE_SECRET_SIZE
    );


  identity.integrity =
    readEEPROMString(
      ADDR_INTEGRITY,
      INTEGRITY_SIZE
    );


  identity.deviceSecretId =
    readEEPROMString(
      ADDR_SECRET_ID,
      SECRET_ID_SIZE
    );


  /* -------------------------------------------------------
     Verify physical chip
     ------------------------------------------------------- */

  String actualChipId =
    getChipIdString();

  if (identity.chipId != actualChipId) {

    Serial.println();
    Serial.println("ERROR: CHIP ID MISMATCH");

    return identity;
  }


  /* -------------------------------------------------------
     Verify Device ID
     ------------------------------------------------------- */

  String expectedDeviceId =
    generateDeviceId(
      actualChipId
    );

  if (identity.deviceId != expectedDeviceId) {

    Serial.println();
    Serial.println("ERROR: DEVICE ID MISMATCH");

    return identity;
  }


  /* -------------------------------------------------------
     Rebuild MAP-V1
     ------------------------------------------------------- */

  identity.encodedChipId =
    encodeChipId(
      actualChipId
    );


  /* -------------------------------------------------------
     Recalculate HMAC
     ------------------------------------------------------- */

  String message =
    buildHmacMessage(
      identity.deviceId,
      identity.chipId,
      identity.deviceSecret
    );


  identity.hmacHex =
    hmacSHA256(
      FACTORY_HMAC_KEY,
      message
    );


  /* -------------------------------------------------------
     Rebuild Secret ID
     ------------------------------------------------------- */

  String expectedSecretId =
    buildDeviceSecretId(
      identity.hmacHex,
      identity.chipId
    );


  if (
    identity.deviceSecretId !=
    expectedSecretId
  ) {

    Serial.println();
    Serial.println("ERROR: DEVICE SECRET ID INVALID");

    return identity;
  }


  /* -------------------------------------------------------
     Verify integrity
     ------------------------------------------------------- */

  String expectedIntegrity =
    generateIntegrity(
      identity.deviceId,
      identity.chipId,
      identity.deviceSecret,
      identity.deviceSecretId
    );


  if (
    identity.integrity !=
    expectedIntegrity
  ) {

    Serial.println();
    Serial.println("ERROR: IDENTITY INTEGRITY INVALID");

    return identity;
  }


  identity.valid = true;

  return identity;
}


/* =========================================================
   CREATE NEW FACTORY IDENTITY
   ========================================================= */

FactoryIdentity createIdentity() {

  FactoryIdentity identity;

  identity.valid = false;


  /* -------------------------------------------------------
     Physical Chip ID
     ------------------------------------------------------- */

  identity.chipId =
    getChipIdString();


  /* -------------------------------------------------------
     Device ID
     ------------------------------------------------------- */

  identity.deviceId =
    generateDeviceId(
      identity.chipId
    );


  /* -------------------------------------------------------
     Random permanent Device Secret
     ------------------------------------------------------- */

  identity.deviceSecret =
    generateRandomSecret();


  /* -------------------------------------------------------
     MAP-V1 encoded Chip ID
     ------------------------------------------------------- */

  identity.encodedChipId =
    encodeChipId(
      identity.chipId
    );


  /* -------------------------------------------------------
     HMAC authentication material
     ------------------------------------------------------- */

  String hmacMessage =
    buildHmacMessage(
      identity.deviceId,
      identity.chipId,
      identity.deviceSecret
    );


  identity.hmacHex =
    hmacSHA256(
      FACTORY_HMAC_KEY,
      hmacMessage
    );


  /* -------------------------------------------------------
     Build Device Secret ID
     ------------------------------------------------------- */

  identity.deviceSecretId =
    buildDeviceSecretId(
      identity.hmacHex,
      identity.chipId
    );


  /* -------------------------------------------------------
     Integrity
     ------------------------------------------------------- */

  identity.integrity =
    generateIntegrity(
      identity.deviceId,
      identity.chipId,
      identity.deviceSecret,
      identity.deviceSecretId
    );


  identity.valid = true;

  return identity;
}


/* =========================================================
   PRINT IDENTITY

   STAGE-1 FACTORY OUTPUT ONLY
   ========================================================= */

void printIdentity(
  const FactoryIdentity &identity,
  bool showSecret
) {

  Serial.println();
  Serial.println("========================================");
  Serial.println("PHANTOM FACTORY IDENTITY");
  Serial.println("========================================");

  Serial.print("IDENTITY VERSION : ");
  Serial.println(IDENTITY_VERSION);

  Serial.print("MAP VERSION      : ");
  Serial.println(MAP_VERSION);

  Serial.print("CHIP ID          : ");
  Serial.println(identity.chipId);

  Serial.print("DEVICE ID        : ");
  Serial.println(identity.deviceId);

  Serial.print("ENCODED CHIP ID  : ");
  Serial.println(identity.encodedChipId);

  if (showSecret) {

    Serial.print("DEVICE SECRET    : ");
    Serial.println(identity.deviceSecret);

    Serial.print("HMAC SHA256      : ");
    Serial.println(identity.hmacHex);
  }

  Serial.print("DEVICE SECRET ID : ");
  Serial.println(identity.deviceSecretId);

  Serial.print("INTEGRITY        : ");
  Serial.println(identity.integrity);

  Serial.print("STATUS           : ");

  if (identity.valid) {
    Serial.println("VALID");
  }
  else {
    Serial.println("INVALID");
  }

  Serial.println("========================================");
}


/* =========================================================
   ERASE FACTORY IDENTITY

   ONLY identity area is erased.
   Application/Wi-Fi area is untouched.
   ========================================================= */

void eraseIdentity() {

  Serial.println();
  Serial.println("ERASING FACTORY IDENTITY...");

  for (
    int address = IDENTITY_START;
    address < IDENTITY_END;
    address++
  ) {

    EEPROM.write(
      address,
      0xFF
    );
  }

  EEPROM.commit();

  Serial.println("IDENTITY ERASED");
}


/* =========================================================
   SERIAL HELP
   ========================================================= */

void printHelp() {

  Serial.println();
  Serial.println("AVAILABLE COMMANDS");
  Serial.println("--------------------------------");

  Serial.println(
    "IDENTITY"
  );

  Serial.println(
    "ERASE_IDENTITY"
  );

  Serial.println(
    "REGENERATE_IDENTITY"
  );

  Serial.println(
    "REBOOT"
  );

  Serial.println(
    "HELP"
  );

  Serial.println("--------------------------------");
}


/* =========================================================
   SERIAL COMMAND HANDLER
   ========================================================= */

void handleSerialCommand(
  String command
) {

  command.trim();

  command.toUpperCase();


  if (command == "IDENTITY") {

    FactoryIdentity identity =
      loadIdentity();

    printIdentity(
      identity,
      true
    );

    return;
  }


  if (command == "ERASE_IDENTITY") {

    eraseIdentity();

    Serial.println(
      "REBOOTING..."
    );

    delay(1000);

    ESP.restart();

    return;
  }


  if (
    command ==
    "REGENERATE_IDENTITY"
  ) {

    eraseIdentity();

    Serial.println(
      "GENERATING NEW IDENTITY..."
    );

    FactoryIdentity identity =
      createIdentity();

    saveIdentity(
      identity
    );

    printIdentity(
      identity,
      true
    );

    return;
  }


  if (command == "REBOOT") {

    Serial.println(
      "REBOOTING..."
    );

    delay(500);

    ESP.restart();

    return;
  }


  if (command == "HELP") {

    printHelp();

    return;
  }


  if (command.length() > 0) {

    Serial.print(
      "UNKNOWN COMMAND: "
    );

    Serial.println(
      command
    );
  }
}


/* =========================================================
   SETUP
   ========================================================= */

void setup() {

  Serial.begin(115200);

  delay(500);

  Serial.println();
  Serial.println();
  Serial.println("========================================");
  Serial.println("ESP CONTROL CENTER");
  Serial.println("STAGE-1 BIRTH FIRMWARE");
  Serial.println("MAP-V1 + HMAC-SHA256");
  Serial.println("========================================");


  /* -------------------------------------------------------
     Disable Wi-Fi during factory birth
     ------------------------------------------------------- */

  WiFi.persistent(false);

  WiFi.mode(
    WIFI_OFF
  );

  WiFi.forceSleepBegin();

  delay(1);


  /* -------------------------------------------------------
     EEPROM
     ------------------------------------------------------- */

  EEPROM.begin(
    EEPROM_SIZE
  );


  /* -------------------------------------------------------
     Try existing identity
     ------------------------------------------------------- */

  FactoryIdentity identity =
    loadIdentity();


  if (identity.valid) {

    Serial.println();
    Serial.println(
      "EXISTING FACTORY IDENTITY FOUND"
    );

    printIdentity(
      identity,
      true
    );
  }

  else {

    Serial.println();
    Serial.println(
      "NO VALID FACTORY IDENTITY FOUND"
    );

    Serial.println(
      "GENERATING NEW FACTORY IDENTITY..."
    );


    identity =
      createIdentity();


    saveIdentity(
      identity
    );


    Serial.println(
      "FACTORY IDENTITY CREATED"
    );


    printIdentity(
      identity,
      true
    );
  }


  Serial.println();
  Serial.println(
    "READY FOR STAGE-2"
  );

  printHelp();
}


/* =========================================================
   LOOP
   ========================================================= */

void loop() {

  if (Serial.available()) {

    String command =
      Serial.readStringUntil('\n');

    handleSerialCommand(
      command
    );
  }

  delay(10);
}