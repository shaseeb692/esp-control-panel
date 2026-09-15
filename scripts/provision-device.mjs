import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import QRCode from "qrcode";

/* ============================================================
   ENV
============================================================ */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL missing from .env.local");
  process.exit(1);
}

if (!SERVICE_ROLE_KEY) {
  console.error("❌ SUPABASE_SERVICE_ROLE_KEY missing from .env.local");
  process.exit(1);
}

/* ============================================================
   SUPABASE
============================================================ */

const supabase = createClient(
  SUPABASE_URL,
  SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

/* ============================================================
   HELPERS
============================================================ */

function randomSecret(prefix) {
  return `${prefix}_${crypto.randomBytes(32).toString("hex")}`;
}

function sha256(value) {
  return crypto
    .createHash("sha256")
    .update(value)
    .digest("hex");
}

function safeFilename(value) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}

/* ============================================================
   MAIN
============================================================ */

async function main() {
  const rl = readline.createInterface({
    input,
    output,
  });

  console.log("");
  console.log("==========================================");
  console.log(" ESP CONTROL CENTER - DEVICE PROVISIONING");
  console.log("==========================================");
  console.log("");

  const deviceId = (
    await rl.question("Device ID [ESP-Lounge]: ")
  ).trim() || "ESP-Lounge";

  const hardwareModel = (
    await rl.question("Hardware model [ESP8266]: ")
  ).trim() || "ESP8266";

  rl.close();

  console.log("");
  console.log(`Checking device: ${deviceId}`);

  /* ==========================================================
     CHECK EXISTING REGISTRY
  ========================================================== */

  const {
    data: existing,
    error: existingError,
  } = await supabase
    .from("device_registry")
    .select("device_id,lifecycle_state")
    .eq("device_id", deviceId)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existing) {
    console.error("");
    console.error("❌ DEVICE ALREADY PROVISIONED");
    console.error(`Device ID: ${existing.device_id}`);
    console.error(`State: ${existing.lifecycle_state}`);
    console.error("");
    console.error(
      "Existing device credentials will NOT be overwritten."
    );

    process.exit(1);
  }

  /* ==========================================================
     GENERATE CREDENTIALS
  ========================================================== */

  const deviceSecret = randomSecret("dev");
  const claimToken = randomSecret("claim");

  const deviceSecretHash = sha256(deviceSecret);
  const claimTokenHash = sha256(claimToken);

  /* ==========================================================
     INSERT DEVICE REGISTRY
  ========================================================== */

  const {
    error: registryError,
  } = await supabase
    .from("device_registry")
    .insert({
      device_id: deviceId,
      device_secret_hash: deviceSecretHash,
      lifecycle_state: "provisioned",
      hardware_model: hardwareModel,

      metadata: {
        provisioning_mode: "factory_tool",
      },
    });

  if (registryError) {
    throw registryError;
  }

  /* ==========================================================
     INSERT CLAIM TOKEN
  ========================================================== */

  const {
    error: claimError,
  } = await supabase
    .from("device_claim_tokens")
    .insert({
      device_id: deviceId,
      token_hash: claimTokenHash,
    });

  if (claimError) {
    /* Roll back registry row if claim creation failed */

    await supabase
      .from("device_registry")
      .delete()
      .eq("device_id", deviceId);

    throw claimError;
  }

  /* ==========================================================
     LOCAL PRIVATE CREDENTIAL FILE
  ========================================================== */

  const root = process.cwd();

  const secretDir = path.join(
    root,
    "device-secrets"
  );

  const qrDir = path.join(
    root,
    "device-qr"
  );

  fs.mkdirSync(secretDir, {
    recursive: true,
  });

  fs.mkdirSync(qrDir, {
    recursive: true,
  });

  const filename = safeFilename(deviceId);

  const secretFile = path.join(
    secretDir,
    `${filename}.env`
  );

  const secretFileContents =
`DEVICE_ID=${deviceId}
DEVICE_SECRET=${deviceSecret}
CLAIM_TOKEN=${claimToken}
HARDWARE_MODEL=${hardwareModel}
`;

  fs.writeFileSync(
    secretFile,
    secretFileContents,
    {
      encoding: "utf8",
      flag: "wx",
    }
  );

  /* ==========================================================
     QR CLAIM URL
  ========================================================== */

  const claimUrl =
    `https://esp-control-panel.vercel.app/claim?token=${encodeURIComponent(
      claimToken
    )}`;

  const qrFile = path.join(
    qrDir,
    `${filename}.png`
  );

  await QRCode.toFile(
    qrFile,
    claimUrl,
    {
      width: 600,
      margin: 2,
      errorCorrectionLevel: "H",
    }
  );

  /* ==========================================================
     SUCCESS
  ========================================================== */

  console.log("");
  console.log("==========================================");
  console.log(" ✅ DEVICE PROVISIONED SUCCESSFULLY");
  console.log("==========================================");
  console.log("");

  console.log(`Device ID:      ${deviceId}`);
  console.log(`Hardware:       ${hardwareModel}`);
  console.log(`State:          provisioned`);

  console.log("");
  console.log("Private credential file:");
  console.log(secretFile);

  console.log("");
  console.log("QR code:");
  console.log(qrFile);

  console.log("");
  console.log(
    "Raw device secret and claim token were NOT printed to terminal."
  );

  console.log("");
  console.log(
    "Next step: provision DEVICE_ID + DEVICE_SECRET into ESP firmware."
  );

  console.log("");
}

/* ============================================================
   ERROR HANDLING
============================================================ */

main().catch((error) => {
  console.error("");
  console.error("❌ PROVISIONING FAILED");
  console.error("");

  if (error?.message) {
    console.error(error.message);
  } else {
    console.error(error);
  }

  process.exit(1);
});