#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>
#include <EEPROM.h>

/* =====================================================
   ESP CONTROL CENTER — PHASE 1

   Features:
   - D1 / GPIO5 = LED 1 / Motor 1 simulation
   - D2 / GPIO4 = LED 2 / Motor 2 simulation

   - No saved Wi-Fi:
       -> Setup AP
       -> 192.168.4.1

   - Saved Wi-Fi:
       -> Connect to router
       -> Local control page

   - Wi-Fi credentials stored in EEPROM
   - Router unavailable:
       -> Keep retrying saved Wi-Fi
       -> DO NOT automatically erase/reset Wi-Fi

   - Local LAN control
   - JSON status API
   - Wi-Fi reset from local page

   TEST OUTPUT LOGIC:
       HIGH = LED ON
       LOW  = LED OFF

   Later when using active-low relays:
       OUTPUT_ON  = LOW
       OUTPUT_OFF = HIGH
===================================================== */


/* =====================================================
   PINS
===================================================== */

#define MOTOR1_PIN D1
#define MOTOR2_PIN D2

#define OUTPUT_ON  HIGH
#define OUTPUT_OFF LOW


/* =====================================================
   EEPROM
===================================================== */

#define EEPROM_SIZE 512

#define WIFI_MAGIC_ADDRESS 0

const char WIFI_MAGIC[] = "ESPWF1";

#define SSID_ADDRESS     16
#define PASSWORD_ADDRESS 80

#define SSID_MAX_LENGTH     32
#define PASSWORD_MAX_LENGTH 64


/* =====================================================
   AP CONFIGURATION
===================================================== */

const char* SETUP_AP_SSID = "ESP-Control-Setup";

/*
   Temporary setup password.

   Later we can replace this with device-specific
   setup credentials.
*/
const char* SETUP_AP_PASSWORD = "ESPSetup123";


/* =====================================================
   WIFI
===================================================== */

String savedSSID = "";
String savedPassword = "";

bool setupMode = false;
bool wifiConnected = false;


/* =====================================================
   OUTPUT STATES
===================================================== */

bool motor1State = false;
bool motor2State = false;


/* =====================================================
   WEB SERVER
===================================================== */

ESP8266WebServer server(80);


/* =====================================================
   WIFI RETRY
===================================================== */

unsigned long lastWiFiRetry = 0;

const unsigned long WIFI_RETRY_INTERVAL = 10000;


/* =====================================================
   SERIAL
===================================================== */

const unsigned long SERIAL_BAUD = 115200;


/* =====================================================
   HTML HELPERS
===================================================== */

String htmlHeader(String title) {
  String html;

  html += F("<!DOCTYPE html>");
  html += F("<html lang='en'>");

  html += F("<head>");

  html += F(
    "<meta charset='UTF-8'>"
  );

  html += F(
    "<meta name='viewport' "
    "content='width=device-width,"
    "initial-scale=1,"
    "maximum-scale=1'>"
  );

  html += "<title>";
  html += title;
  html += "</title>";

  html += F(R"rawliteral(

<style>

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  padding: 20px;
  min-height: 100vh;

  font-family:
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    Roboto,
    Arial,
    sans-serif;

  background:
    linear-gradient(
      160deg,
      #07141d 0%,
      #0d2630 45%,
      #102f38 100%
    );

  color: #ffffff;
}

.container {
  width: 100%;
  max-width: 560px;
  margin: 0 auto;
}

.brand {
  margin-bottom: 24px;
}

.brand-small {
  color: #42b8c5;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 1.4px;
  text-transform: uppercase;
}

h1 {
  margin: 6px 0 0 0;
  font-size: 28px;
}

.subtitle {
  margin-top: 8px;
  color: rgba(255,255,255,.62);
  line-height: 1.6;
}

.card {
  margin-top: 16px;
  padding: 20px;

  border:
    1px solid rgba(255,255,255,.12);

  border-radius: 22px;

  background:
    rgba(0,0,0,.24);

  box-shadow:
    0 16px 50px rgba(0,0,0,.18);
}

.label {
  margin-bottom: 7px;

  color:
    rgba(255,255,255,.60);

  font-size: 12px;
}

.value {
  font-size: 17px;
  font-weight: 650;
}

.row {
  display: flex;
  gap: 12px;
}

.row > div {
  flex: 1;
}

input,
select {
  width: 100%;

  margin-top: 7px;
  margin-bottom: 16px;

  padding: 14px;

  border:
    1px solid rgba(255,255,255,.15);

  border-radius: 14px;

  outline: none;

  background:
    rgba(255,255,255,.08);

  color: #ffffff;

  font-size: 15px;
}

input:focus,
select:focus {
  border-color: #42b8c5;
}

button,
.button {
  display: inline-flex;

  align-items: center;
  justify-content: center;

  min-height: 46px;

  padding: 12px 18px;

  border: 0;
  border-radius: 14px;

  cursor: pointer;

  background: #42b8c5;
  color: #ffffff;

  font-size: 14px;
  font-weight: 700;

  text-decoration: none;
}

.button-secondary {
  background:
    rgba(255,255,255,.10);

  border:
    1px solid rgba(255,255,255,.12);
}

.button-danger {
  background: #dc3545;
}

.full {
  width: 100%;
}

.device {
  display: flex;

  align-items: center;
  justify-content: space-between;

  gap: 14px;

  margin-top: 12px;

  padding: 16px;

  border:
    1px solid rgba(255,255,255,.10);

  border-radius: 17px;

  background:
    rgba(255,255,255,.05);
}

.device-name {
  font-weight: 700;
}

.device-state {
  margin-top: 4px;

  color:
    rgba(255,255,255,.55);

  font-size: 12px;
}

.status-dot {
  display: inline-block;

  width: 8px;
  height: 8px;

  margin-right: 6px;

  border-radius: 50%;
}

.on {
  background: #22c55e;
}

.off {
  background: #ef4444;
}

.info-grid {
  display: grid;

  grid-template-columns:
    repeat(2, 1fr);

  gap: 12px;
}

.info-box {
  padding: 14px;

  border-radius: 15px;

  background:
    rgba(255,255,255,.05);
}

.warning {
  color: #fbbf24;
}

.success {
  color: #4ade80;
}

.footer {
  margin-top: 24px;

  color:
    rgba(255,255,255,.35);

  font-size: 11px;

  text-align: center;
}

@media (max-width: 480px) {

  body {
    padding: 14px;
  }

  .card {
    padding: 17px;
  }

  .info-grid {
    grid-template-columns: 1fr;
  }

}

</style>

)rawliteral");

  html += F("</head><body>");

  html += F(
    "<div class='container'>"
  );

  return html;
}


String htmlFooter() {

  return F(
    "<div class='footer'>"
    "ESP Control Center"
    "</div>"
    "</div>"
    "</body>"
    "</html>"
  );

}


/* =====================================================
   EEPROM STRING WRITE
===================================================== */

void writeStringToEEPROM(
  int address,
  const String& value,
  int maxLength
) {

  for (int i = 0; i < maxLength; i++) {

    char c = 0;

    if (i < (int)value.length()) {
      c = value[i];
    }

    EEPROM.write(
      address + i,
      c
    );
  }
}


/* =====================================================
   EEPROM STRING READ
===================================================== */

String readStringFromEEPROM(
  int address,
  int maxLength
) {

  String value = "";

  for (int i = 0; i < maxLength; i++) {

    char c =
      (char)EEPROM.read(
        address + i
      );

    if (c == 0 ||
        c == (char)0xFF) {
      break;
    }

    value += c;
  }

  return value;
}


/* =====================================================
   CHECK SAVED WIFI
===================================================== */

bool hasSavedWiFi() {

  for (
    unsigned int i = 0;
    i < strlen(WIFI_MAGIC);
    i++
  ) {

    if (
      EEPROM.read(
        WIFI_MAGIC_ADDRESS + i
      ) != WIFI_MAGIC[i]
    ) {

      return false;
    }
  }

  savedSSID =
    readStringFromEEPROM(
      SSID_ADDRESS,
      SSID_MAX_LENGTH
    );

  savedPassword =
    readStringFromEEPROM(
      PASSWORD_ADDRESS,
      PASSWORD_MAX_LENGTH
    );

  if (savedSSID.length() == 0) {
    return false;
  }

  return true;
}


/* =====================================================
   SAVE WIFI
===================================================== */

void saveWiFiCredentials(
  const String& ssid,
  const String& password
) {

  Serial.println();
  Serial.println(
    F("SAVING WIFI CREDENTIALS")
  );

  for (
    unsigned int i = 0;
    i < strlen(WIFI_MAGIC);
    i++
  ) {

    EEPROM.write(
      WIFI_MAGIC_ADDRESS + i,
      WIFI_MAGIC[i]
    );
  }

  writeStringToEEPROM(
    SSID_ADDRESS,
    ssid,
    SSID_MAX_LENGTH
  );

  writeStringToEEPROM(
    PASSWORD_ADDRESS,
    password,
    PASSWORD_MAX_LENGTH
  );

  EEPROM.commit();

  savedSSID = ssid;
  savedPassword = password;

  Serial.println(
    F("WIFI CREDENTIALS SAVED")
  );
}


/* =====================================================
   CLEAR WIFI
===================================================== */

void clearWiFiCredentials() {

  Serial.println();
  Serial.println(
    F("CLEARING WIFI CREDENTIALS")
  );

  for (
    int i = 0;
    i < EEPROM_SIZE;
    i++
  ) {

    EEPROM.write(i, 0);
  }

  EEPROM.commit();

  savedSSID = "";
  savedPassword = "";

  Serial.println(
    F("WIFI CREDENTIALS CLEARED")
  );
}


/* =====================================================
   OUTPUT CONTROL
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
   WIFI NETWORK SCAN OPTIONS
===================================================== */

String buildWiFiOptions() {

  Serial.println();
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

  for (int i = 0; i < count; i++) {

    String ssid =
      WiFi.SSID(i);

    int rssi =
      WiFi.RSSI(i);

    options +=
      "<option value='";

    options += ssid;

    options += "'>";

    options += ssid;

    options += " (";

    options += String(rssi);

    options += " dBm)";

    options += "</option>";
  }

  WiFi.scanDelete();

  return options;
}


/* =====================================================
   AP SETUP PAGE
===================================================== */

void handleSetupPage() {

  String html =
    htmlHeader(
      "ESP Wi-Fi Setup"
    );

  html += F(R"rawliteral(

<div class='brand'>
  <div class='brand-small'>
    ESP Control Center
  </div>

  <h1>Wi-Fi Setup</h1>

  <div class='subtitle'>
    Connect this device to your home Wi-Fi network.
  </div>
</div>

<div class='card'>

  <form
    method='POST'
    action='/save-wifi'
  >

    <label>
      Wi-Fi Network
    </label>

    <select name='ssid' required>

)rawliteral");

  html += buildWiFiOptions();

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

<div class='card'>

  <div class='label'>
    Setup Network
  </div>

  <div class='value'>
    ESP-Control-Setup
  </div>

  <div
    class='subtitle'
    style='margin-top:10px'
  >
    This setup page is only used to configure
    the device Wi-Fi connection.
  </div>

</div>

)rawliteral");

  html += htmlFooter();

  server.send(
    200,
    "text/html",
    html
  );
}


/* =====================================================
   SAVE WIFI HANDLER
===================================================== */

void handleSaveWiFi() {

  if (!server.hasArg("ssid")) {

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

  if (ssid.length() == 0) {

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

  html += F(R"rawliteral(

<div class='brand'>

  <div class='brand-small'>
    ESP Control Center
  </div>

  <h1>Wi-Fi Saved</h1>

  <div class='subtitle'>
    The device will now restart and connect
    to your Wi-Fi network.
  </div>

</div>

<div class='card'>

  <div class='success'>
    Wi-Fi credentials saved successfully.
  </div>

  <div
    class='subtitle'
    style='margin-top:12px'
  >
    Wait around 10 seconds, then check the
    Serial Monitor for the device local IP.
  </div>

</div>

)rawliteral");

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
   LOCAL DASHBOARD
===================================================== */

void handleLocalDashboard() {

  String html =
    htmlHeader(
      "ESP Control Center"
    );

  html += F(R"rawliteral(

<div class='brand'>

  <div class='brand-small'>
    ESP Control Center
  </div>

  <h1>Device Control</h1>

  <div class='subtitle'>
    Local LAN control
  </div>

</div>

<div class='card'>

  <div class='info-grid'>

    <div class='info-box'>

      <div class='label'>
        Wi-Fi
      </div>

      <div class='value success'>
        Connected
      </div>

    </div>

    <div class='info-box'>

      <div class='label'>
        Local IP
      </div>

      <div class='value'>

)rawliteral");

  html +=
    WiFi.localIP().toString();

  html += F(R"rawliteral(

      </div>

    </div>

    <div class='info-box'>

      <div class='label'>
        Network
      </div>

      <div class='value'>

)rawliteral");

  html += WiFi.SSID();

  html += F(R"rawliteral(

      </div>

    </div>

    <div class='info-box'>

      <div class='label'>
        Signal
      </div>

      <div class='value'>

)rawliteral");

  html += String(
    WiFi.RSSI()
  );

  html += F(" dBm");

  html += F(R"rawliteral(

      </div>

    </div>

  </div>

</div>

<div class='card'>

  <div class='label'>
    LOCAL CONTROLS
  </div>

)rawliteral");


  /* MOTOR 1 */

  html += F(
    "<div class='device'>"
  );

  html += F(
    "<div>"
    "<div class='device-name'>"
    "Motor 1 / LED 1"
    "</div>"
    "<div class='device-state'>"
  );

  html +=
    "<span class='status-dot ";

  html +=
    motor1State
      ? "on"
      : "off";

  html +=
    "'></span>";

  html +=
    motor1State
      ? "ON"
      : "OFF";

  html += F(
    "</div>"
    "</div>"
  );

  html +=
    "<a class='button' href='/motor1/toggle'>";

  html +=
    motor1State
      ? "Turn OFF"
      : "Turn ON";

  html +=
    "</a>";

  html +=
    "</div>";


  /* MOTOR 2 */

  html += F(
    "<div class='device'>"
  );

  html += F(
    "<div>"
    "<div class='device-name'>"
    "Motor 2 / LED 2"
    "</div>"
    "<div class='device-state'>"
  );

  html +=
    "<span class='status-dot ";

  html +=
    motor2State
      ? "on"
      : "off";

  html +=
    "'></span>";

  html +=
    motor2State
      ? "ON"
      : "OFF";

  html += F(
    "</div>"
    "</div>"
  );

  html +=
    "<a class='button' href='/motor2/toggle'>";

  html +=
    motor2State
      ? "Turn OFF"
      : "Turn ON";

  html +=
    "</a>";

  html +=
    "</div>";


  html += F(R"rawliteral(

</div>


<div class='card'>

  <div class='label'>
    DEVICE SETUP
  </div>

  <div
    class='subtitle'
    style='margin-bottom:16px'
  >
    The Connect Device QR flow will be added
    in the next firmware phase.
  </div>

  <a
    class='button button-secondary full'
    href='/status'
  >
    View JSON Status
  </a>

</div>


<div class='card'>

  <div class='label'>
    WI-FI SETTINGS
  </div>

  <div
    class='subtitle'
    style='margin-bottom:16px'
  >
    Reset only the saved Wi-Fi credentials.
    Device identity and ownership will remain
    separate from Wi-Fi configuration.
  </div>

  <a
    class='button button-danger full'
    href='/reset-wifi'
  >
    Reset Wi-Fi
  </a>

</div>

)rawliteral");

  html += htmlFooter();

  server.send(
    200,
    "text/html",
    html
  );
}


/* =====================================================
   MOTOR TOGGLE HANDLERS
===================================================== */

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
   JSON STATUS
===================================================== */

void handleStatus() {

  String json = "{";

  json +=
    "\"online\":";

  json +=
    wifiConnected
      ? "true"
      : "false";

  json += ",";


  json +=
    "\"mode\":\"";

  json +=
    setupMode
      ? "setup"
      : "normal";

  json += "\",";


  json +=
    "\"motor1\":";

  json +=
    motor1State
      ? "true"
      : "false";

  json += ",";


  json +=
    "\"motor2\":";

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

    json += WiFi.SSID();

    json += "\"";


    json +=
      ",\"ip\":\"";

    json +=
      WiFi.localIP()
        .toString();

    json += "\"";


    json +=
      ",\"rssi\":";

    json += String(
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
   RESET WIFI PAGE
===================================================== */

void handleResetWiFiPage() {

  String html =
    htmlHeader(
      "Reset Wi-Fi"
    );

  html += F(R"rawliteral(

<div class='brand'>

  <div class='brand-small'>
    ESP Control Center
  </div>

  <h1>Reset Wi-Fi?</h1>

  <div class='subtitle'>
    This will remove only the saved Wi-Fi
    network credentials.
  </div>

</div>


<div class='card'>

  <div class='warning'>
    The ESP will restart in Setup Mode.
  </div>

  <div
    class='subtitle'
    style='margin-top:10px'
  >
    Device identity, ownership and future
    security information are separate and
    will not be erased by this action.
  </div>

  <form
    method='POST'
    action='/reset-wifi-confirm'
    style='margin-top:18px'
  >

    <button
      class='button-danger full'
      type='submit'
    >
      Confirm Wi-Fi Reset
    </button>

  </form>

  <a
    class='button button-secondary full'
    style='margin-top:10px'
    href='/'
  >
    Cancel
  </a>

</div>

)rawliteral");

  html += htmlFooter();

  server.send(
    200,
    "text/html",
    html
  );
}


/* =====================================================
   RESET WIFI CONFIRM
===================================================== */

void handleResetWiFiConfirm() {

  clearWiFiCredentials();

  String html =
    htmlHeader(
      "Wi-Fi Reset"
    );

  html += F(R"rawliteral(

<div class='brand'>

  <div class='brand-small'>
    ESP Control Center
  </div>

  <h1>Wi-Fi Reset</h1>

  <div class='subtitle'>
    Saved Wi-Fi credentials were removed.
  </div>

</div>


<div class='card'>

  <div class='success'>
    Restarting device...
  </div>

  <div
    class='subtitle'
    style='margin-top:10px'
  >
    Connect to ESP-Control-Setup after the
    restart and open 192.168.4.1.
  </div>

</div>

)rawliteral");

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
   NOT FOUND
===================================================== */

void handleNotFound() {

  if (setupMode) {

    /*
      Helpful for phones that probe random URLs
      while connected to a setup AP.
    */

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
   START SETUP AP
===================================================== */

void startSetupMode() {

  setupMode = true;
  wifiConnected = false;

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


  WiFi.disconnect();

  delay(300);


  WiFi.mode(
    WIFI_AP_STA
  );


  bool apStarted =
    WiFi.softAP(
      SETUP_AP_SSID,
      SETUP_AP_PASSWORD
    );


  if (!apStarted) {

    Serial.println(
      F("ERROR: AP FAILED TO START")
    );

  } else {

    Serial.print(
      F("AP SSID: ")
    );

    Serial.println(
      SETUP_AP_SSID
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
  }


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


  Serial.println(
    F("SETUP WEB SERVER STARTED")
  );
}


/* =====================================================
   CONNECT SAVED WIFI
===================================================== */

void connectSavedWiFi() {

  setupMode = false;

  Serial.println();
  Serial.println(
    F("==============================")
  );

  Serial.println(
    F("NORMAL MODE")
  );

  Serial.println(
    F("==============================")
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


  WiFi.persistent(false);


  WiFi.begin(
    savedSSID.c_str(),
    savedPassword.c_str()
  );


  /*
    Initial connection attempt.

    IMPORTANT:
    Failure here DOES NOT start setup AP.

    Saved credentials remain saved and the
    loop() keeps retrying the router.
  */

  unsigned long start =
    millis();


  while (
    WiFi.status() !=
      WL_CONNECTED &&
    millis() - start < 20000
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


    Serial.print(
      F("SIGNAL: ")
    );

    Serial.print(
      WiFi.RSSI()
    );

    Serial.println(
      F(" dBm")
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


  /* ===============================================
     NORMAL MODE ROUTES
  =============================================== */

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
   RETRY WIFI
===================================================== */

void maintainWiFi() {

  if (setupMode) {
    return;
  }


  if (
    WiFi.status() ==
    WL_CONNECTED
  ) {

    if (!wifiConnected) {

      wifiConnected = true;


      Serial.println();
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


    Serial.println();
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
    Set safe output state as early as possible.
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
    F("PHASE 1")
  );

  Serial.println(
    F("================================")
  );


  Serial.println(
    F("D1 / GPIO5 = LED 1 / MOTOR 1")
  );

  Serial.println(
    F("D2 / GPIO4 = LED 2 / MOTOR 2")
  );


  EEPROM.begin(
    EEPROM_SIZE
  );


  /* ===============================================
     DECIDE BOOT MODE
  =============================================== */

  if (!hasSavedWiFi()) {

    Serial.println();
    Serial.println(
      F("NO SAVED WIFI FOUND")
    );


    startSetupMode();

  } else {

    Serial.println();
    Serial.println(
      F("SAVED WIFI FOUND")
    );


    connectSavedWiFi();
  }
}


/* =====================================================
   LOOP
===================================================== */

void loop() {

  server.handleClient();

  maintainWiFi();

  yield();
}