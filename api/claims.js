const {
  createClaim,
  listClaims,
  readBody,
  requireAdmin,
  saveClaims,
  sendJson,
  validateClaim,
} = require("./_backend");

module.exports = async function handler(request, response) {
  try {
    if (request.method === "POST") {
      const body = await readBody(request);
      const claim = createClaim(body);
      const error = validateClaim(claim);

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
