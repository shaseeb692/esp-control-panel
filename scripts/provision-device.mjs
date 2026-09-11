import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import QRCode from "qrcode";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const CLAIM_BASE_URL =
  process.env.DEVICE_CLAIM_BASE_URL ||
  "https://esp-control-panel.vercel.app/claim";

if (!SUPABASE_URL) {
  console.error("NEXT_PUBLIC_SUPABASE_URL missing from .env.local");
  process.exitCode = 1;
} else if (!SERVICE_ROLE_KEY) {
  console.error("SUPABASE_SERVICE_ROLE_KEY missing from .env.local");
  process.exitCode = 1;
} else {
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

  function randomSecret(prefix) {
    return (
      prefix +
      "_" +
      crypto.randomBytes(32).toString("hex")
    );
  }

  function sha256(value) {
    return crypto
      .createHash("sha256")
      .update(value)
      .digest("hex");
  }

  function safeFilename(value) {
    return value.replace(
      /[^a-zA-Z0-9_-]/g,
      "_"
    );
  }

  function removeFile(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch {
      // Cleanup only.
    }
  }

  async function main() {
    const rl = readline.createInterface({
      input: stdin,
      output: stdout,
    });

    let deviceId;
    let hardwareModel;

    try {
      console.log("");
      console.log(
        "=========================================="
      );
      console.log(
        " ESP CONTROL CENTER - DEVICE PROVISIONING"
      );
      console.log(
        "=========================================="
      );
      console.log("");

      const enteredDeviceId =
        await rl.question(
          "Device ID [ESP-Lounge]: "
        );

      deviceId =
        enteredDeviceId.trim() ||
        "ESP-Lounge";

      const enteredHardware =
        await rl.question(
          "Hardware model [ESP8266]: "
        );

      hardwareModel =
        enteredHardware.trim() ||
        "ESP8266";
    } finally {
      rl.close();
    }

    if (
      !/^[a-zA-Z0-9_-]{3,80}$/.test(
        deviceId
      )
    ) {
      throw new Error(
        "Invalid Device ID. Use letters, numbers, hyphen or underscore only."
      );
    }

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

    const filename =
      safeFilename(deviceId);

    const secretFile = path.join(
      secretDir,
      filename + ".env"
    );

    const qrFile = path.join(
      qrDir,
      filename + ".png"
    );

    const tempSecretFile = path.join(
      secretDir,
      filename + ".env.tmp"
    );

    const tempQrFile = path.join(
      qrDir,
      filename + ".tmp.png"
    );

    console.log("");
    console.log(
      "Checking device: " + deviceId
    );

    if (
      fs.existsSync(secretFile) ||
      fs.existsSync(qrFile)
    ) {
      throw new Error(
        "Local provisioning files already exist for " +
          deviceId +
          ". Existing files will not be overwritten."
      );
    }

    removeFile(tempSecretFile);
    removeFile(tempQrFile);

    const existingResult =
      await supabase
        .from("device_registry")
        .select(
          "device_id,lifecycle_state,provisioned_at"
        )
        .eq(
          "device_id",
          deviceId
        )
        .maybeSingle();

    if (existingResult.error) {
      throw existingResult.error;
    }

    if (existingResult.data) {
      throw new Error(
        "DEVICE_ALREADY_PROVISIONED\n" +
          "Device ID: " +
          existingResult.data.device_id +
          "\nState: " +
          existingResult.data.lifecycle_state +
          "\nExisting credentials will not be overwritten."
      );
    }

    const deviceSecret =
      randomSecret("dev");

    const claimToken =
      randomSecret("claim");

    const deviceSecretHash =
      sha256(deviceSecret);

    const claimTokenHash =
      sha256(claimToken);

    const claimUrl =
      CLAIM_BASE_URL +
      "?token=" +
      encodeURIComponent(claimToken);

    const secretContents =
      "DEVICE_ID=" +
      deviceId +
      "\n" +
      "DEVICE_SECRET=" +
      deviceSecret +
      "\n" +
      "CLAIM_TOKEN=" +
      claimToken +
      "\n" +
      "HARDWARE_MODEL=" +
      hardwareModel +
      "\n";

    try {
      fs.writeFileSync(
        tempSecretFile,
        secretContents,
        {
          encoding: "utf8",
          flag: "wx",
        }
      );

      await QRCode.toFile(
        tempQrFile,
        claimUrl,
        {
          width: 600,
          margin: 2,
          errorCorrectionLevel: "H",
        }
      );
    } catch (error) {
      removeFile(tempSecretFile);
      removeFile(tempQrFile);

      throw new Error(
        "LOCAL_FILE_PREPARATION_FAILED: " +
          (error instanceof Error
            ? error.message
            : String(error))
      );
    }

    let registryCreated = false;
    let claimCreated = false;

    try {
      const registryResult =
        await supabase
          .from("device_registry")
          .insert({
            device_id: deviceId,
            device_secret_hash:
              deviceSecretHash,
            lifecycle_state:
              "provisioned",
            hardware_model:
              hardwareModel,
            metadata: {
              provisioning_mode:
                "factory_tool",
            },
          });

      if (registryResult.error) {
        throw registryResult.error;
      }

      registryCreated = true;

      const claimResult =
        await supabase
          .from("device_claim_tokens")
          .insert({
            device_id: deviceId,
            token_hash:
              claimTokenHash,
          });

      if (claimResult.error) {
        throw claimResult.error;
      }

      claimCreated = true;

      fs.renameSync(
        tempSecretFile,
        secretFile
      );

      fs.renameSync(
        tempQrFile,
        qrFile
      );
    } catch (error) {
      removeFile(tempSecretFile);
      removeFile(tempQrFile);
      removeFile(secretFile);
      removeFile(qrFile);

      if (claimCreated) {
        await supabase
          .from("device_claim_tokens")
          .delete()
          .eq(
            "token_hash",
            claimTokenHash
          );
      }

      if (registryCreated) {
        await supabase
          .from("device_registry")
          .delete()
          .eq(
            "device_id",
            deviceId
          );
      }

      throw error;
    }

    console.log("");
    console.log(
      "=========================================="
    );
    console.log(
      " DEVICE PROVISIONED SUCCESSFULLY"
    );
    console.log(
      "=========================================="
    );
    console.log("");

    console.log(
      "Device ID: " + deviceId
    );

    console.log(
      "Hardware:  " + hardwareModel
    );

    console.log(
      "State:     provisioned"
    );

    console.log("");
    console.log(
      "Private credential file:"
    );
    console.log(secretFile);

    console.log("");
    console.log("QR code:");
    console.log(qrFile);

    console.log("");
    console.log(
      "Raw DEVICE_SECRET and CLAIM_TOKEN were not printed."
    );
  }

  main().catch((error) => {
    console.error("");
    console.error(
      "=========================================="
    );
    console.error(
      " PROVISIONING FAILED"
    );
    console.error(
      "=========================================="
    );
    console.error("");

    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(error);
    }

    process.exitCode = 1;
  });
}
