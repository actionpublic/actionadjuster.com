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
      sendJson(response, 200, { claims });
      return;
    }

    response.setHeader("Allow", "GET, POST");
    sendJson(response, 405, { error: "Method not allowed." });
  } catch (error) {
    sendJson(response, 500, { error: "Something went wrong. Please try again." });
  }
};
