#include <Arduino.h>
#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>
#include <EEPROM.h>
#include <bearssl/bearssl.h>

/*
  Phantom ESP8266 - Stage 2 Final Test Firmware
  Target: ESP8266 / ESP-01 / ESP-12E / NodeMCU

  Requires Stage-1 Birth Firmware identity in EEPROM.

  Serial @ 115200:
    HELP
    IDENTITY
    ERASE_IDENTITY
    REBOOT

  EEPROM:
    0..159   Wi-Fi/application
    160..511 factory identity V2 (same layout as Stage-1)

  IMPORTANT:
    - Stage-2 DOES NOT generate/provision identity.
    - Invalid/missing identity => LOCKED.
    - ERASE_IDENTITY is TESTING/SERVICE ONLY.
    - Wi-Fi reset preserves factory identity.
*/

#define MOTOR1_PIN D1
#define MOTOR2_PIN D2

#define OUTPUT_ON  HIGH
#define OUTPUT_OFF LOW

static const uint16_t EEPROM_SIZE = 512;

/* =========================
   WIFI EEPROM
========================= */
static const uint16_t WIFI_MAGIC_ADDRESS = 0;
static const uint16_t SSID_ADDRESS = 16;
static const uint16_t PASSWORD_ADDRESS = 80;

static const uint16_t SSID_MAX_LENGTH = 32;
static const uint16_t PASSWORD_MAX_LENGTH = 64;

static const char WIFI_MAGIC[] = "ESPWF1";

/* =========================
   BIRTH IDENTITY EEPROM
   MUST MATCH STAGE-1
========================= */
static const uint16_t IDENTITY_BASE_ADDR    = 160;
static const uint16_t IDENTITY_MAGIC_ADDR   = 160;
static const uint16_t IDENTITY_VERSION_ADDR = 168;
static const uint16_t DEVICE_ID_ADDR        = 176;
static const uint16_t CHIP_ID_ADDR          = 208;
static const uint16_t DEVICE_SECRET_ADDR    = 224;
static const uint16_t IDENTITY_CHECK_ADDR   = 296;
static const uint16_t MAP_VERSION_ADDR       = 368;
static const uint16_t DEVICE_SECRET_ID_ADDR  = 376;
static const uint16_t IDENTITY_END_ADDR      = 512;

static const uint16_t DEVICE_ID_SIZE         = 32;
static const uint16_t CHIP_ID_SIZE           = 16;
static const uint16_t DEVICE_SECRET_SIZE     = 65;
static const uint16_t IDENTITY_CHECK_SIZE    = 65;
static const uint16_t MAP_VERSION_SIZE       = 8;
static const uint16_t DEVICE_SECRET_ID_SIZE  = 136;

static const char IDENTITY_MAGIC[] = "PHBIRTH";
static const uint8_t IDENTITY_VERSION = 2;
static const char MAP_VERSION[] = "MAP-V1";

/* =========================
   RUNTIME
========================= */
static const unsigned long SERIAL_BAUD = 115200;
static const unsigned long WIFI_RETRY_INTERVAL = 10000;

String savedSSID = "";
String savedPassword = "";

String deviceId = "";
String storedChipId = "";
String deviceSecret = "";
String identityCheck = "";
String storedMapVersion = "";
String deviceSecretId = "";

bool identityValid = false;
bool setupMode = false;
bool wifiConnected = false;
bool motor1State = false;
bool motor2State = false;

unsigned long lastWiFiRetry = 0;

ESP8266WebServer server(80);

/* =====================================================
   HELPERS
===================================================== */

String currentChipIdHex() {
  char buffer[16];
  snprintf(buffer, sizeof(buffer), "%06X", ESP.getChipId());
  return String(buffer);
}

String readFixedString(uint16_t address, uint16_t maxLength) {
  String value;
  value.reserve(maxLength);

  for (uint16_t i = 0; i < maxLength; i++) {
    uint8_t b = EEPROM.read(address + i);

    if (b == 0 || b == 0xFF) {
      break;
    }

    value += (char)b;
  }

  return value;
}

void writeFixedString(
  uint16_t address,
  uint16_t maxLength,
  const String &value
) {
  for (uint16_t i = 0; i < maxLength; i++) {
    EEPROM.write(address + i, 0);
  }

  uint16_t length = value.length();

  if (length >= maxLength) {
    length = maxLength - 1;
  }

  for (uint16_t i = 0; i < length; i++) {
    EEPROM.write(address + i, value[i]);
  }
}

String bytesToHex(const uint8_t *data, size_t len) {
  static const char HEX_CHARS[] = "0123456789abcdef";

  String output;
  output.reserve(len * 2);

  for (size_t i = 0; i < len; i++) {
    output += HEX_CHARS[(data[i] >> 4) & 0x0F];
    output += HEX_CHARS[data[i] & 0x0F];
  }

  return output;
}

String sha256Hex(const String &input) {
  br_sha256_context context;
  uint8_t digest[32];

  br_sha256_init(&context);

  br_sha256_update(
    &context,
    input.c_str(),
    input.length()
  );

  br_sha256_out(
    &context,
    digest
  );

  return bytesToHex(
    digest,
    sizeof(digest)
  );
}

String hmacSha256Hex(
  const String &key,
  const String &message
) {
  br_hmac_key_context keyContext;
  br_hmac_context hmacContext;
  uint8_t digest[32];

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
    digest
  );

  return bytesToHex(digest, sizeof(digest));
}

String calculateIdentityCheck(
  const String &id,
  const String &chip,
  const String &secret,
  const String &secretId
) {
  return sha256Hex(
    String("PHANTOM|IDENTITY|V2|") +
    id + "|" + chip + "|" + secret + "|" + secretId
  );
}

/* =====================================================
   FACTORY IDENTITY
===================================================== */

bool identityMagicMatches() {
  for (uint8_t i = 0; i < 7; i++) {
    if (
      (char)EEPROM.read(
        IDENTITY_MAGIC_ADDR + i
      ) != IDENTITY_MAGIC[i]
    ) {
      return false;
    }
  }

  return
    EEPROM.read(
      IDENTITY_VERSION_ADDR
    ) == IDENTITY_VERSION;
}

bool loadFactoryIdentity() {
  identityValid = false;
  deviceId = "";
  storedChipId = "";
  deviceSecret = "";
  identityCheck = "";
  storedMapVersion = "";
  deviceSecretId = "";

  if (!identityMagicMatches()) return false;

  deviceId = readFixedString(DEVICE_ID_ADDR, DEVICE_ID_SIZE);
  storedChipId = readFixedString(CHIP_ID_ADDR, CHIP_ID_SIZE);
  deviceSecret = readFixedString(DEVICE_SECRET_ADDR, DEVICE_SECRET_SIZE);
  identityCheck = readFixedString(IDENTITY_CHECK_ADDR, IDENTITY_CHECK_SIZE);
  storedMapVersion = readFixedString(MAP_VERSION_ADDR, MAP_VERSION_SIZE);
  deviceSecretId = readFixedString(DEVICE_SECRET_ID_ADDR, DEVICE_SECRET_ID_SIZE);

  if (
    deviceId.length() == 0 ||
    storedChipId.length() == 0 ||
    deviceSecret.length() != 64 ||
    identityCheck.length() != 64 ||
    storedMapVersion != MAP_VERSION ||
    deviceSecretId.length() == 0
  ) {
    Serial.println(F("IDENTITY ERROR: V2 DATA MISSING / INVALID"));
    return false;
  }

  String actualChipId = currentChipIdHex();

  if (storedChipId != actualChipId) {
    Serial.println(F("IDENTITY ERROR: CHIP ID MISMATCH"));
    return false;
  }

  String expectedDeviceId = String("PH-7") + actualChipId;
  if (deviceId != expectedDeviceId) {
    Serial.println(F("IDENTITY ERROR: DEVICE ID MISMATCH"));
    return false;
  }

  String expected = calculateIdentityCheck(
    deviceId, storedChipId, deviceSecret, deviceSecretId
  );

  if (!identityCheck.equalsIgnoreCase(expected)) {
    Serial.println(F("IDENTITY ERROR: V2 INTEGRITY CHECK FAILED"));
    return false;
  }

  // Factory HMAC key is intentionally NOT present in Stage-2.
  // Backend/factory verifies DEVICE_SECRET_ID cryptographic authenticity.
  identityValid = true;
  return true;
}

void printIdentityStatus() {
  loadFactoryIdentity();

  Serial.println();
  Serial.println(
    F("=== FACTORY IDENTITY ===")
  );

  Serial.print(
    F("STATE: ")
  );

  Serial.println(
    identityValid
      ? F("VALID")
      : F("MISSING / INVALID")
  );

  Serial.print(
    F("HARDWARE CHIP ID: ")
  );

  Serial.println(
    currentChipIdHex()
  );

  if (identityValid) {
    Serial.print(
      F("DEVICE_ID: ")
    );

    Serial.println(
      deviceId
    );

    Serial.print(
      F("STORED CHIP ID: ")
    );

    Serial.println(
      storedChipId
    );

    Serial.print(F("MAP VERSION: "));
    Serial.println(storedMapVersion);

    Serial.print(F("DEVICE_SECRET_ID: "));
    Serial.println(deviceSecretId);

    Serial.println(
      F("DEVICE_SECRET: [HIDDEN]")
    );

    Serial.print(
      F("INTEGRITY SHA256: ")
    );

    Serial.println(
      identityCheck
    );
  }

  Serial.println(
    F("========================")
  );

  Serial.println();
}

void eraseFactoryIdentity() {
  /*
    TESTING / FACTORY SERVICE ONLY.

    Erases ONLY the Stage-1 identity region.
    Wi-Fi region is not touched.
  */

  for (
    uint16_t address =
      IDENTITY_BASE_ADDR;

    address <
      IDENTITY_END_ADDR;

    address++
  ) {
    EEPROM.write(
      address,
      0xFF
    );
  }

  EEPROM.commit();

  identityValid = false;

  deviceId = "";
  storedChipId = "";
  deviceSecret = "";
  identityCheck = "";
  storedMapVersion = "";
  deviceSecretId = "";
}

/* =====================================================
   SERIAL TEST / RECOVERY
===================================================== */

void printSerialHelp() {
  Serial.println(
    F("SERIAL COMMANDS:")
  );

  Serial.println(
    F("  IDENTITY")
  );

  Serial.println(
    F("  ERASE_IDENTITY")
  );

  Serial.println(
    F("  REBOOT")
  );

  Serial.println(
    F("  HELP")
  );
}

void handleSerialCommands() {
  if (!Serial.available()) {
    return;
  }

  String command =
    Serial.readStringUntil('\n');

  command.trim();
  command.toUpperCase();

  if (
    command == "IDENTITY"
  ) {
    printIdentityStatus();
    return;
  }

  if (
    command == "ERASE_IDENTITY"
  ) {
    Serial.println();
    Serial.println(
      F("WARNING: ERASING FACTORY IDENTITY")
    );

    eraseFactoryIdentity();

    Serial.println(
      F("IDENTITY ERASED")
    );

    Serial.println(
      F("REBOOTING...")
    );

    delay(1000);
    ESP.restart();
    return;
  }

  if (
    command == "REBOOT"
  ) {
    Serial.println(
      F("REBOOTING...")
    );

    delay(300);
    ESP.restart();
    return;
  }

  if (
    command == "HELP"
  ) {
    printSerialHelp();
    return;
  }

  if (
    command.length() > 0
  ) {
    Serial.println(
      F("UNKNOWN COMMAND")
    );

    printSerialHelp();
  }
}

/* =====================================================
   WIFI STORAGE
===================================================== */

bool hasSavedWiFi() {
  for (
    uint8_t i = 0;
    i < strlen(WIFI_MAGIC);
    i++
  ) {
    if (
      (char)EEPROM.read(
        WIFI_MAGIC_ADDRESS + i
      ) != WIFI_MAGIC[i]
    ) {
      return false;
    }
  }

  savedSSID =
    readFixedString(
      SSID_ADDRESS,
      SSID_MAX_LENGTH
    );

  savedPassword =
    readFixedString(
      PASSWORD_ADDRESS,
      PASSWORD_MAX_LENGTH
    );

  return
    savedSSID.length() > 0;
}

void saveWiFiCredentials(
  const String &ssid,
  const String &password
) {
  for (
    uint8_t i = 0;
    i < strlen(WIFI_MAGIC);
    i++
  ) {
    EEPROM.write(
      WIFI_MAGIC_ADDRESS + i,
      WIFI_MAGIC[i]
    );
  }

  writeFixedString(
    SSID_ADDRESS,
    SSID_MAX_LENGTH,
    ssid
  );

  writeFixedString(
    PASSWORD_ADDRESS,
    PASSWORD_MAX_LENGTH,
    password
  );

  EEPROM.commit();

  savedSSID = ssid;
  savedPassword = password;

  Serial.println(
    F("WIFI CREDENTIALS SAVED")
  );
}

void clearWiFiCredentials() {
  /*
    CRITICAL:
    Clear ONLY 0..159.
    Birth identity starts at 160.
  */

  for (
    uint16_t address =
      WIFI_MAGIC_ADDRESS;

    address <
      IDENTITY_BASE_ADDR;

    address++
  ) {
    EEPROM.write(
      address,
      0
    );
  }

  EEPROM.commit();

  savedSSID = "";
  savedPassword = "";

  Serial.println(
    F("WIFI CREDENTIALS CLEARED")
  );

  Serial.println(
    F("FACTORY IDENTITY PRESERVED")
  );
}

/* =====================================================
   OUTPUTS
===================================================== */

void setMotor1(bool state) {
  motor1State = state;

  digitalWrite(
    MOTOR1_PIN,
    state
      ? OUTPUT_ON
      : OUTPUT_OFF
  );

  Serial.print(
    F("MOTOR 1 / LED 1: ")
  );

  Serial.println(
    state ? "ON" : "OFF"
  );
}

void setMotor2(bool state) {
  motor2State = state;

  digitalWrite(
    MOTOR2_PIN,
    state
      ? OUTPUT_ON
      : OUTPUT_OFF
  );

  Serial.print(
    F("MOTOR 2 / LED 2: ")
  );

  Serial.println(
    state ? "ON" : "OFF"
  );
}

/* =====================================================
   HTML
===================================================== */

String htmlHeader(
  const String &title
) {
  String html;

  html += F(
    "<!DOCTYPE html>"
    "<html lang='en'>"
    "<head>"
    "<meta charset='UTF-8'>"
    "<meta name='viewport' "
    "content='width=device-width,"
    "initial-scale=1'>"
  );

  html +=
    "<title>" +
    title +
    "</title>";

  html += F(R"rawliteral(
<style>
*{box-sizing:border-box}
body{
  margin:0;
  padding:20px;
  min-height:100vh;
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;
  background:linear-gradient(160deg,#07141d 0%,#0d2630 45%,#102f38 100%);
  color:#fff
}
.container{
  width:100%;
  max-width:560px;
  margin:0 auto
}
.card{
  margin-top:16px;
  padding:20px;
  border:1px solid rgba(255,255,255,.12);
  border-radius:22px;
  background:rgba(0,0,0,.24)
}
.brand-small{
  color:#42b8c5;
  font-size:12px;
  font-weight:700;
  letter-spacing:1.4px;
  text-transform:uppercase
}
h1{margin:6px 0}
.subtitle{
  color:rgba(255,255,255,.62);
  line-height:1.6
}
.info{
  padding:12px;
  margin:10px 0;
  border-radius:14px;
  background:rgba(255,255,255,.06)
}
button,.button{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  padding:12px 18px;
  border:0;
  border-radius:14px;
  background:#42b8c5;
  color:#fff;
  font-weight:700;
  text-decoration:none;
  cursor:pointer
}
.full{width:100%}
.danger{background:#dc3545}
input,select{
  width:100%;
  margin:8px 0 16px;
  padding:14px;
  border-radius:12px;
  border:1px solid rgba(255,255,255,.15)
}
.success{color:#4ade80}
.warning{color:#fbbf24}
</style>
</head>
<body>
<div class='container'>
)rawliteral");

  return html;
}

String htmlFooter() {
  return F(
    "</div>"
    "</body>"
    "</html>"
  );
}

/* =====================================================
   LOCKED MODE
===================================================== */

void handleLockedPage() {
  String html =
    htmlHeader(
      "Device Locked"
    );

  html += F(R"rawliteral(
<div class='card'>
  <div class='brand-small'>
    ESP Control Center
  </div>

  <h1>Device Locked</h1>

  <div class='warning'>
    Factory identity is missing or invalid.
  </div>

  <div
    class='subtitle'
    style='margin-top:12px'
  >
    Stage-1 Birth Firmware must create a valid
    identity before this firmware can operate.
  </div>
</div>
)rawliteral");

  html += htmlFooter();

  server.send(
    423,
    "text/html",
    html
  );
}

void startLockedMode() {
  setupMode = false;
  wifiConnected = false;

  WiFi.mode(
    WIFI_OFF
  );

  server.on(
    "/",
    HTTP_GET,
    handleLockedPage
  );

  server.on(
    "/status",
    HTTP_GET,
    []() {
      String json =
        "{\"locked\":true,"
        "\"identity_valid\":false,"
        "\"chip_id\":\"";

      json +=
        currentChipIdHex();

      json += "\"}";

      server.send(
        423,
        "application/json",
        json
      );
    }
  );

  server.onNotFound(
    handleLockedPage
  );

  server.begin();

  Serial.println();
  Serial.println(
    F("DEVICE LOCKED")
  );

  Serial.println(
    F("VALID BIRTH IDENTITY REQUIRED")
  );
}

/* =====================================================
   WIFI SCAN
===================================================== */

String buildWiFiOptions() {
  Serial.println(
    F("SCANNING WIFI NETWORKS")
  );

  int count =
    WiFi.scanNetworks();

  String options = "";

  if (count <= 0) {
    options +=
      "<option value=''>"
      "No networks found"
      "</option>";

    return options;
  }

  for (
    int i = 0;
    i < count;
    i++
  ) {
    String ssid =
      WiFi.SSID(i);

    options +=
      "<option value='";

    options += ssid;

    options += "'>";

    options += ssid;

    options += " (";

    options +=
      String(
        WiFi.RSSI(i)
      );

    options +=
      " dBm)</option>";
  }

  WiFi.scanDelete();

  return options;
}

/* =====================================================
   SETUP PAGE
===================================================== */

void handleSetupPage() {
  String html =
    htmlHeader(
      "ESP Wi-Fi Setup"
    );

  html += F(
    "<div class='card'>"
    "<div class='brand-small'>"
    "ESP Control Center"
    "</div>"
    "<h1>Wi-Fi Setup</h1>"
    "<div class='subtitle'>Device ID: "
  );

  html += deviceId;

  html += F(R"rawliteral(
  </div>

  <form
    method='POST'
    action='/save-wifi'
    style='margin-top:18px'
  >
    <label>
      Wi-Fi Network
    </label>

    <select
      name='ssid'
      required
    >
)rawliteral");

  html +=
    buildWiFiOptions();

  html += F(R"rawliteral(
    </select>

    <label>
      Wi-Fi Password
    </label>

    <input
      type='password'
      name='password'
      placeholder='Enter Wi-Fi password'
    >

    <button
      class='full'
      type='submit'
    >
      Connect to Wi-Fi
    </button>
  </form>
</div>
)rawliteral");

  html += htmlFooter();

  server.send(
    200,
    "text/html",
    html
  );
}

void handleSaveWiFi() {
  if (
    !server.hasArg("ssid")
  ) {
    server.send(
      400,
      "text/plain",
      "SSID missing"
    );

    return;
  }

  String ssid =
    server.arg("ssid");

  String password =
    server.arg("password");

  ssid.trim();

  if (
    ssid.length() == 0
  ) {
    server.send(
      400,
      "text/plain",
      "SSID cannot be empty"
    );

    return;
  }

  saveWiFiCredentials(
    ssid,
    password
  );

  String html =
    htmlHeader(
      "Wi-Fi Saved"
    );

  html += F(
    "<div class='card'>"
    "<h1>Wi-Fi Saved</h1>"
    "<div class='success'>"
    "Credentials saved."
    "</div>"
    "<div class='subtitle' "
    "style='margin-top:12px'>"
    "Restarting device..."
    "</div>"
    "</div>"
  );

  html += htmlFooter();

  server.send(
    200,
    "text/html",
    html
  );

  delay(1500);
  ESP.restart();
}

/* =====================================================
   JSON STATUS
===================================================== */

void handleStatus() {
  String json = "{";

  json +=
    "\"identity_valid\":";

  json +=
    identityValid
      ? "true"
      : "false";

  json +=
    ",\"device_id\":\"";

  json += deviceId;

  json += "\"";

  json +=
    ",\"chip_id\":\"";

  json +=
    currentChipIdHex();

  json += "\"";

  json +=
    ",\"online\":";

  json +=
    wifiConnected
      ? "true"
      : "false";

  json +=
    ",\"mode\":\"";

  json +=
    setupMode
      ? "setup"
      : "normal";

  json += "\"";

  json +=
    ",\"motor1\":";

  json +=
    motor1State
      ? "true"
      : "false";

  json +=
    ",\"motor2\":";

  json +=
    motor2State
      ? "true"
      : "false";

  if (
    WiFi.status() ==
    WL_CONNECTED
  ) {
    json +=
      ",\"ssid\":\"";

    json +=
      WiFi.SSID();

    json += "\"";

    json +=
      ",\"ip\":\"";

    json +=
      WiFi.localIP()
        .toString();

    json += "\"";

    json +=
      ",\"rssi\":";

    json +=
      String(
        WiFi.RSSI()
      );
  }

  json += "}";

  server.send(
    200,
    "application/json",
    json
  );
}

/* =====================================================
   LOCAL DASHBOARD
===================================================== */

void handleLocalDashboard() {
  String html =
    htmlHeader(
      "ESP Control Center"
    );

  html += F(
    "<div class='card'>"
    "<div class='brand-small'>"
    "ESP Control Center"
    "</div>"
    "<h1>Device Control</h1>"
    "<div class='subtitle'>Device ID: "
  );

  html += deviceId;

  html += F(
    "</div>"
    "<div class='info'>Local IP: "
  );

  html +=
    WiFi.localIP()
      .toString();

  html += F(
    "</div>"
    "<div class='info'>Network: "
  );

  html +=
    WiFi.SSID();

  html += F(
    "</div>"
    "</div>"
  );

  html += F(
    "<div class='card'>"
    "<h3>Motor 1 / LED 1</h3>"
    "<div class='subtitle'>State: "
  );

  html +=
    motor1State
      ? "ON"
      : "OFF";

  html += F(
    "</div>"
    "<a class='button full' "
    "style='margin-top:12px' "
    "href='/motor1/toggle'>"
  );

  html +=
    motor1State
      ? "Turn OFF"
      : "Turn ON";

  html += F(
    "</a>"
    "</div>"
  );

  html += F(
    "<div class='card'>"
    "<h3>Motor 2 / LED 2</h3>"
    "<div class='subtitle'>State: "
  );

  html +=
    motor2State
      ? "ON"
      : "OFF";

  html += F(
    "</div>"
    "<a class='button full' "
    "style='margin-top:12px' "
    "href='/motor2/toggle'>"
  );

  html +=
    motor2State
      ? "Turn OFF"
      : "Turn ON";

  html += F(
    "</a>"
    "</div>"
  );

  html += F(
    "<div class='card'>"
    "<a class='button full' "
    "href='/status'>"
    "View JSON Status"
    "</a>"
    "<a class='button danger full' "
    "style='margin-top:10px' "
    "href='/reset-wifi'>"
    "Reset Wi-Fi"
    "</a>"
    "</div>"
  );

  html += htmlFooter();

  server.send(
    200,
    "text/html",
    html
  );
}

void handleMotor1Toggle() {
  setMotor1(
    !motor1State
  );

  server.sendHeader(
    "Location",
    "/"
  );

  server.send(
    303,
    "text/plain",
    ""
  );
}

void handleMotor2Toggle() {
  setMotor2(
    !motor2State
  );

  server.sendHeader(
    "Location",
    "/"
  );

  server.send(
    303,
    "text/plain",
    ""
  );
}

/* =====================================================
   SECURE LOCAL LAN API
===================================================== */

String localLanKey() {
  return sha256Hex(
    String("PHANTOM|LAN|KEY|V1|") +
    deviceId + "|" + deviceSecret
  );
}

void sendLocalCorsHeaders() {
  server.sendHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  server.sendHeader(
    "Access-Control-Allow-Headers",
    "Content-Type,X-Device-Id,X-Lan-Nonce,X-Lan-Signature"
  );
  server.sendHeader("Access-Control-Max-Age", "600");
}

void handleLocalApiOptions() {
  sendLocalCorsHeaders();
  server.send(204, "text/plain", "");
}

bool validLocalNonce(const String &nonce) {
  if (nonce.length() < 16 || nonce.length() > 96) return false;

  for (size_t i = 0; i < nonce.length(); i++) {
    char c = nonce[i];

    if (
      !(
        (c >= 'a' && c <= 'z') ||
        (c >= 'A' && c <= 'Z') ||
        (c >= '0' && c <= '9') ||
        c == '-' ||
        c == '_'
      )
    ) {
      return false;
    }
  }

  return true;
}

bool constantTimeHexEqual(
  const String &a,
  const String &b
) {
  if (a.length() != b.length()) return false;

  uint8_t diff = 0;

  for (size_t i = 0; i < a.length(); i++) {
    char ac = a[i];
    char bc = b[i];

    if (ac >= 'A' && ac <= 'F') ac += 32;
    if (bc >= 'A' && bc <= 'F') bc += 32;

    diff |= (uint8_t)(ac ^ bc);
  }

  return diff == 0;
}

bool authenticateLocalRequest(
  const String &method,
  const String &path,
  const String &body
) {
  if (
    !identityValid ||
    setupMode ||
    WiFi.status() != WL_CONNECTED
  ) {
    return false;
  }

  if (
    !server.hasHeader("X-Device-Id") ||
    !server.hasHeader("X-Lan-Nonce") ||
    !server.hasHeader("X-Lan-Signature")
  ) {
    return false;
  }

  String headerDeviceId = server.header("X-Device-Id");
  String nonce = server.header("X-Lan-Nonce");
  String signature = server.header("X-Lan-Signature");

  headerDeviceId.trim();
  nonce.trim();
  signature.trim();
  signature.toLowerCase();

  if (
    headerDeviceId != deviceId ||
    !validLocalNonce(nonce) ||
    signature.length() != 64
  ) {
    return false;
  }

  String canonical =
    String("PHANTOM|LAN|V1|") +
    method + "|" +
    path + "|" +
    deviceId + "|" +
    nonce + "|" +
    sha256Hex(body);

  String expected =
    hmacSha256Hex(
      localLanKey(),
      canonical
    );

  return constantTimeHexEqual(expected, signature);
}

void handleLocalApiStatus() {
  String json = "{";

  json += "\"success\":true";
  json += ",\"device_id\":\"";
  json += deviceId;
  json += "\"";
  json += ",\"mode\":\"local_lan\"";
  json += ",\"motor1\":";
  json += motor1State ? "true" : "false";
  json += ",\"motor2\":";
  json += motor2State ? "true" : "false";
  json += ",\"online\":";
  json +=
    WiFi.status() == WL_CONNECTED
      ? "true"
      : "false";
  json += ",\"ip\":\"";
  json += WiFi.localIP().toString();
  json += "\"";
  json += "}";

  sendLocalCorsHeaders();

  server.send(
    200,
    "application/json",
    json
  );
}

void handleLocalApiControl() {
  String body =
    server.hasArg("plain")
      ? server.arg("plain")
      : "";

  if (
    !authenticateLocalRequest(
      "POST",
      "/api/local/control",
      body
    )
  ) {
    sendLocalCorsHeaders();

    server.send(
      401,
      "application/json",
      "{\"success\":false,\"error\":\"UNAUTHORIZED\"}"
    );

    return;
  }

  String compact = body;
  compact.replace(" ", "");
  compact.replace("\r", "");
  compact.replace("\n", "");
  compact.replace("\t", "");

  bool value;

  if (compact.indexOf("\"value\":true") >= 0) {
    value = true;
  } else if (compact.indexOf("\"value\":false") >= 0) {
    value = false;
  } else {
    sendLocalCorsHeaders();

    server.send(
      400,
      "application/json",
      "{\"success\":false,\"error\":\"INVALID_VALUE\"}"
    );

    return;
  }

  String controlId = "";

  if (
    compact.indexOf(
      "\"control_id\":\"motor1\""
    ) >= 0
  ) {
    controlId = "motor1";
    setMotor1(value);
  } else if (
    compact.indexOf(
      "\"control_id\":\"motor2\""
    ) >= 0
  ) {
    controlId = "motor2";
    setMotor2(value);
  } else {
    sendLocalCorsHeaders();

    server.send(
      400,
      "application/json",
      "{\"success\":false,\"error\":\"UNKNOWN_CONTROL\"}"
    );

    return;
  }

  String json = "{";

  json += "\"success\":true";
  json += ",\"device_id\":\"";
  json += deviceId;
  json += "\"";
  json += ",\"control_id\":\"";
  json += controlId;
  json += "\"";
  json += ",\"value\":";
  json += value ? "true" : "false";
  json += ",\"motor1\":";
  json += motor1State ? "true" : "false";
  json += ",\"motor2\":";
  json += motor2State ? "true" : "false";
  json += "}";

  sendLocalCorsHeaders();

  server.send(
    200,
    "application/json",
    json
  );
}

/* =====================================================
   WIFI RESET
===================================================== */

void handleResetWiFiPage() {
  String html =
    htmlHeader(
      "Reset Wi-Fi"
    );

  html += F(R"rawliteral(
<div class='card'>
  <h1>Reset Wi-Fi?</h1>

  <div class='subtitle'>
    This removes only Wi-Fi credentials.
    Factory identity remains untouched.
  </div>

  <form
    method='POST'
    action='/reset-wifi-confirm'
    style='margin-top:18px'
  >
    <button
      class='danger full'
      type='submit'
    >
      Confirm Wi-Fi Reset
    </button>
  </form>
</div>
)rawliteral");

  html += htmlFooter();

  server.send(
    200,
    "text/html",
    html
  );
}

void handleResetWiFiConfirm() {
  clearWiFiCredentials();

  server.send(
    200,
    "text/html",
    htmlHeader("Wi-Fi Reset") +
    F(
      "<div class='card'>"
      "<h1>Wi-Fi Reset</h1>"
      "<div class='success'>"
      "Identity preserved."
      "</div>"
      "<div class='subtitle'>"
      "Restarting..."
      "</div>"
      "</div>"
    ) +
    htmlFooter()
  );

  delay(1500);
  ESP.restart();
}

/* =====================================================
   NOT FOUND
===================================================== */

void handleNotFound() {
  if (setupMode) {
    server.sendHeader(
      "Location",
      "http://192.168.4.1/",
      true
    );

    server.send(
      302,
      "text/plain",
      ""
    );

    return;
  }

  server.send(
    404,
    "application/json",
    "{\"error\":\"NOT_FOUND\"}"
  );
}

/* =====================================================
   SETUP AP
===================================================== */

void startSetupMode() {
  setupMode = true;
  wifiConnected = false;

  WiFi.disconnect();

  delay(300);

  WiFi.mode(
    WIFI_AP_STA
  );

  /*
    Unique AP name, same setup IP.
  */

  String apSSID =
    "ESP-Setup-" +
    currentChipIdHex();

  bool apStarted =
    WiFi.softAP(
      apSSID.c_str(),
      "ESPSetup123"
    );

  Serial.println();
  Serial.println(
    F("==============================")
  );

  Serial.println(
    F("STARTING SETUP MODE")
  );

  Serial.println(
    F("==============================")
  );

  Serial.print(
    F("AP SSID: ")
  );

  Serial.println(
    apSSID
  );

  Serial.print(
    F("AP STARTED: ")
  );

  Serial.println(
    apStarted
      ? F("YES")
      : F("NO")
  );

  Serial.print(
    F("AP IP: ")
  );

  Serial.println(
    WiFi.softAPIP()
  );

  Serial.println(
    F("OPEN: http://192.168.4.1")
  );

  server.on(
    "/",
    HTTP_GET,
    handleSetupPage
  );

  server.on(
    "/save-wifi",
    HTTP_POST,
    handleSaveWiFi
  );

  server.on(
    "/status",
    HTTP_GET,
    handleStatus
  );

  server.onNotFound(
    handleNotFound
  );

  server.begin();
}

/* =====================================================
   NORMAL WIFI
===================================================== */

void connectSavedWiFi() {
  setupMode = false;

  Serial.println();
  Serial.println(
    F("NORMAL MODE")
  );

  Serial.print(
    F("CONNECTING TO: ")
  );

  Serial.println(
    savedSSID
  );

  WiFi.mode(
    WIFI_STA
  );

  WiFi.persistent(
    false
  );

  WiFi.begin(
    savedSSID.c_str(),
    savedPassword.c_str()
  );

  unsigned long started =
    millis();

  while (
    WiFi.status() !=
      WL_CONNECTED &&
    millis() - started <
      20000
  ) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();

  if (
    WiFi.status() ==
    WL_CONNECTED
  ) {
    wifiConnected = true;

    Serial.println(
      F("WIFI CONNECTED")
    );

    Serial.print(
      F("LOCAL IP: http://")
    );

    Serial.println(
      WiFi.localIP()
    );
  } else {
    wifiConnected = false;

    Serial.println(
      F("ROUTER CURRENTLY UNAVAILABLE")
    );

    Serial.println(
      F("SAVED WIFI RETAINED")
    );

    Serial.println(
      F("DEVICE WILL KEEP RETRYING")
    );
  }

  server.on(
    "/",
    HTTP_GET,
    handleLocalDashboard
  );

  server.on(
    "/motor1/toggle",
    HTTP_GET,
    handleMotor1Toggle
  );

  server.on(
    "/motor2/toggle",
    HTTP_GET,
    handleMotor2Toggle
  );

  server.on(
    "/status",
    HTTP_GET,
    handleStatus
  );

  server.collectHeaders(
  "X-Device-Id",
  "X-Lan-Nonce",
  "X-Lan-Signature"
);

  server.on(
    "/api/local/status",
    HTTP_GET,
    handleLocalApiStatus
  );

  server.on(
    "/api/local/status",
    HTTP_OPTIONS,
    handleLocalApiOptions
  );

  server.on(
    "/api/local/control",
    HTTP_POST,
    handleLocalApiControl
  );

  server.on(
    "/api/local/control",
    HTTP_OPTIONS,
    handleLocalApiOptions
  );

  server.on(
    "/reset-wifi",
    HTTP_GET,
    handleResetWiFiPage
  );

  server.on(
    "/reset-wifi-confirm",
    HTTP_POST,
    handleResetWiFiConfirm
  );

  server.onNotFound(
    handleNotFound
  );

  server.begin();

  Serial.println(
    F("LOCAL WEB SERVER STARTED")
  );
}

/* =====================================================
   WIFI RETRY
===================================================== */

void maintainWiFi() {
  if (
    setupMode ||
    !identityValid
  ) {
    return;
  }

  if (
    WiFi.status() ==
    WL_CONNECTED
  ) {
    if (!wifiConnected) {
      wifiConnected = true;

      Serial.println(
        F("WIFI RECONNECTED")
      );

      Serial.print(
        F("LOCAL IP: http://")
      );

      Serial.println(
        WiFi.localIP()
      );
    }

    return;
  }

  if (wifiConnected) {
    wifiConnected = false;

    Serial.println(
      F("WIFI CONNECTION LOST")
    );
  }

  if (
    millis() -
      lastWiFiRetry <
    WIFI_RETRY_INTERVAL
  ) {
    return;
  }

  lastWiFiRetry =
    millis();

  Serial.println(
    F("RETRYING SAVED WIFI...")
  );

  WiFi.disconnect();

  delay(100);

  WiFi.begin(
    savedSSID.c_str(),
    savedPassword.c_str()
  );
}

/* =====================================================
   SETUP
===================================================== */

void setup() {
  /*
    Safe outputs immediately.
  */

  pinMode(
    MOTOR1_PIN,
    OUTPUT
  );

  pinMode(
    MOTOR2_PIN,
    OUTPUT
  );

  digitalWrite(
    MOTOR1_PIN,
    OUTPUT_OFF
  );

  digitalWrite(
    MOTOR2_PIN,
    OUTPUT_OFF
  );

  motor1State = false;
  motor2State = false;

  Serial.begin(
    SERIAL_BAUD
  );

  Serial.setTimeout(
    100
  );

  delay(500);

  Serial.println();
  Serial.println();
  Serial.println(
    F("================================")
  );

  Serial.println(
    F("ESP CONTROL CENTER")
  );

  Serial.println(
    F("STAGE 2 FINAL TEST FIRMWARE")
  );

  Serial.println(
    F("================================")
  );

  EEPROM.begin(
    EEPROM_SIZE
  );

  /*
    SECURITY GATE:
    Stage-2 cannot create identity.
  */

  if (
    !loadFactoryIdentity()
  ) {
    printIdentityStatus();

    startLockedMode();

    printSerialHelp();

    return;
  }

  printIdentityStatus();

  /*
    Identity valid -> normal boot decision.
  */

  if (
    !hasSavedWiFi()
  ) {
    Serial.println(
      F("NO SAVED WIFI FOUND")
    );

    startSetupMode();
  } else {
    Serial.println(
      F("SAVED WIFI FOUND")
    );

    connectSavedWiFi();
  }

  printSerialHelp();
}

/* =====================================================
   LOOP
===================================================== */

void loop() {
  server.handleClient();

  maintainWiFi();

  handleSerialCommands();

  yield();
}
