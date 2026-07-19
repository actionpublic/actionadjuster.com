const menuButton = document.querySelector(".menu-toggle");
const nav = document.querySelector(".site-nav");
const claimForm = document.querySelector(".claim-form");
const recaptchaWidget = document.querySelector("[data-recaptcha-widget]");
const recaptchaResponse = document.querySelector("[data-recaptcha-response]");
const CANONICAL_API_ORIGIN = "https://files-mentioned-by-the-user-4a31b83.vercel.app";
let recaptchaWidgetId = null;

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

function loadRecaptchaApi() {
  if (window.grecaptcha?.render) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    window.onActionAdjustersRecaptchaLoad = resolve;

    const script = document.createElement("script");
    script.src = "https://www.google.com/recaptcha/api.js?onload=onActionAdjustersRecaptchaLoad&render=explicit";
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error("Could not load Google reCAPTCHA."));
    document.head.appendChild(script);
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

    await loadRecaptchaApi();
    recaptchaWidgetId = window.grecaptcha.render(recaptchaWidget, {
      sitekey: config.recaptchaSiteKey,
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

claimForm?.addEventListener("submit", (event) => {
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

  if (!payload.recaptchaToken) {
    status.textContent = "Complete the Google reCAPTCHA before sending.";
    status.className = "form-status full is-error";
    return;
  }

  status.textContent = "Sending claim review...";
  status.className = "form-status full";
  submitButton.disabled = true;

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
      if (window.grecaptcha && recaptchaWidgetId !== null) {
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
