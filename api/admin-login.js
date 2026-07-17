const { createAdminToken, getAdminPassword, getAdminUsername, readBody, sendJson } = require("./_backend");

module.exports = async function handler(request, response) {
  try {
    if (request.method !== "POST") {
      response.setHeader("Allow", "POST");
      sendJson(response, 405, { error: "Method not allowed." });
      return;
    }

    const body = await readBody(request);
    const adminUsername = getAdminUsername();
    const adminPassword = getAdminPassword();

    if (!adminUsername || !adminPassword) {
      sendJson(response, 500, { error: "Admin login is not configured." });
      return;
    }

    if (body.username !== adminUsername || body.password !== adminPassword) {
      sendJson(response, 401, { error: "Incorrect username or password." });
      return;
    }

    sendJson(response, 200, { token: createAdminToken() });
  } catch (error) {
    sendJson(response, 500, { error: "Login failed. Please try again." });
  }
};
