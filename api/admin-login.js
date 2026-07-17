const { createAdminToken, getAdminPassword, readBody, sendJson } = require("./_backend");

module.exports = async function handler(request, response) {
  try {
    if (request.method !== "POST") {
      response.setHeader("Allow", "POST");
      sendJson(response, 405, { error: "Method not allowed." });
      return;
    }

    const body = await readBody(request);
    const adminPassword = getAdminPassword();

    if (!adminPassword) {
      sendJson(response, 500, { error: "Admin password is not configured." });
      return;
    }

    if (body.password !== adminPassword) {
      sendJson(response, 401, { error: "Incorrect password." });
      return;
    }

    sendJson(response, 200, { token: createAdminToken() });
  } catch (error) {
    sendJson(response, 500, { error: "Login failed. Please try again." });
  }
};
