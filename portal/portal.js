const loginPanel = document.querySelector("[data-login]");
const dashboard = document.querySelector("[data-dashboard]");
const loginForm = document.querySelector(".portal-form");
const uploadForm = document.querySelector(".portal-upload-form");
const profileForm = document.querySelector(".portal-profile-form");
const logoutButton = document.querySelector("[data-logout]");
const statusText = document.querySelector(".portal-form .portal-status");
const uploadStatus = document.querySelector("[data-upload-status]");
const profileStatus = document.querySelector("[data-profile-status]");
const claimTitle = document.querySelector("[data-claim-title]");
const claimStatus = document.querySelector("[data-claim-status]");
const claimOverview = document.querySelector("[data-claim-overview]");
const updatesList = document.querySelector("[data-updates]");
const documentsList = document.querySelector("[data-documents]");
const portalPanels = document.querySelectorAll("[data-portal-panel]");
const portalNavButtons = document.querySelectorAll("[data-portal-view]");
const panelTitle = document.querySelector("[data-panel-title]");
let portalCredentials = null;

const panelTitles = {
  profile: "My Profile",
  claim: "Claim Status",
  updates: "Claim Updates",
  documents: "Documents",
  upload: "Upload Documents",
};

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read file."));
    reader.readAsDataURL(file);
  });
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };

    return entities[character];
  });
}

function formatDateTime(value) {
  if (!value) {
    return "Not posted yet";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Not posted yet";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function setPortalView(view) {
  portalPanels.forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.portalPanel === view);
  });
  portalNavButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.portalView === view);
  });
  panelTitle.textContent = panelTitles[view] || "Client Portal";
}

function renderClaim(claim) {
  const profile = claim.clientProfile || {};
  const latestUpdate = claim.updates[0];
  const latestDocument = claim.documents[0];
  loginPanel.hidden = true;
  dashboard.hidden = false;
  claimTitle.textContent = profile.displayName || claim.name;
  claimStatus.textContent = `${claim.damage} - ${claim.clientStatus}`;
  claimOverview.innerHTML = `
    <div>
      <span>Claim Type</span>
      <strong>${escapeHtml(claim.damage || "Pending review")}</strong>
    </div>
    <div>
      <span>Status</span>
      <strong>${escapeHtml(claim.clientStatus || "Active Claim")}</strong>
    </div>
    <div>
      <span>Preferred Contact</span>
      <strong>${escapeHtml(profile.preferredContact || "Phone")}</strong>
    </div>
    <div>
      <span>Client Email</span>
      <strong>${escapeHtml(profile.email || claim.email || "")}</strong>
    </div>
    <div>
      <span>Latest Update</span>
      <strong>${escapeHtml(latestUpdate ? formatDateTime(latestUpdate.createdAt) : "No updates yet")}</strong>
    </div>
    <div>
      <span>Latest Document</span>
      <strong>${escapeHtml(latestDocument ? latestDocument.name : "No documents yet")}</strong>
    </div>
  `;
  profileForm.elements.displayName.value = profile.displayName || claim.name || "";
  profileForm.elements.profileEmail.value = profile.email || "";
  profileForm.elements.phone.value = profile.phone || "";
  profileForm.elements.preferredContact.value = profile.preferredContact || "Phone";
  profileForm.elements.mailingAddress.value = profile.mailingAddress || "";
  profileForm.elements.city.value = profile.city || "";
  profileForm.elements.state.value = profile.state || "";
  profileForm.elements.zip.value = profile.zip || "";
  updatesList.innerHTML = claim.updates.length
    ? `<div class="portal-list">${claim.updates
        .map(
          (update) => `
            <div class="portal-list-item">
              <span>${escapeHtml(formatDateTime(update.createdAt))}</span>
              <strong>${escapeHtml(update.text)}</strong>
            </div>`
        )
        .join("")}</div>`
    : "<p>No updates posted yet.</p>";
  documentsList.innerHTML = claim.documents.length
    ? `<div class="portal-list">${claim.documents
        .map(
          (document) => `
            <div class="portal-list-item">
              <span>${escapeHtml(formatDateTime(document.createdAt))}</span>
              <a href="${escapeHtml(document.dataUrl)}" download="${escapeHtml(document.name)}">${escapeHtml(document.name)}</a>
            </div>`
        )
        .join("")}</div>`
    : "<p>No documents available yet.</p>";
  setPortalView("profile");
}

async function portalRequest(extra = {}) {
  const response = await fetch("/api/portal", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ...portalCredentials, ...extra }),
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Portal request failed.");
  }

  renderClaim(data.claim);
  if (extra.action === "profile" && extra.profileEmail) {
    portalCredentials.email = extra.profileEmail;
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(loginForm);
  portalCredentials = {
    email: formData.get("email"),
    portalCode: formData.get("portalCode"),
  };
  statusText.textContent = "Loading...";

  try {
    await portalRequest();
    statusText.textContent = "";
  } catch (error) {
    statusText.textContent = error.message;
  }
});

uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const file = new FormData(uploadForm).get("document");

  if (!file || !file.name) {
    uploadStatus.textContent = "Choose a document first.";
    return;
  }

  uploadStatus.textContent = "Uploading...";

  try {
    await portalRequest({
      action: "upload",
      name: file.name,
      type: file.type,
      dataUrl: await readFileAsDataUrl(file),
    });
    uploadForm.reset();
    uploadStatus.textContent = "Uploaded.";
  } catch (error) {
    uploadStatus.textContent = error.message;
  }
});

profileForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(profileForm);
  profileStatus.textContent = "Saving...";

  try {
    await portalRequest({
      action: "profile",
      displayName: formData.get("displayName"),
      profileEmail: formData.get("profileEmail"),
      phone: formData.get("phone"),
      preferredContact: formData.get("preferredContact"),
      mailingAddress: formData.get("mailingAddress"),
      city: formData.get("city"),
      state: formData.get("state"),
      zip: formData.get("zip"),
    });
    profileStatus.textContent = "Profile saved.";
  } catch (error) {
    profileStatus.textContent = error.message;
  }
});

logoutButton.addEventListener("click", () => {
  portalCredentials = null;
  dashboard.hidden = true;
  loginPanel.hidden = false;
  loginForm.reset();
});

portalNavButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setPortalView(button.dataset.portalView);
  });
});
