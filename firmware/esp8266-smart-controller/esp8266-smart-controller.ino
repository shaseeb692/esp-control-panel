#include <Arduino.h>
#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClientSecureBearSSL.h>
#include <time.h>
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
   CLOUD / TLS / NTP
========================= */

static const char CLOUD_HOST[] = "esp-control-panel.vercel.app";
static const uint16_t CLOUD_PORT = 443;

static const char NTP_SERVER_1[] = "pool.ntp.org";
static const char NTP_SERVER_2[] = "time.google.com";
static const char NTP_SERVER_3[] = "time.cloudflare.com";

static const unsigned long NTP_RETRY_INTERVAL = 30000;
static const unsigned long SCHEDULE_SYNC_INTERVAL = 60000;
static const unsigned long SCHEDULE_SYNC_RETRY_INTERVAL = 15000;
static const unsigned long DEVICE_REGISTRATION_RETRY_INTERVAL = 15000;
static const unsigned long DEVICE_REGISTRATION_REFRESH_INTERVAL = 6UL * 60UL * 60UL * 1000UL;
static const unsigned long DEVICE_HEARTBEAT_INTERVAL = 30000;
static const unsigned long DEVICE_HEARTBEAT_RETRY_INTERVAL = 10000;
static const unsigned long DEVICE_COMMAND_POLL_INTERVAL = 2000;
static const unsigned long DEVICE_COMMAND_RETRY_INTERVAL = 5000;
static const char HARDWARE_MODEL[] = "ESP8266-NODEMCU-V3";
static const char FIRMWARE_VERSION[] = "26A";
static const time_t MIN_VALID_UNIX_TIME = 1704067200; // 2024-01-01 UTC

static const char GTS_ROOT_R1[] PROGMEM = R"EOF(
-----BEGIN CERTIFICATE-----
MIIFVzCCAz+gAwIBAgINAgPlk28xsBNJiGuiFzANBgkqhkiG9w0BAQwFADBHMQsw
CQYDVQQGEwJVUzEiMCAGA1UEChMZR29vZ2xlIFRydXN0IFNlcnZpY2VzIExMQzEU
MBIGA1UEAxMLR1RTIFJvb3QgUjEwHhcNMTYwNjIyMDAwMDAwWhcNMzYwNjIyMDAw
MDAwWjBHMQswCQYDVQQGEwJVUzEiMCAGA1UEChMZR29vZ2xlIFRydXN0IFNlcnZp
Y2VzIExMQzEUMBIGA1UEAxMLR1RTIFJvb3QgUjEwggIiMA0GCSqGSIb3DQEBAQUA
A4ICDwAwggIKAoICAQC2EQKLHuOhd5s73L+UPreVp0A8of2C+X0yBoJx9vaMf/vo
27xqLpeXo4xL+Sv2sfnOhB2x+cWX3u+58qPpvBKJXqeqUqv4IyfLpLGcY9vXmX7w
Cl7raKb0xlpHDU0QM+NOsROjyBhsS+z8CZDfnWQpJSMHobTSPS5g4M/SCYe7zUjw
TcLCeoiKu7rPWRnWr4+wB7CeMfGCwcDfLqZtbBkOtdh+JhpFAz2weaSUKK0Pfybl
qAj+lug8aJRT7oM6iCsVlgmy4HqMLnXWnOunVmSPlk9orj2XwoSPwLxAwAtcvfaH
szVsrBhQf4TgTM2S0yDpM7xSma8ytSmzJSq0SPly4cpk9+aCEI3oncKKiPo4Zor8
Y/kB+Xj9e1x3+naH+uzfsQ55lVe0vSbv1gHR6xYKu44LtcXFilWr06zqkUspzBmk
MiVOKvFlRNACzqrOSbTqn3yDsEB750Orp2yjj32JgfpMpf/VjsPOS+C12LOORc92
wO1AK/1TD7Cn1TsNsYqiA94xrcx36m97PtbfkSIS5r762DL8EGMUUXLeXdYWk70p
aDPvOmbsB4om3xPXV2V4J95eSRQAogB/mqghtqmxlbCluQ0WEdrHbEg8QOB+DVrN
VjzRlwW5y0vtOUucxD/SVRNuJLDWcfr0wbrM7Rv1/oFB2ACYPTrIrnqYNxgFlQID
AQABo0IwQDAOBgNVHQ8BAf8EBAMCAYYwDwYDVR0TAQH/BAUwAwEB/zAdBgNVHQ4E
FgQU5K8rJnEaK0gnhS9SZizv8IkTcT4wDQYJKoZIhvcNAQEMBQADggIBAJ+qQibb
C5u+/x6Wki4+omVKapi6Ist9wTrYggoGxval3sBOh2Z5ofmmWJyq+bXmYOfg6LEe
QkEzCzc9zolwFcq1JKjPa7XSQCGYzyI0zzvFIoTgxQ6KfF2I5DUkzps+GlQebtuy
h6f88/qBVRRiClmpIgUxPoLW7ttXNLwzldMXG+gnoot7TiYaelpkttGsN/H9oPM4
7HLwEXWdyzRSjeZ2axfG34arJ45JK3VmgRAhpuo+9K4l/3wV3s6MJT/KYnAK9y8J
ZgfIPxz88NtFMN9iiMG1D53Dn0reWVlHxYciNuaCp+0KueIHoI17eko8cdLiA6Ef
MgfdG+RCzgwARWGAtQsgWSl4vflVy2PFPEz0tv/bal8xa5meLMFrUKTX5hgUvYU/
Z6tGn6D/Qqc6f1zLXbBwHSs09dR2CQzreExZBfMzQsNhFRAbd03OIozUhfJFfbdT
6u9AWpQKXCBfTkBdYiJ23//OYb2MI3jSNwLgjt7RETeJ9r/tSQdirpLsQBqvFAnZ
0E6yove+7u7Y/9waLd64NnHi/Hm3lCXRSHNboTXns5lndcEZOitHTtNCjv0xyBZm
2tIMPNuzjsmhDYAPexZ3FL//2wmUspO8IFgV6dtxQ/PeEMMA3KgqlbbC1j+Qa3bb
bP6MvPJwNQzcmRk13NfIRmPVNnGuV/u3gm3c
-----END CERTIFICATE-----
)EOF";

BearSSL::X509List cloudTrustAnchor(GTS_ROOT_R1);

bool networkTimeValid = false;
unsigned long lastNtpRetry = 0;

unsigned long lastScheduleSyncAttempt = 0;
unsigned long lastScheduleSyncSuccess = 0;
unsigned long lastDeviceRegistrationAttempt = 0;
unsigned long lastDeviceRegistrationSuccess = 0;
bool deviceCloudRegistered = false;
unsigned long lastDeviceHeartbeatAttempt = 0;
unsigned long lastDeviceHeartbeatSuccess = 0;
unsigned long lastDeviceCommandPollAttempt = 0;
unsigned long lastDeviceCommandPollSuccess = 0;
uint64_t scheduleSnapshotVersion = 0;
String scheduleSnapshotJson = "";

static const uint8_t MAX_DEVICE_SCHEDULES = 24;

struct RuntimeSchedule {
  String id;
  String controlId;
  uint16_t onMinute;
  uint16_t offMinute;
  uint8_t daysMask;
  bool crossMidnight;
};

RuntimeSchedule runtimeSchedules[MAX_DEVICE_SCHEDULES];
uint8_t runtimeScheduleCount = 0;
uint64_t runtimeScheduleVersion = 0;
long lastScheduleMinuteKey = -1;

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
   NETWORK TIME + VERIFIED TLS
===================================================== */

bool hasValidNetworkTime() {
  time_t now = time(nullptr);

  return now >= MIN_VALID_UNIX_TIME;
}

void startNetworkTimeSync() {
  if (
    setupMode ||
    WiFi.status() != WL_CONNECTED
  ) {
    return;
  }

  Serial.println(
    F("STARTING NTP TIME SYNC")
  );

  /*
    Keep system time in UTC.

    Schedule timezone conversion/execution is added
    in Point 25C. TLS certificate validation only
    needs a correct absolute clock.
  */
  configTime(
    0,
    0,
    NTP_SERVER_1,
    NTP_SERVER_2,
    NTP_SERVER_3
  );

  lastNtpRetry = millis();
}

void maintainNetworkTime() {
  if (
    setupMode ||
    !identityValid ||
    WiFi.status() != WL_CONNECTED
  ) {
    networkTimeValid = false;
    return;
  }

  if (hasValidNetworkTime()) {
    if (!networkTimeValid) {
      networkTimeValid = true;

      time_t now = time(nullptr);

      Serial.print(
        F("NETWORK TIME READY: ")
      );

      Serial.println(
        (unsigned long)now
      );
    }

    return;
  }

  networkTimeValid = false;

  if (
    lastNtpRetry != 0 &&
    millis() - lastNtpRetry <
      NTP_RETRY_INTERVAL
  ) {
    return;
  }

  startNetworkTimeSync();
}

bool prepareVerifiedCloudClient(
  BearSSL::WiFiClientSecure &client
) {
  if (
    WiFi.status() != WL_CONNECTED ||
    !hasValidNetworkTime()
  ) {
    return false;
  }

  /*
    IMPORTANT:
    - No setInsecure().
    - Do not pin the short-lived *.vercel.app leaf cert.
    - Trust GTS Root R1 so normal Vercel certificate
      renewal does not break the device.
  */
  client.setTrustAnchors(
    &cloudTrustAnchor
  );

  client.setTimeout(15000);

  return true;
}

void printCloudFoundationStatus() {
  Serial.print(
    F("CLOUD HOST: ")
  );
  Serial.println(CLOUD_HOST);

  Serial.print(
    F("TLS MODE: ")
  );
  Serial.println(
    F("GTS ROOT R1 VERIFIED")
  );

  Serial.print(
    F("NTP: ")
  );
  Serial.println(
    hasValidNetworkTime()
      ? F("READY")
      : F("WAITING")
  );
}

/* =====================================================
   POINT 26B - SIGNED CLOUD HEARTBEAT
===================================================== */

bool sendDeviceHeartbeat() {
  if (
    setupMode ||
    !identityValid ||
    !deviceCloudRegistered ||
    WiFi.status() != WL_CONNECTED ||
    !hasValidNetworkTime()
  ) {
    return false;
  }

  String body =
    String("{\"device_id\":\"") +
    jsonEscape(deviceId) +
    "\",\"status_data\":{\"motor1\":" +
    (motor1State ? "true" : "false") +
    ",\"motor2\":" +
    (motor2State ? "true" : "false") +
    "},\"online\":true}";

  String timestamp =
    String((unsigned long)time(nullptr));

  String nonce = makeCloudNonce();

  String bodyHash = sha256Hex(body);

  String canonical =
    String("PHANTOM|HEARTBEAT|V1|") +
    deviceId + "|" +
    timestamp + "|" +
    nonce + "|" +
    bodyHash;

  String signature =
    hmacSha256Hex(
      deviceCloudHmacKey(),
      canonical
    );

  BearSSL::WiFiClientSecure client;

  if (!prepareVerifiedCloudClient(client)) {
    return false;
  }

  HTTPClient https;

  String url =
    String("https://") +
    CLOUD_HOST +
    "/api/device/status";

  if (!https.begin(client, url)) {
    Serial.println(F("HEARTBEAT: HTTPS BEGIN FAILED"));
    return false;
  }

  https.setTimeout(15000);
  https.addHeader("Content-Type", "application/json");
  https.addHeader("X-Device-Id", deviceId);
  https.addHeader("X-Device-Timestamp", timestamp);
  https.addHeader("X-Device-Nonce", nonce);
  https.addHeader("X-Device-Signature", signature);

  int statusCode =
    https.POST(
      (uint8_t *)body.c_str(),
      body.length()
    );

  String response = https.getString();
  https.end();

  if (
    statusCode < 200 ||
    statusCode >= 300
  ) {
    Serial.print(F("HEARTBEAT HTTP: "));
    Serial.println(statusCode);

    if (response.length() > 0) {
      Serial.print(F("HEARTBEAT BODY: "));
      Serial.println(response);
    }

    return false;
  }

  lastDeviceHeartbeatSuccess = millis();

  Serial.println(F("DEVICE HEARTBEAT: OK"));

  return true;
}

void maintainDeviceHeartbeat() {
  if (
    setupMode ||
    !identityValid ||
    !deviceCloudRegistered ||
    WiFi.status() != WL_CONNECTED ||
    !hasValidNetworkTime()
  ) {
    return;
  }

  unsigned long now = millis();

  unsigned long interval =
    lastDeviceHeartbeatSuccess == 0
      ? DEVICE_HEARTBEAT_RETRY_INTERVAL
      : DEVICE_HEARTBEAT_INTERVAL;

  if (
    lastDeviceHeartbeatAttempt != 0 &&
    now - lastDeviceHeartbeatAttempt < interval
  ) {
    return;
  }

  lastDeviceHeartbeatAttempt = now;
  sendDeviceHeartbeat();
}

/* =====================================================
   POINT 26C - SIGNED CLOUD COMMAND FETCH + ACK
===================================================== */

bool extractJsonBoolValue(
  const String &json,
  const String &key,
  bool &value
) {
  String needle = String("\"") + key + "\"";
  int keyPos = json.indexOf(needle);
  if (keyPos < 0) return false;

  int colon = json.indexOf(':', keyPos + needle.length());
  if (colon < 0) return false;

  int start = colon + 1;
  while (
    start < (int)json.length() &&
    (
      json[start] == ' ' ||
      json[start] == '\t' ||
      json[start] == '\r' ||
      json[start] == '\n'
    )
  ) start++;

  if (json.substring(start, start + 4) == "true") {
    value = true;
    return true;
  }

  if (json.substring(start, start + 5) == "false") {
    value = false;
    return true;
  }

  return false;
}

bool extractJsonNumberValue(
  const String &json,
  const String &key,
  double &value
) {
  String needle = String("\"") + key + "\"";
  int keyPos = json.indexOf(needle);
  if (keyPos < 0) return false;

  int colon = json.indexOf(':', keyPos + needle.length());
  if (colon < 0) return false;

  int start = colon + 1;
  while (
    start < (int)json.length() &&
    (
      json[start] == ' ' ||
      json[start] == '\t' ||
      json[start] == '\r' ||
      json[start] == '\n'
    )
  ) start++;

  int end = start;
  while (
    end < (int)json.length() &&
    (
      (json[end] >= '0' && json[end] <= '9') ||
      json[end] == '-' ||
      json[end] == '+' ||
      json[end] == '.' ||
      json[end] == 'e' ||
      json[end] == 'E'
    )
  ) end++;

  if (end <= start) return false;

  value = json.substring(start, end).toDouble();
  return true;
}

String makeCommandCanonical(
  const String &method,
  const String &timestamp,
  const String &nonce,
  const String &body
) {
  return
    String("PHANTOM|COMMAND|V1|") +
    method + "|" +
    deviceId + "|" +
    timestamp + "|" +
    nonce + "|" +
    sha256Hex(body);
}

bool acknowledgeCloudCommand(
  const String &commandId,
  const String &status
) {
  String body =
    String("{\"command_id\":\"") +
    jsonEscape(commandId) +
    "\",\"status\":\"" +
    jsonEscape(status) +
    "\"}";

  String timestamp =
    String((unsigned long)time(nullptr));

  String nonce = makeCloudNonce();

  String canonical =
    makeCommandCanonical(
      "PATCH",
      timestamp,
      nonce,
      body
    );

  String signature =
    hmacSha256Hex(
      deviceCloudHmacKey(),
      canonical
    );

  BearSSL::WiFiClientSecure client;

  if (!prepareVerifiedCloudClient(client)) {
    return false;
  }

  HTTPClient https;

  String url =
    String("https://") +
    CLOUD_HOST +
    "/api/device/commands";

  if (!https.begin(client, url)) {
    Serial.println(F("COMMAND ACK: HTTPS BEGIN FAILED"));
    return false;
  }

  https.setTimeout(15000);
  https.addHeader("Content-Type", "application/json");
  https.addHeader("X-Device-Id", deviceId);
  https.addHeader("X-Device-Timestamp", timestamp);
  https.addHeader("X-Device-Nonce", nonce);
  https.addHeader("X-Device-Signature", signature);

  int statusCode =
    https.sendRequest(
      "PATCH",
      (uint8_t *)body.c_str(),
      body.length()
    );

  String response = https.getString();
  https.end();

  if (
    statusCode < 200 ||
    statusCode >= 300
  ) {
    Serial.print(F("COMMAND ACK HTTP: "));
    Serial.println(statusCode);

    if (response.length() > 0) {
      Serial.print(F("COMMAND ACK BODY: "));
      Serial.println(response);
    }

    return false;
  }

  Serial.print(F("COMMAND ACK: "));
  Serial.print(commandId);
  Serial.print(F(" -> "));
  Serial.println(status);

  return true;
}

bool executeCloudCommandObject(
  const String &objectJson
) {
  String commandId;
  String commandText;

  if (
    !extractJsonStringValue(
      objectJson,
      "id",
      commandId
    )
  ) {
    Serial.println(F("COMMAND: MISSING ID"));
    return false;
  }

  if (
    !extractJsonStringValue(
      objectJson,
      "command",
      commandText
    )
  ) {
    Serial.println(F("COMMAND: MISSING COMMAND"));
    acknowledgeCloudCommand(commandId, "failed");
    return false;
  }

  commandText.trim();

  if (commandText == "STATUS") {
    bool acked =
      acknowledgeCloudCommand(
        commandId,
        "completed"
      );

    if (acked) {
      lastDeviceHeartbeatAttempt = 0;
    }

    return acked;
  }

  String controlId;
  bool boolValue = false;

  if (
    extractJsonStringValue(
      commandText,
      "control_id",
      controlId
    )
  ) {
    if (
      controlId == "motor1" ||
      controlId == "motor2"
    ) {
      if (
        !extractJsonBoolValue(
          commandText,
          "value",
          boolValue
        )
      ) {
        Serial.println(F("COMMAND: INVALID SWITCH VALUE"));
        acknowledgeCloudCommand(commandId, "failed");
        return false;
      }

      if (controlId == "motor1") {
        setMotor1(boolValue);
      } else {
        setMotor2(boolValue);
      }

      bool acked =
        acknowledgeCloudCommand(
          commandId,
          "completed"
        );

      if (acked) {
        // Push changed state immediately instead of waiting
        // for the normal heartbeat interval.
        lastDeviceHeartbeatAttempt = 0;
      }

      return acked;
    }

    /*
      Current hardware firmware exposes motor1/motor2.
      Future capability types (slider/number/button etc.)
      must be mapped to actual hardware before execution.
    */
    Serial.print(F("COMMAND: UNKNOWN CONTROL "));
    Serial.println(controlId);
    acknowledgeCloudCommand(commandId, "failed");
    return false;
  }

  Serial.println(F("COMMAND: INVALID PAYLOAD"));
  acknowledgeCloudCommand(commandId, "failed");
  return false;
}

bool processCloudCommandArray(
  const String &payload
) {
  int arrayStart = payload.indexOf('[');
  int arrayEnd = payload.lastIndexOf(']');

  if (
    arrayStart < 0 ||
    arrayEnd < arrayStart
  ) {
    Serial.println(F("COMMAND FETCH: INVALID ARRAY"));
    return false;
  }

  int cursor = arrayStart + 1;
  uint8_t processed = 0;

  while (cursor < arrayEnd) {
    int objectStart =
      payload.indexOf('{', cursor);

    if (
      objectStart < 0 ||
      objectStart >= arrayEnd
    ) {
      break;
    }

    int depth = 0;
    bool inString = false;
    bool escaped = false;
    int objectEnd = -1;

    for (
      int i = objectStart;
      i <= arrayEnd;
      i++
    ) {
      char c = payload[i];

      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (c == '\\') {
          escaped = true;
        } else if (c == '"') {
          inString = false;
        }
        continue;
      }

      if (c == '"') {
        inString = true;
        continue;
      }

      if (c == '{') depth++;

      if (c == '}') {
        depth--;

        if (depth == 0) {
          objectEnd = i;
          break;
        }
      }
    }

    if (objectEnd < 0) {
      Serial.println(F("COMMAND FETCH: BROKEN OBJECT"));
      return false;
    }

    String objectJson =
      payload.substring(
        objectStart,
        objectEnd + 1
      );

    executeCloudCommandObject(objectJson);

    processed++;
    cursor = objectEnd + 1;
    yield();
  }

  if (processed > 0) {
    Serial.print(F("COMMANDS PROCESSED: "));
    Serial.println(processed);
  }

  return true;
}

bool fetchCloudCommands() {
  if (
    setupMode ||
    !identityValid ||
    !deviceCloudRegistered ||
    WiFi.status() != WL_CONNECTED ||
    !hasValidNetworkTime()
  ) {
    return false;
  }

  String timestamp =
    String((unsigned long)time(nullptr));

  String nonce = makeCloudNonce();
  String body = "";

  String canonical =
    makeCommandCanonical(
      "GET",
      timestamp,
      nonce,
      body
    );

  String signature =
    hmacSha256Hex(
      deviceCloudHmacKey(),
      canonical
    );

  BearSSL::WiFiClientSecure client;

  if (!prepareVerifiedCloudClient(client)) {
    return false;
  }

  HTTPClient https;

  String url =
    String("https://") +
    CLOUD_HOST +
    "/api/device/commands";

  if (!https.begin(client, url)) {
    Serial.println(F("COMMAND FETCH: HTTPS BEGIN FAILED"));
    return false;
  }

  https.setTimeout(15000);
  https.addHeader("X-Device-Id", deviceId);
  https.addHeader("X-Device-Timestamp", timestamp);
  https.addHeader("X-Device-Nonce", nonce);
  https.addHeader("X-Device-Signature", signature);

  int statusCode = https.GET();
  String payload = https.getString();
  https.end();

  if (
    statusCode < 200 ||
    statusCode >= 300
  ) {
    Serial.print(F("COMMAND FETCH HTTP: "));
    Serial.println(statusCode);

    if (payload.length() > 0) {
      Serial.print(F("COMMAND FETCH BODY: "));
      Serial.println(payload);
    }

    return false;
  }

  if (!processCloudCommandArray(payload)) {
    return false;
  }

  lastDeviceCommandPollSuccess = millis();
  return true;
}

void maintainCloudCommands() {
  if (
    setupMode ||
    !identityValid ||
    !deviceCloudRegistered ||
    WiFi.status() != WL_CONNECTED ||
    !hasValidNetworkTime()
  ) {
    return;
  }

  unsigned long now = millis();

  unsigned long interval =
    lastDeviceCommandPollSuccess == 0
      ? DEVICE_COMMAND_RETRY_INTERVAL
      : DEVICE_COMMAND_POLL_INTERVAL;

  if (
    lastDeviceCommandPollAttempt != 0 &&
    now - lastDeviceCommandPollAttempt < interval
  ) {
    return;
  }

  lastDeviceCommandPollAttempt = now;
  fetchCloudCommands();
}

/* =====================================================
   POINT 25B - SIGNED CLOUD SCHEDULE SYNC
===================================================== */

String makeCloudNonce() {
  char buffer[33];

  snprintf(
    buffer,
    sizeof(buffer),
    "%08x%08x%08x%08x",
    ESP.getChipId(),
    ESP.getCycleCount(),
    os_random(),
    os_random()
  );

  return String(buffer);
}

String deviceCloudHmacKey() {
  /*
    Backend device auth uses the lowercase SHA-256 hex
    string of the raw device secret as UTF-8 HMAC key.
  */
  return sha256Hex(deviceSecret);
}


String jsonEscape(const String &value) {
  String out;
  out.reserve(value.length() + 8);

  for (size_t i = 0; i < value.length(); i++) {
    char c = value[i];

    switch (c) {
      case '"':  out += "\\\""; break;
      case '\\': out += "\\\\"; break;
      case '\b': out += "\\b"; break;
      case '\f': out += "\\f"; break;
      case '\n': out += "\\n"; break;
      case '\r': out += "\\r"; break;
      case '\t': out += "\\t"; break;
      default:
        if ((uint8_t)c >= 0x20) out += c;
        break;
    }
  }

  return out;
}

bool extractJsonStringValue(
  const String &json,
  const String &key,
  String &value
) {
  String needle = String("\"") + key + "\"";
  int keyPos = json.indexOf(needle);
  if (keyPos < 0) return false;

  int colon = json.indexOf(':', keyPos + needle.length());
  if (colon < 0) return false;

  int start = colon + 1;
  while (
    start < (int)json.length() &&
    (
      json[start] == ' ' ||
      json[start] == '\t' ||
      json[start] == '\r' ||
      json[start] == '\n'
    )
  ) {
    start++;
  }

  if (
    start >= (int)json.length() ||
    json[start] != '"'
  ) {
    return false;
  }

  start++;

  String parsed;
  bool escaped = false;

  for (int i = start; i < (int)json.length(); i++) {
    char c = json[i];

    if (escaped) {
      switch (c) {
        case '"':  parsed += '"'; break;
        case '\\': parsed += '\\'; break;
        case '/':  parsed += '/'; break;
        case 'b':  parsed += '\b'; break;
        case 'f':  parsed += '\f'; break;
        case 'n':  parsed += '\n'; break;
        case 'r':  parsed += '\r'; break;
        case 't':  parsed += '\t'; break;
        default:   parsed += c; break;
      }

      escaped = false;
      continue;
    }

    if (c == '\\') {
      escaped = true;
      continue;
    }

    if (c == '"') {
      value = parsed;
      return true;
    }

    parsed += c;
  }

  return false;
}

/* =====================================================
   POINT 26A - AUTOMATIC CLOUD DEVICE REGISTRATION
===================================================== */

bool requestDeviceRegistrationChallenge(
  String &challengeId,
  String &challenge
) {
  BearSSL::WiFiClientSecure client;

  if (!prepareVerifiedCloudClient(client)) {
    return false;
  }

  HTTPClient https;

  String url =
    String("https://") +
    CLOUD_HOST +
    "/api/device/register-challenge";

  if (!https.begin(client, url)) {
    Serial.println(F("REGISTER CHALLENGE: HTTPS BEGIN FAILED"));
    return false;
  }

  https.setTimeout(15000);
  https.addHeader("Content-Type", "application/json");

  String body =
    String("{\"device_id\":\"") +
    jsonEscape(deviceId) +
    "\",\"chip_id\":\"" +
    jsonEscape(storedChipId) +
    "\"}";

  int statusCode =
    https.POST((uint8_t *)body.c_str(), body.length());

  String response = https.getString();
  https.end();

  if (
    statusCode < 200 ||
    statusCode >= 300
  ) {
    Serial.print(F("REGISTER CHALLENGE HTTP: "));
    Serial.println(statusCode);

    if (response.length() > 0) {
      Serial.print(F("REGISTER CHALLENGE BODY: "));
      Serial.println(response);
    }

    return false;
  }

  if (
    !extractJsonStringValue(
      response,
      "challenge_id",
      challengeId
    ) ||
    !extractJsonStringValue(
      response,
      "challenge",
      challenge
    ) ||
    challengeId.length() == 0 ||
    challenge.length() == 0
  ) {
    Serial.println(F("REGISTER CHALLENGE: INVALID RESPONSE"));
    return false;
  }

  Serial.println(F("REGISTER CHALLENGE: OK"));
  return true;
}

bool registerDeviceWithCloud() {
  if (
    setupMode ||
    !identityValid ||
    WiFi.status() != WL_CONNECTED ||
    !hasValidNetworkTime()
  ) {
    return false;
  }

  String challengeId;
  String challenge;

  if (
    !requestDeviceRegistrationChallenge(
      challengeId,
      challenge
    )
  ) {
    return false;
  }

  String proofCanonical =
    String("PHANTOM|REGISTER|V1|") +
    deviceId + "|" +
    challengeId + "|" +
    challenge;

  /*
    Registration challenge proof uses the RAW birth
    DEVICE_SECRET as the HMAC-SHA256 key.
  */
  String challengeProof =
    hmacSha256Hex(
      deviceSecret,
      proofCanonical
    );

  BearSSL::WiFiClientSecure client;

  if (!prepareVerifiedCloudClient(client)) {
    return false;
  }

  HTTPClient https;

  String url =
    String("https://") +
    CLOUD_HOST +
    "/api/device/register";

  if (!https.begin(client, url)) {
    Serial.println(F("DEVICE REGISTER: HTTPS BEGIN FAILED"));
    return false;
  }

  https.setTimeout(15000);
  https.addHeader("Content-Type", "application/json");

  String body;
  body.reserve(
    420 +
    deviceSecretId.length()
  );

  body =
    String("{\"device_id\":\"") +
    jsonEscape(deviceId) +
    "\",\"chip_id\":\"" +
    jsonEscape(storedChipId) +
    "\",\"device_secret\":\"" +
    jsonEscape(deviceSecret) +
    "\",\"device_secret_id\":\"" +
    jsonEscape(deviceSecretId) +
    "\",\"map_version\":\"" +
    jsonEscape(storedMapVersion) +
    "\",\"hardware_model\":\"" +
    HARDWARE_MODEL +
    "\",\"firmware_version\":\"" +
    FIRMWARE_VERSION +
    "\",\"challenge_id\":\"" +
    jsonEscape(challengeId) +
    "\",\"challenge\":\"" +
    jsonEscape(challenge) +
    "\",\"challenge_proof\":\"" +
    challengeProof +
    "\"}";

  int statusCode =
    https.POST((uint8_t *)body.c_str(), body.length());

  String response = https.getString();
  https.end();

  if (
    statusCode < 200 ||
    statusCode >= 300
  ) {
    Serial.print(F("DEVICE REGISTER HTTP: "));
    Serial.println(statusCode);

    if (response.length() > 0) {
      Serial.print(F("DEVICE REGISTER BODY: "));
      Serial.println(response);
    }

    deviceCloudRegistered = false;
    return false;
  }

  deviceCloudRegistered = true;
  lastDeviceRegistrationSuccess = millis();

  Serial.println(F("DEVICE CLOUD REGISTRATION: OK"));

  if (response.length() > 0) {
    Serial.print(F("DEVICE REGISTER RESPONSE: "));
    Serial.println(response);
  }

  return true;
}

void maintainDeviceRegistration() {
  if (
    setupMode ||
    !identityValid ||
    WiFi.status() != WL_CONNECTED ||
    !hasValidNetworkTime()
  ) {
    return;
  }

  unsigned long now = millis();

  unsigned long interval =
    deviceCloudRegistered
      ? DEVICE_REGISTRATION_REFRESH_INTERVAL
      : DEVICE_REGISTRATION_RETRY_INTERVAL;

  if (
    lastDeviceRegistrationAttempt != 0 &&
    now - lastDeviceRegistrationAttempt < interval
  ) {
    return;
  }

  lastDeviceRegistrationAttempt = now;
  registerDeviceWithCloud();
}

bool extractUnsignedJsonInteger(
  const String &json,
  const String &key,
  uint64_t &value
) {
  String needle =
    String("\"") + key + "\":";

  int start = json.indexOf(needle);
  if (start < 0) return false;

  start += needle.length();

  while (
    start < (int)json.length() &&
    (
      json[start] == ' ' ||
      json[start] == '\t' ||
      json[start] == '\r' ||
      json[start] == '\n'
    )
  ) {
    start++;
  }

  if (
    start >= (int)json.length() ||
    json[start] < '0' ||
    json[start] > '9'
  ) {
    return false;
  }

  uint64_t parsed = 0;

  while (
    start < (int)json.length() &&
    json[start] >= '0' &&
    json[start] <= '9'
  ) {
    uint8_t digit =
      (uint8_t)(json[start] - '0');

    if (
      parsed >
      (UINT64_MAX - digit) / 10ULL
    ) {
      return false;
    }

    parsed =
      parsed * 10ULL + digit;

    start++;
  }

  value = parsed;
  return true;
}

bool fetchScheduleSnapshot() {
  if (
    setupMode ||
    !identityValid ||
    WiFi.status() != WL_CONNECTED ||
    !hasValidNetworkTime()
  ) {
    return false;
  }

  BearSSL::WiFiClientSecure client;

  if (
    !prepareVerifiedCloudClient(client)
  ) {
    return false;
  }

  HTTPClient https;

  String url =
    String("https://") +
    CLOUD_HOST +
    "/api/device/schedules";

  if (!https.begin(client, url)) {
    Serial.println(
      F("SCHEDULE SYNC: HTTPS BEGIN FAILED")
    );
    return false;
  }

  https.setTimeout(15000);

  String timestamp =
    String((unsigned long)time(nullptr));

  String nonce = makeCloudNonce();

  String emptyBodyHash =
    sha256Hex("");

  String canonical =
    String("PHANTOM|SCHEDULE|V1|GET|") +
    deviceId + "|" +
    timestamp + "|" +
    nonce + "|" +
    emptyBodyHash;

  String signature =
    hmacSha256Hex(
      deviceCloudHmacKey(),
      canonical
    );

  https.addHeader(
    "X-Device-Id",
    deviceId
  );

  https.addHeader(
    "X-Device-Timestamp",
    timestamp
  );

  https.addHeader(
    "X-Device-Nonce",
    nonce
  );

  https.addHeader(
    "X-Device-Signature",
    signature
  );

  int statusCode = https.GET();

  if (statusCode != HTTP_CODE_OK) {
    Serial.print(
      F("SCHEDULE SYNC HTTP: ")
    );
    Serial.println(statusCode);

    String errorBody =
      https.getString();

    if (errorBody.length() > 0) {
      Serial.print(
        F("SCHEDULE SYNC BODY: ")
      );

      Serial.println(errorBody);
    }

    https.end();
    return false;
  }

  String payload =
    https.getString();

  https.end();

  uint64_t incomingVersion = 0;

  if (
    !extractUnsignedJsonInteger(
      payload,
      "version",
      incomingVersion
    )
  ) {
    Serial.println(
      F("SCHEDULE SYNC: INVALID VERSION")
    );
    return false;
  }

  /*
    Point 25B intentionally stores the verified cloud
    snapshot without executing it yet.

    Point 25C will parse the compact schedules array
    into fixed RAM structs and execute ON/OFF edges.
  */
  if (
    incomingVersion != runtimeScheduleVersion ||
    runtimeScheduleVersion == 0
  ) {
    if (
      !parseScheduleSnapshotToRam(
        payload,
        incomingVersion
      )
    ) {
      Serial.println(
        F("SCHEDULE SYNC: RAM PARSE FAILED")
      );
      return false;
    }
  }

  scheduleSnapshotJson = payload;
  scheduleSnapshotVersion =
    incomingVersion;

  lastScheduleSyncSuccess =
    millis();

  Serial.print(
    F("SCHEDULE SYNC OK VERSION: ")
  );

  char versionBuffer[24];

  snprintf(
    versionBuffer,
    sizeof(versionBuffer),
    "%llu",
    (unsigned long long)
      scheduleSnapshotVersion
  );

  Serial.println(versionBuffer);

  Serial.print(
    F("SCHEDULE SNAPSHOT BYTES: ")
  );

  Serial.println(
    scheduleSnapshotJson.length()
  );

  return true;
}


bool extractJsonStringField(
  const String &objectJson,
  const String &key,
  String &value
) {
  String needle = String("\"") + key + "\":\"";
  int start = objectJson.indexOf(needle);
  if (start < 0) return false;
  start += needle.length();

  int end = start;
  bool escaped = false;

  while (end < (int)objectJson.length()) {
    char c = objectJson[end];
    if (!escaped && c == '"') break;
    if (!escaped && c == '\\') escaped = true;
    else escaped = false;
    end++;
  }

  if (end >= (int)objectJson.length()) return false;
  value = objectJson.substring(start, end);
  return true;
}

bool extractJsonUIntField(
  const String &objectJson,
  const String &key,
  uint32_t &value
) {
  uint64_t temp = 0;
  if (!extractUnsignedJsonInteger(objectJson, key, temp)) return false;
  if (temp > 0xFFFFFFFFULL) return false;
  value = (uint32_t)temp;
  return true;
}

bool parseClockMinute(
  const String &clockText,
  uint16_t &minuteOfDay
) {
  if (clockText.length() < 5) return false;
  if (clockText[2] != ':') return false;

  int hh =
    (clockText[0] - '0') * 10 +
    (clockText[1] - '0');

  int mm =
    (clockText[3] - '0') * 10 +
    (clockText[4] - '0');

  if (
    clockText[0] < '0' || clockText[0] > '9' ||
    clockText[1] < '0' || clockText[1] > '9' ||
    clockText[3] < '0' || clockText[3] > '9' ||
    clockText[4] < '0' || clockText[4] > '9' ||
    hh < 0 || hh > 23 ||
    mm < 0 || mm > 59
  ) {
    return false;
  }

  minuteOfDay = (uint16_t)(hh * 60 + mm);
  return true;
}

bool applyScheduleControl(
  const String &controlId,
  bool turnOn
) {
  if (controlId == "motor1") {
    setMotor1(turnOn);
    return true;
  }

  if (controlId == "motor2") {
    setMotor2(turnOn);
    return true;
  }

  Serial.print(F("SCHEDULE: UNKNOWN CONTROL "));
  Serial.println(controlId);
  return false;
}

bool parseScheduleSnapshotToRam(
  const String &json,
  uint64_t version
) {
  int schedulesKey = json.indexOf("\"schedules\"");
  if (schedulesKey < 0) return false;

  int arrayStart = json.indexOf('[', schedulesKey);
  if (arrayStart < 0) return false;

  int arrayEnd = json.indexOf(']', arrayStart);
  if (arrayEnd < 0) return false;

  RuntimeSchedule parsed[MAX_DEVICE_SCHEDULES];
  uint8_t parsedCount = 0;
  int cursor = arrayStart + 1;

  while (
    cursor < arrayEnd &&
    parsedCount < MAX_DEVICE_SCHEDULES
  ) {
    int objectStart = json.indexOf('{', cursor);
    if (
      objectStart < 0 ||
      objectStart >= arrayEnd
    ) break;

    int objectEnd = json.indexOf('}', objectStart);
    if (
      objectEnd < 0 ||
      objectEnd > arrayEnd
    ) return false;

    String objectJson =
      json.substring(objectStart, objectEnd + 1);

    String id;
    String controlId;
    String onText;
    String offText;
    String timezone;
    uint32_t daysMask = 0;
    uint16_t onMinute = 0;
    uint16_t offMinute = 0;

    if (
      !extractJsonStringField(objectJson, "id", id) ||
      !extractJsonStringField(objectJson, "c", controlId) ||
      !extractJsonStringField(objectJson, "on", onText) ||
      !extractJsonStringField(objectJson, "off", offText) ||
      !extractJsonUIntField(objectJson, "d", daysMask) ||
      !extractJsonStringField(objectJson, "tz", timezone) ||
      !parseClockMinute(onText, onMinute) ||
      !parseClockMinute(offText, offMinute) ||
      daysMask > 127
    ) {
      Serial.println(F("SCHEDULE PARSE: INVALID ENTRY"));
      return false;
    }

    // Current UI/source of truth is Asia/Karachi.
    if (
      timezone != "Asia/Karachi" &&
      timezone != "PKT"
    ) {
      Serial.print(F("SCHEDULE PARSE: UNSUPPORTED TZ "));
      Serial.println(timezone);
      return false;
    }

    parsed[parsedCount].id = id;
    parsed[parsedCount].controlId = controlId;
    parsed[parsedCount].onMinute = onMinute;
    parsed[parsedCount].offMinute = offMinute;
    parsed[parsedCount].daysMask = (uint8_t)daysMask;
    parsed[parsedCount].crossMidnight =
      offMinute <= onMinute;

    parsedCount++;
    cursor = objectEnd + 1;
  }

  for (uint8_t i = 0; i < parsedCount; i++) {
    runtimeSchedules[i] = parsed[i];
  }

  runtimeScheduleCount = parsedCount;
  runtimeScheduleVersion = version;
  lastScheduleMinuteKey = -1;

  Serial.print(F("SCHEDULE RAM LOADED: "));
  Serial.println(runtimeScheduleCount);

  return true;
}

uint8_t mondayBasedDayBit(const tm &localTm) {
  // tm_wday: Sun=0, Mon=1 ... Sat=6
  uint8_t mondayIndex =
    localTm.tm_wday == 0
      ? 6
      : (uint8_t)(localTm.tm_wday - 1);

  return (uint8_t)(1U << mondayIndex);
}

uint8_t previousMondayBasedDayBit(const tm &localTm) {
  uint8_t mondayIndex =
    localTm.tm_wday == 0
      ? 6
      : (uint8_t)(localTm.tm_wday - 1);

  uint8_t previousIndex =
    mondayIndex == 0 ? 6 : mondayIndex - 1;

  return (uint8_t)(1U << previousIndex);
}

void executeScheduleEdges() {
  if (
    runtimeScheduleCount == 0 ||
    !hasValidNetworkTime()
  ) {
    return;
  }

  time_t utcNow = time(nullptr);

  // Asia/Karachi / PKT = UTC+05:00, no DST.
  time_t pktNow = utcNow + 5 * 60 * 60;

  tm localTm;
  gmtime_r(&pktNow, &localTm);

  long minuteKey =
    (long)(pktNow / 60);

  if (minuteKey == lastScheduleMinuteKey) {
    return;
  }

  lastScheduleMinuteKey = minuteKey;

  uint16_t nowMinute =
    (uint16_t)(
      localTm.tm_hour * 60 +
      localTm.tm_min
    );

  uint8_t todayBit =
    mondayBasedDayBit(localTm);

  uint8_t previousDayBit =
    previousMondayBasedDayBit(localTm);

  /*
    Edge semantics:
    - Selected day applies to the ON/start day.
    - Same-day OFF uses the same selected day.
    - If off <= on, OFF belongs to the next day.
    - Multiple schedules are independent event edges.
    - Outside a schedule window we do NOT force a control OFF,
      so manual control remains possible.
  */
  for (
    uint8_t i = 0;
    i < runtimeScheduleCount;
    i++
  ) {
    RuntimeSchedule &schedule =
      runtimeSchedules[i];

    if (
      nowMinute == schedule.onMinute &&
      (schedule.daysMask & todayBit)
    ) {
      Serial.print(F("SCHEDULE ON: "));
      Serial.println(schedule.controlId);
      applyScheduleControl(
        schedule.controlId,
        true
      );
    }

    bool offDue = false;

    if (schedule.crossMidnight) {
      offDue =
        nowMinute == schedule.offMinute &&
        (schedule.daysMask & previousDayBit);
    } else {
      offDue =
        nowMinute == schedule.offMinute &&
        (schedule.daysMask & todayBit);
    }

    if (offDue) {
      Serial.print(F("SCHEDULE OFF: "));
      Serial.println(schedule.controlId);
      applyScheduleControl(
        schedule.controlId,
        false
      );
    }
  }
}

void maintainScheduleSync() {
  if (
    setupMode ||
    !identityValid ||
    WiFi.status() != WL_CONNECTED ||
    !hasValidNetworkTime()
  ) {
    return;
  }

  unsigned long now = millis();

  unsigned long interval =
    lastScheduleSyncSuccess == 0
      ? SCHEDULE_SYNC_RETRY_INTERVAL
      : SCHEDULE_SYNC_INTERVAL;

  if (
    lastScheduleSyncAttempt != 0 &&
    now - lastScheduleSyncAttempt <
      interval
  ) {
    return;
  }

  lastScheduleSyncAttempt = now;

  fetchScheduleSnapshot();
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

    startNetworkTimeSync();
    printCloudFoundationStatus();
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

      startNetworkTimeSync();
      printCloudFoundationStatus();
    }

    return;
  }

  if (wifiConnected) {
    wifiConnected = false;
    deviceCloudRegistered = false;
    lastDeviceRegistrationAttempt = 0;
    lastDeviceHeartbeatAttempt = 0;
    lastDeviceHeartbeatSuccess = 0;
    lastDeviceCommandPollAttempt = 0;
    lastDeviceCommandPollSuccess = 0;

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

  maintainNetworkTime();

  maintainDeviceRegistration();

  maintainDeviceHeartbeat();

  maintainCloudCommands();

  maintainScheduleSync();

  executeScheduleEdges();

  handleSerialCommands();

  yield();
}
