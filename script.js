const menuButton = document.querySelector(".menu-toggle");
const nav = document.querySelector(".site-nav");
const claimForm = document.querySelector(".claim-form");
const CANONICAL_API_ORIGIN = "https://files-mentioned-by-the-user-4a31b83.vercel.app";

function getClaimsApiUrl() {
  if (window.location.hostname.endsWith("actionadjusters.com")) {
    return `${CANONICAL_API_ORIGIN}/api/claims`;
  }

  return claimForm.action;
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
