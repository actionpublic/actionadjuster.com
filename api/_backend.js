const crypto = require("crypto");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { get: getBlob, put: putBlob } = require("@vercel/blob");

const CLAIMS_KEY = "action-adjusters:claims";
const ADMIN_PROFILE_KEY = "action-adjusters:admin-profile";
const CLAIMS_BLOB_PATH = "action-adjusters/claims.json";
const ADMIN_PROFILE_BLOB_PATH = "action-adjusters/admin-profile.json";
const MAX_CLAIMS = 250;
const LOCAL_RECAPTCHA_SITE_KEY = "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI";
const LOCAL_RECAPTCHA_SECRET = "6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe";
const FALLBACK_FILE = path.join(os.tmpdir(), "action-adjusters-claims.json");
const ADMIN_PROFILE_FILE = path.join(os.tmpdir(), "action-adjusters-admin-profile.json");
const ALLOWED_ORIGINS = new Set([
  "https://www.actionadjusters.com",
  "https://actionadjusters.com",
  "https://files-mentioned-by-the-user-4a31b83.vercel.app",
  "http://localhost:8768",
  "http://127.0.0.1:8768",
]);

function createPortalCode() {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

function sendJson(response, status, data) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(data));
}

function applyCors(request, response) {
  const origin = request.headers.origin;

  if (ALLOWED_ORIGINS.has(origin)) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
  }

  response.setHeader("Access-Control-Allow-Methods", "DELETE, GET, OPTIONS, PATCH, POST");
  response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 3_500_000) {
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
    crmStage: "inquiry",
    leadStatus: "New Inquiry",
    clientStatus: "",
    followUpAt: "",
    portalCode: createPortalCode(),
    portalEnabled: false,
    clientProfile: {
      displayName: cleanText(input.name, 160),
      phone: cleanText(input.phone, 80),
      email: cleanText(input.email, 160),
      mailingAddress: "",
      city: "",
      state: "",
      zip: "",
      preferredContact: "Phone",
      portalRole: "Client",
      portalNotes: "",
    },
    updates: [],
    documents: [],
    activityLog: [],
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

function normalizeClaim(claim) {
  const clientProfile = claim.clientProfile || {};

  return {
    ...claim,
    crmStage: claim.crmStage || "inquiry",
    leadStatus: claim.leadStatus || (claim.crmStage === "lead" ? "Contact Needed" : "New Inquiry"),
    clientStatus: claim.clientStatus || (claim.crmStage === "client" ? "Active Claim" : ""),
    followUpAt: claim.followUpAt || "",
    portalCode: claim.portalCode || createPortalCode(),
    portalEnabled: Boolean(claim.portalEnabled),
    clientProfile: {
      displayName: clientProfile.displayName || claim.name || "",
      phone: clientProfile.phone || claim.phone || "",
      email: clientProfile.email || claim.email || "",
      mailingAddress: clientProfile.mailingAddress || "",
      city: clientProfile.city || "",
      state: clientProfile.state || "",
      zip: clientProfile.zip || "",
      preferredContact: clientProfile.preferredContact || "Phone",
      portalRole: clientProfile.portalRole || "Client",
      portalNotes: clientProfile.portalNotes || "",
    },
    updates: Array.isArray(claim.updates) ? claim.updates : [],
    documents: Array.isArray(claim.documents) ? claim.documents : [],
    activityLog: Array.isArray(claim.activityLog) ? claim.activityLog : [],
  };
}

function normalizeClaims(claims) {
  return claims.map(normalizeClaim);
}

function getRecaptchaSiteKey() {
  if (process.env.RECAPTCHA_SITE_KEY) {
    return process.env.RECAPTCHA_SITE_KEY;
  }

  return process.env.NODE_ENV === "production" ? "" : LOCAL_RECAPTCHA_SITE_KEY;
}

function getRecaptchaSecret() {
  if (process.env.RECAPTCHA_SECRET_KEY) {
    return process.env.RECAPTCHA_SECRET_KEY;
  }

  return process.env.NODE_ENV === "production" ? "" : LOCAL_RECAPTCHA_SECRET;
}

function getRecaptchaType() {
  return String(process.env.RECAPTCHA_TYPE || (process.env.NODE_ENV === "production" ? "v3" : "v2")).trim().toLowerCase();
}

async function validateSpamCheck(input) {
  if (cleanText(input.website, 300)) {
    return "Submission blocked.";
  }

  const token = cleanText(input.recaptchaToken, 4000);
  const secret = getRecaptchaSecret();

  if (!secret) {
    return "Google reCAPTCHA is not configured.";
  }

  if (!token) {
    return "Google reCAPTCHA is required.";
  }

  const verification = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      secret,
      response: token,
    }),
  });
  const data = await verification.json().catch(() => ({}));

  if (!verification.ok || !data.success) {
    return "Google reCAPTCHA verification failed.";
  }

  if (getRecaptchaType() === "v3") {
    const expectedAction = "claim_review";
    const minimumScore = Number(process.env.RECAPTCHA_MIN_SCORE || 0.5);

    if (data.action && data.action !== expectedAction) {
      return "Google reCAPTCHA verification failed.";
    }

    if (typeof data.score === "number" && data.score < minimumScore) {
      return "Submission blocked by Google reCAPTCHA.";
    }
  }

  return "";
}

function getAdminPassword() {
  if (process.env.ADMIN_PASSWORD) {
    return process.env.ADMIN_PASSWORD;
  }

  return process.env.NODE_ENV === "production" ? "" : "!LoveHashem1836";
}

function getAdminUsername() {
  if (process.env.ADMIN_USERNAME) {
    return process.env.ADMIN_USERNAME;
  }

  return process.env.NODE_ENV === "production" ? "" : "IlanR18";
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

async function readJsonBlob(pathname) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return null;
  }

  const blob = await getBlob(pathname, { access: "private", useCache: false });

  if (!blob || blob.statusCode !== 200 || !blob.stream) {
    return null;
  }

  const text = await new Response(blob.stream).text();
  return JSON.parse(text);
}

async function writeJsonBlob(pathname, value) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return false;
  }

  await putBlob(pathname, JSON.stringify(value, null, 2), {
    access: "private",
    allowOverwrite: true,
    contentType: "application/json",
  });

  return true;
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
    return normalizeClaims(JSON.parse(stored));
  }

  const blobClaims = await readJsonBlob(CLAIMS_BLOB_PATH);

  if (blobClaims) {
    return normalizeClaims(blobClaims);
  }

  return normalizeClaims(await readFallbackStore());
}

async function saveClaims(claims) {
  const trimmed = claims.slice(0, MAX_CLAIMS);
  const saved = await kvRequest(["SET", CLAIMS_KEY, JSON.stringify(trimmed)]);

  if (saved === null && !(await writeJsonBlob(CLAIMS_BLOB_PATH, trimmed))) {
    await fs.writeFile(FALLBACK_FILE, JSON.stringify(trimmed, null, 2));
  }

  return trimmed;
}

function defaultAdminProfile() {
  return {
    name: "Action Adjusters Admin",
    email: "ActionPublicAdj@gmail.com",
    phone: "",
    role: "Administrator",
    timezone: "America/New_York",
    notificationEmail: "ActionPublicAdj@gmail.com",
  };
}

async function readAdminProfileFallback() {
  try {
    return JSON.parse(await fs.readFile(ADMIN_PROFILE_FILE, "utf8"));
  } catch (error) {
    return defaultAdminProfile();
  }
}

function normalizeAdminProfile(profile) {
  return {
    ...defaultAdminProfile(),
    ...profile,
  };
}

async function getAdminProfile() {
  const stored = await kvRequest(["GET", ADMIN_PROFILE_KEY]);

  if (stored) {
    return normalizeAdminProfile(JSON.parse(stored));
  }

  const blobProfile = await readJsonBlob(ADMIN_PROFILE_BLOB_PATH);

  if (blobProfile) {
    return normalizeAdminProfile(blobProfile);
  }

  return normalizeAdminProfile(await readAdminProfileFallback());
}

async function saveAdminProfile(profile) {
  const nextProfile = normalizeAdminProfile(profile);
  const saved = await kvRequest(["SET", ADMIN_PROFILE_KEY, JSON.stringify(nextProfile)]);

  if (saved === null && !(await writeJsonBlob(ADMIN_PROFILE_BLOB_PATH, nextProfile))) {
    await fs.writeFile(ADMIN_PROFILE_FILE, JSON.stringify(nextProfile, null, 2));
  }

  return nextProfile;
}

module.exports = {
  applyCors,
  createAdminToken,
  createClaim,
  createPortalCode,
  getAdminUsername,
  getRecaptchaSiteKey,
  getRecaptchaType,
  getAdminProfile,
  listClaims,
  normalizeClaim,
  readBody,
  requireAdmin,
  saveClaims,
  saveAdminProfile,
  sendJson,
  validateSpamCheck,
  validateClaim,
  getAdminPassword,
};
