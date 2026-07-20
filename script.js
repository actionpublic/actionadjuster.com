const menuButton = document.querySelector(".menu-toggle");
const nav = document.querySelector(".site-nav");
const claimForm = document.querySelector(".claim-form");
const recaptchaWidget = document.querySelector("[data-recaptcha-widget]");
const recaptchaResponse = document.querySelector("[data-recaptcha-response]");
const CANONICAL_API_ORIGIN = "https://files-mentioned-by-the-user-4a31b83.vercel.app";
let recaptchaWidgetId = null;
let recaptchaConfig = null;

function getClaimsApiUrl() {
  if (window.location.hostname.endsWith("actionadjusters.com")) {
    return `${CANONICAL_API_ORIGIN}/api/claims`;
  }

  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    return "http://localhost:8766/api/claims";
  }

  return claimForm.action;
}

function getConfigApiUrl() {
  if (window.location.hostname.endsWith("actionadjusters.com")) {
    return `${CANONICAL_API_ORIGIN}/api/site-config`;
  }

  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    return "http://localhost:8766/api/site-config";
  }

  return "/api/site-config";
}

function loadRecaptchaApi(config) {
  if (window.grecaptcha?.render || window.grecaptcha?.execute) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    window.onActionAdjustersRecaptchaLoad = resolve;

    const script = document.createElement("script");
    const renderMode = config.recaptchaType === "v3" ? encodeURIComponent(config.recaptchaSiteKey) : "explicit";
    script.src = `https://www.google.com/recaptcha/api.js?onload=onActionAdjustersRecaptchaLoad&render=${renderMode}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error("Could not load Google reCAPTCHA."));
    document.head.appendChild(script);
  });
}

function executeRecaptcha() {
  if (!recaptchaConfig || !window.grecaptcha) {
    return Promise.resolve("");
  }

  if (recaptchaConfig.recaptchaType !== "v3") {
    return Promise.resolve(recaptchaResponse?.value || "");
  }

  return new Promise((resolve, reject) => {
    window.grecaptcha.ready(() => {
      window.grecaptcha
        .execute(recaptchaConfig.recaptchaSiteKey, { action: "claim_review" })
        .then(resolve)
        .catch(() => reject(new Error("Could not verify Google reCAPTCHA.")));
    });
  });
}

async function setupRecaptcha() {
  if (!claimForm || !recaptchaWidget || !recaptchaResponse || window.location.protocol === "file:") {
    return;
  }

  try {
    const response = await fetch(getConfigApiUrl());
    const config = await response.json();

    if (!response.ok || !config.recaptchaSiteKey) {
      throw new Error(config.error || "Google reCAPTCHA is not configured.");
    }

    recaptchaConfig = {
      recaptchaSiteKey: config.recaptchaSiteKey,
      recaptchaType: config.recaptchaType === "v3" ? "v3" : "v2",
    };

    await loadRecaptchaApi(recaptchaConfig);

    if (recaptchaConfig.recaptchaType === "v3") {
      recaptchaWidget.innerHTML = `<p class="captcha-message">Protected by Google reCAPTCHA.</p>`;
      return;
    }

    recaptchaWidgetId = window.grecaptcha.render(recaptchaWidget, {
      sitekey: recaptchaConfig.recaptchaSiteKey,
      callback: (token) => {
        recaptchaResponse.value = token;
      },
      "expired-callback": () => {
        recaptchaResponse.value = "";
      },
    });
  } catch (error) {
    recaptchaWidget.innerHTML = `<p class="captcha-message">${error.message}</p>`;
  }
}

menuButton?.addEventListener("click", () => {
  const isOpen = nav.classList.toggle("is-open");
  menuButton.setAttribute("aria-expanded", String(isOpen));
});

nav?.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    nav.classList.remove("is-open");
    menuButton?.setAttribute("aria-expanded", "false");
  });
});

claimForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(claimForm);
  const status = claimForm.querySelector(".form-status");
  const submitButton = claimForm.querySelector('button[type="submit"]');
  const payload = Object.fromEntries(formData.entries());

  if (window.location.protocol === "file:") {
    status.textContent = "Open the site through the local Vercel server to submit this form.";
    status.className = "form-status full is-error";
    return;
  }

  status.textContent = "Sending claim review...";
  status.className = "form-status full";
  submitButton.disabled = true;

  try {
    const recaptchaToken = await executeRecaptcha();

    if (!recaptchaToken) {
      throw new Error("Complete the Google reCAPTCHA before sending.");
    }

    payload.recaptchaToken = recaptchaToken;
    recaptchaResponse.value = recaptchaToken;
  } catch (error) {
    status.textContent = error.message || "Could not verify Google reCAPTCHA.";
    status.classList.add("is-error");
    submitButton.disabled = false;
    return;
  }

  fetch(getClaimsApiUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })
    .then(async (response) => {
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Submission failed.");
      }

      claimForm.reset();
      recaptchaResponse.value = "";
      if (recaptchaConfig?.recaptchaType !== "v3" && window.grecaptcha && recaptchaWidgetId !== null) {
        window.grecaptcha.reset(recaptchaWidgetId);
      }
      status.textContent = "Claim review sent. The admin dashboard has a new notification.";
      status.classList.add("is-success");
    })
    .catch((error) => {
      status.textContent = error.message || "Please try again.";
      status.classList.add("is-error");
    })
    .finally(() => {
      submitButton.disabled = false;
    });
});

setupRecaptcha();
