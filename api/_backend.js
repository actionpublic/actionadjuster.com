const crypto = require("crypto");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");

const CLAIMS_KEY = "action-adjusters:claims";
const MAX_CLAIMS = 250;
const FALLBACK_FILE = path.join(os.tmpdir(), "action-adjusters-claims.json");

function sendJson(response, status, data) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(data));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        request.destroy();
        reject(new Error("Request body is too large."));
      }
    });

    request.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
  });
}

function cleanText(value, maxLength = 2000) {
  return String(value || "").trim().slice(0, maxLength);
}

function createClaim(input) {
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    status: "new",
    name: cleanText(input.name, 160),
    phone: cleanText(input.phone, 80),
    email: cleanText(input.email, 160),
    damage: cleanText(input.damage, 180),
    message: cleanText(input.message, 5000),
  };
}

function validateClaim(claim) {
  const missing = ["name", "phone", "email", "damage", "message"].filter((field) => !claim[field]);

  if (missing.length) {
    return `${missing.join(", ")} required.`;
  }

  if (!claim.email.includes("@")) {
    return "Valid email required.";
  }

  return "";
}

function getAdminPassword() {
  if (process.env.ADMIN_PASSWORD) {
    return process.env.ADMIN_PASSWORD;
  }

  return process.env.NODE_ENV === "production" ? "" : "ActionAdmin2026!";
}

function getTokenSecret() {
  return process.env.ADMIN_TOKEN_SECRET || getAdminPassword();
}

function sign(value) {
  return crypto.createHmac("sha256", getTokenSecret()).update(value).digest("base64url");
}

function createAdminToken() {
  const payload = JSON.stringify({
    role: "admin",
    exp: Date.now() + 1000 * 60 * 60 * 12,
  });
  const encoded = Buffer.from(payload).toString("base64url");

  return `${encoded}.${sign(encoded)}`;
}

function isValidAdminToken(token) {
  if (!token || !token.includes(".")) {
    return false;
  }

  const [encoded, signature] = token.split(".");

  if (signature !== sign(encoded)) {
    return false;
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    return payload.role === "admin" && payload.exp > Date.now();
  } catch (error) {
    return false;
  }
}

function requireAdmin(request, response) {
  const header = request.headers.authorization || "";
  const token = header.replace(/^Bearer\s+/i, "");

  if (!isValidAdminToken(token)) {
    sendJson(response, 401, { error: "Admin login required." });
    return false;
  }

  return true;
}

async function kvRequest(command) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    return null;
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });

  if (!response.ok) {
    throw new Error(`KV request failed with ${response.status}`);
  }

  const data = await response.json();
  return data.result;
}

async function readFallbackStore() {
  try {
    const contents = await fs.readFile(FALLBACK_FILE, "utf8");
    return JSON.parse(contents);
  } catch (error) {
    return [];
  }
}

async function listClaims() {
  const stored = await kvRequest(["GET", CLAIMS_KEY]);

  if (stored) {
    return JSON.parse(stored);
  }

  return readFallbackStore();
}

async function saveClaims(claims) {
  const trimmed = claims.slice(0, MAX_CLAIMS);
  const saved = await kvRequest(["SET", CLAIMS_KEY, JSON.stringify(trimmed)]);

  if (saved === null) {
    await fs.writeFile(FALLBACK_FILE, JSON.stringify(trimmed, null, 2));
  }

  return trimmed;
}

module.exports = {
  createAdminToken,
  createClaim,
  listClaims,
  readBody,
  requireAdmin,
  saveClaims,
  sendJson,
  validateClaim,
  getAdminPassword,
};
