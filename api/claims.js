const crypto = require("crypto");
const {
  createClaim,
  createPortalCode,
  listClaims,
  readBody,
  requireAdmin,
  saveClaims,
  sendJson,
  validateClaim,
  validateSpamCheck,
} = require("./_backend");

function addActivityLog(claim, type, title, detail) {
  claim.activityLog = Array.isArray(claim.activityLog) ? claim.activityLog : [];
  claim.activityLog.unshift({
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`,
    createdAt: new Date().toISOString(),
    type,
    title,
    detail,
  });
}

module.exports = async function handler(request, response) {
  try {
    if (request.method === "POST") {
      const body = await readBody(request);
      const claim = createClaim(body);
      const error = validateClaim(claim) || validateSpamCheck(body);

      if (error) {
        sendJson(response, 400, { error });
        return;
      }

      const claims = await listClaims();
      await saveClaims([claim, ...claims]);
      sendJson(response, 201, { ok: true, claim });
      return;
    }

    if (request.method === "GET") {
      if (!requireAdmin(request, response)) {
        return;
      }

      const claims = await listClaims();
      const status = new URL(request.url, `http://${request.headers.host}`).searchParams.get("status") || "active";
      const filteredClaims = claims.filter((claim) => {
        if (status === "archived") {
          return claim.status === "archived";
        }

        return claim.status !== "archived";
      });

      sendJson(response, 200, { claims: filteredClaims });
      return;
    }

    if (request.method === "PATCH") {
      if (!requireAdmin(request, response)) {
        return;
      }

      const body = await readBody(request);
      const claims = await listClaims();
      const claim = claims.find((item) => item.id === body.id);

      if (!claim) {
        sendJson(response, 404, { error: "Claim not found." });
        return;
      }

      if (body.action === "archive") {
        claim.status = "archived";
        claim.archivedAt = new Date().toISOString();
      } else if (body.action === "restore") {
        claim.status = "new";
        delete claim.archivedAt;
      } else if (body.action === "complete") {
        claim.status = "completed";
        claim.completedAt = new Date().toISOString();
      } else if (body.action === "uncomplete") {
        claim.status = "new";
        delete claim.completedAt;
      } else if (body.action === "promoteLead") {
        claim.crmStage = "lead";
        claim.leadStatus = claim.leadStatus || "Contact Needed";
        claim.promotedToLeadAt = new Date().toISOString();
      } else if (body.action === "promoteClient") {
        claim.crmStage = "client";
        claim.clientStatus = claim.clientStatus || "Active Claim";
        claim.portalEnabled = true;
        claim.convertedToClientAt = new Date().toISOString();
      } else if (body.action === "crm") {
        const previousLeadStatus = claim.leadStatus || "";
        const previousClientStatus = claim.clientStatus || "";
        const previousFollowUpAt = claim.followUpAt || "";
        claim.leadStatus = String(body.leadStatus || claim.leadStatus || "").trim().slice(0, 120);
        claim.clientStatus = String(body.clientStatus || claim.clientStatus || "").trim().slice(0, 120);
        claim.followUpAt = String(body.followUpAt || "").trim().slice(0, 80);
        addActivityLog(
          claim,
          "crm",
          "CRM status saved",
          [
            previousLeadStatus !== claim.leadStatus ? `Lead status: ${previousLeadStatus || "None"} -> ${claim.leadStatus || "None"}` : "",
            previousClientStatus !== claim.clientStatus ? `Client status: ${previousClientStatus || "None"} -> ${claim.clientStatus || "None"}` : "",
            previousFollowUpAt !== claim.followUpAt ? `Follow up: ${previousFollowUpAt || "None"} -> ${claim.followUpAt || "None"}` : "",
          ]
            .filter(Boolean)
            .join("; ") || "CRM status reviewed and saved."
        );
      } else if (body.action === "portal") {
        claim.portalEnabled = Boolean(body.portalEnabled);
      } else if (body.action === "resetPortalCode") {
        claim.portalCode = createPortalCode();
        claim.portalCodeResetAt = new Date().toISOString();
      } else if (body.action === "clientProfile") {
        claim.clientProfile = {
          ...(claim.clientProfile || {}),
          displayName: String(body.displayName || "").trim().slice(0, 160),
          phone: String(body.phone || "").trim().slice(0, 80),
          email: String(body.email || "").trim().slice(0, 160),
          mailingAddress: String(body.mailingAddress || "").trim().slice(0, 500),
          city: String(body.city || "").trim().slice(0, 120),
          state: String(body.state || "").trim().slice(0, 80),
          zip: String(body.zip || "").trim().slice(0, 40),
          preferredContact: String(body.preferredContact || "Phone").trim().slice(0, 80),
          portalRole: String(body.portalRole || "Client").trim().slice(0, 80),
          portalNotes: String(body.portalNotes || "").trim().slice(0, 1000),
        };
        claim.name = claim.clientProfile.displayName || claim.name;
        claim.phone = claim.clientProfile.phone || claim.phone;
        claim.email = claim.clientProfile.email || claim.email;
      } else if (body.action === "update") {
        const text = String(body.update || "").trim().slice(0, 2000);

        if (!text) {
          sendJson(response, 400, { error: "Update text required." });
          return;
        }

        claim.updates = Array.isArray(claim.updates) ? claim.updates : [];
        claim.updates.unshift({
          id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`,
          createdAt: new Date().toISOString(),
          text,
          visibleToClient: Boolean(body.visibleToClient),
        });
        addActivityLog(claim, "update", "Claim update added", text);
      } else if (body.action === "document") {
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
          source: body.source === "client" ? "client" : "admin",
          visibleToClient: body.visibleToClient !== false,
        });
      } else if (body.action === "notes") {
        claim.internalNotes = String(body.notes || "").trim().slice(0, 5000);
        claim.notesUpdatedAt = new Date().toISOString();
        addActivityLog(claim, "notes", "Internal notes saved", claim.internalNotes || "Notes cleared.");
      } else {
        sendJson(response, 400, { error: "Unsupported action." });
        return;
      }

      await saveClaims(claims);
      sendJson(response, 200, { ok: true, claim });
      return;
    }

    if (request.method === "DELETE") {
      if (!requireAdmin(request, response)) {
        return;
      }

      const body = await readBody(request);
      const claims = await listClaims();
      const nextClaims = claims.filter((claim) => claim.id !== body.id);

      if (nextClaims.length === claims.length) {
        sendJson(response, 404, { error: "Claim not found." });
        return;
      }

      await saveClaims(nextClaims);
      sendJson(response, 200, { ok: true });
      return;
    }

    response.setHeader("Allow", "DELETE, GET, PATCH, POST");
    sendJson(response, 405, { error: "Method not allowed." });
  } catch (error) {
    sendJson(response, 500, { error: "Something went wrong. Please try again." });
  }
};
