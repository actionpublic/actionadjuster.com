const crypto = require("crypto");
const { listClaims, readBody, saveClaims, sendJson } = require("./_backend");

function publicClaim(claim) {
  return {
    id: claim.id,
    name: claim.name,
    damage: claim.damage,
    clientStatus: claim.clientStatus || "Active Claim",
    clientProfile: claim.clientProfile || {
      displayName: claim.name,
      phone: claim.phone,
      email: claim.email,
      mailingAddress: "",
      city: "",
      state: "",
      zip: "",
      preferredContact: "Phone",
      portalRole: "Client",
      portalNotes: "",
    },
    updates: (claim.updates || []).filter((update) => update.visibleToClient),
    documents: (claim.documents || [])
      .filter((document) => document.visibleToClient)
      .map((document) => ({
        id: document.id,
        createdAt: document.createdAt,
        name: document.name,
        type: document.type,
        dataUrl: document.dataUrl,
        source: document.source,
      })),
  };
}

function findPortalClaim(claims, body) {
  const email = String(body.email || "").trim().toLowerCase();
  const portalCode = String(body.portalCode || "").trim().toUpperCase();

  return claims.find((claim) => {
    const profileEmail = String(claim.clientProfile?.email || "").trim().toLowerCase();
    const claimEmail = String(claim.email || "").trim().toLowerCase();
    const emails = new Set([profileEmail, claimEmail].filter(Boolean));

    return claim.portalEnabled && emails.has(email) && String(claim.portalCode || "").trim().toUpperCase() === portalCode;
  });
}

module.exports = async function handler(request, response) {
  try {
    if (request.method !== "POST") {
      response.setHeader("Allow", "POST");
      sendJson(response, 405, { error: "Method not allowed." });
      return;
    }

    const body = await readBody(request);
    const claims = await listClaims();
    const claim = findPortalClaim(claims, body);

    if (!claim) {
      sendJson(response, 401, { error: "Client portal access was not found." });
      return;
    }

    if (body.action === "upload") {
      const name = String(body.name || "").trim().slice(0, 180);
      const dataUrl = String(body.dataUrl || "");

      if (!name || !dataUrl.startsWith("data:")) {
        sendJson(response, 400, { error: "Document file required." });
        return;
      }

      if (dataUrl.length > 2_750_000) {
        sendJson(response, 400, { error: "Document is too large for this local prototype." });
        return;
      }

      claim.documents = Array.isArray(claim.documents) ? claim.documents : [];
      claim.documents.unshift({
        id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`,
        createdAt: new Date().toISOString(),
        name,
        type: String(body.type || "application/octet-stream").slice(0, 120),
        dataUrl,
        source: "client",
        visibleToClient: true,
      });

      await saveClaims(claims);
    } else if (body.action === "profile") {
      claim.clientProfile = {
        ...(claim.clientProfile || {}),
        displayName: String(body.displayName || "").trim().slice(0, 160),
        phone: String(body.phone || "").trim().slice(0, 80),
        email: String(body.profileEmail || claim.email || "").trim().slice(0, 160),
        mailingAddress: String(body.mailingAddress || "").trim().slice(0, 500),
        city: String(body.city || "").trim().slice(0, 120),
        state: String(body.state || "").trim().slice(0, 80),
        zip: String(body.zip || "").trim().slice(0, 40),
        preferredContact: String(body.preferredContact || "Phone").trim().slice(0, 80),
        portalRole: claim.clientProfile?.portalRole || "Client",
        portalNotes: claim.clientProfile?.portalNotes || "",
      };
      claim.name = claim.clientProfile.displayName || claim.name;
      claim.phone = claim.clientProfile.phone || claim.phone;
      claim.email = claim.clientProfile.email || claim.email;

      await saveClaims(claims);
    }

    sendJson(response, 200, { claim: publicClaim(claim) });
  } catch (error) {
    sendJson(response, 500, { error: "Portal request failed." });
  }
};
