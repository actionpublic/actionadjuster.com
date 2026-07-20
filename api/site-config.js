const { applyCors, getRecaptchaSiteKey, getRecaptchaType, sendJson } = require("./_backend");

module.exports = async function handler(request, response) {
  applyCors(request, response);

  if (request.method === "OPTIONS") {
    response.statusCode = 204;
    response.end();
    return;
  }

  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    sendJson(response, 405, { error: "Method not allowed." });
    return;
  }

  const recaptchaSiteKey = getRecaptchaSiteKey();

  if (!recaptchaSiteKey) {
    sendJson(response, 500, { error: "Google reCAPTCHA is not configured." });
    return;
  }

  sendJson(response, 200, { recaptchaSiteKey, recaptchaType: getRecaptchaType() });
};
