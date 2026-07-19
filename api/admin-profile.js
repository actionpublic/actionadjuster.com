const {
  getAdminProfile,
  readBody,
  requireAdmin,
  saveAdminProfile,
  sendJson,
} = require("./_backend");

function clean(value, maxLength = 240) {
  return String(value || "").trim().slice(0, maxLength);
}

module.exports = async function handler(request, response) {
  try {
    if (!requireAdmin(request, response)) {
      return;
    }

    if (request.method === "GET") {
      sendJson(response, 200, { profile: await getAdminProfile() });
      return;
    }

    if (request.method === "PATCH") {
      const body = await readBody(request);
      const profile = await saveAdminProfile({
        name: clean(body.name),
        email: clean(body.email),
        phone: clean(body.phone, 80),
        role: clean(body.role, 120),
        timezone: clean(body.timezone, 120),
        notificationEmail: clean(body.notificationEmail),
      });

      sendJson(response, 200, { ok: true, profile });
      return;
    }

    response.setHeader("Allow", "GET, PATCH");
    sendJson(response, 405, { error: "Method not allowed." });
  } catch (error) {
    sendJson(response, 500, { error: "Admin profile request failed." });
  }
};
