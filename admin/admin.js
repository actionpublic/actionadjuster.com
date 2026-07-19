const loginPanel = document.querySelector("[data-login-panel]");
const dashboard = document.querySelector("[data-dashboard]");
const loginForm = document.querySelector(".admin-login-form");
const statusText = document.querySelector(".admin-status");
const notificationList = document.querySelector("[data-notifications]");
const adminTitle = document.querySelector("#admin-title");
const totalCount = document.querySelector("[data-total]");
const totalCard = document.querySelector("[data-total-card]");
const latestDate = document.querySelector("[data-latest]");
const latestCard = document.querySelector("[data-latest-card]");
const refreshButton = document.querySelector("[data-refresh]");
const logoutButton = document.querySelector("[data-logout]");
const viewButtons = document.querySelectorAll("[data-view]");
const crmViewButtons = document.querySelectorAll("[data-crm-view]");
const filterBar = document.querySelector(".admin-filter-bar");
const searchInput = document.querySelector("[data-search]");
const statusFilter = document.querySelector("[data-status-filter]");
const damageFilter = document.querySelector("[data-damage-filter]");
const uploaderFilter = document.querySelector("[data-uploader-filter]");
const sortSelect = document.querySelector("[data-sort]");
let currentView = "active";
let currentCrmView = "inquiries";
let currentClaims = [];
let currentAdminProfile = null;
let activeDetailTabs = {};

function getToken() {
  return window.localStorage.getItem("actionAdjustersAdminToken");
}

function setToken(token) {
  window.localStorage.setItem("actionAdjustersAdminToken", token);
}

function clearToken() {
  window.localStorage.removeItem("actionAdjustersAdminToken");
}

function showDashboard() {
  loginPanel.hidden = true;
  dashboard.hidden = false;
}

function showLogin(message = "") {
  loginPanel.hidden = false;
  dashboard.hidden = true;
  statusText.textContent = message;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDateOnly(value) {
  return new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function formatTimeOnly(value) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
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

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read document."));
    reader.readAsDataURL(file);
  });
}

function actionButtonContent() {
  if (currentView === "archived") {
    return "Restore";
  }

  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v5" />
      <path d="M14 11v5" />
    </svg>
  `;
}

function checkIcon() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  `;
}

function searchableClaimText(claim) {
  return [
    claim.name,
    claim.phone,
    claim.email,
    claim.damage,
    claim.message,
    claim.status,
    claim.crmStage,
    claim.leadStatus,
    claim.clientStatus,
    claim.followUpAt,
    claim.internalNotes,
    claim.portalCode,
    claim.clientProfile?.displayName,
    claim.clientProfile?.phone,
    claim.clientProfile?.email,
    claim.clientProfile?.mailingAddress,
    claim.clientProfile?.city,
    claim.clientProfile?.state,
    claim.clientProfile?.zip,
    claim.clientProfile?.preferredContact,
    claim.clientProfile?.portalRole,
    claim.clientProfile?.portalNotes,
    (claim.updates || []).map((update) => update.text).join(" "),
    (claim.documents || []).map((document) => document.name).join(" "),
    (claim.documents || []).map((document) => document.source).join(" "),
    claim.createdAt,
    formatDate(claim.createdAt),
    formatDateOnly(claim.createdAt),
    formatTimeOnly(claim.createdAt),
  ]
    .join(" ")
    .toLowerCase();
}

function updateDamageOptions(claims) {
  const selected = damageFilter.value;
  const damages = [...new Set(claims.map((claim) => claim.damage).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  );

  damageFilter.innerHTML =
    '<option value="all">All damage</option>' +
    damages.map((damage) => `<option value="${escapeHtml(damage)}">${escapeHtml(damage)}</option>`).join("");

  damageFilter.value = damages.includes(selected) ? selected : "all";
}

function filteredClaims() {
  const query = searchInput.value.trim().toLowerCase();
  const status = statusFilter.value;
  const damage = damageFilter.value;
  const sort = sortSelect.value;

  return currentClaims
    .filter((claim) => {
      const matchesSearch = !query || searchableClaimText(claim).includes(query);
      const matchesStatus =
        status === "all" ||
        claim.status === status ||
        claim.crmStage === status;
      const matchesDamage = damage === "all" || claim.damage === damage;
      const matchesCrmView =
        currentCrmView === "inquiries"
          ? claim.crmStage === "inquiry"
          : currentCrmView === "leads"
            ? claim.crmStage === "lead"
            : currentCrmView === "clients" || currentCrmView === "documents" || currentCrmView === "portal"
              ? claim.crmStage === "client"
              : true;

      return matchesSearch && matchesStatus && matchesDamage && matchesCrmView;
    })
    .sort((a, b) => {
      if (sort === "oldest") {
        return new Date(a.createdAt) - new Date(b.createdAt);
      }

      if (sort === "name") {
        return String(a.name || "").localeCompare(String(b.name || ""));
      }

      if (sort === "phone") {
        return String(a.phone || "").localeCompare(String(b.phone || ""));
      }

      if (sort === "email") {
        return String(a.email || "").localeCompare(String(b.email || ""));
      }

      if (sort === "damage") {
        return String(a.damage || "").localeCompare(String(b.damage || ""));
      }

      if (sort === "status") {
        return String(a.status || "").localeCompare(String(b.status || ""));
      }

      return new Date(b.createdAt) - new Date(a.createdAt);
    });
}

function uploaderLabel(source) {
  return source === "client" ? "Client Portal" : "Admin";
}

function documentRows(claims) {
  const uploader = uploaderFilter.value;
  const query = searchInput.value.trim().toLowerCase();
  const sort = sortSelect.value;

  return claims
    .flatMap((claim) =>
      (claim.documents || []).map((document) => ({
        ...document,
        claimName: claim.name,
        claimDamage: claim.damage,
        claimEmail: claim.email,
      }))
    )
    .filter((document) => {
      const haystack = [
        document.name,
        document.claimName,
        document.claimDamage,
        document.claimEmail,
        uploaderLabel(document.source),
        document.createdAt,
        formatDate(document.createdAt),
      ]
        .join(" ")
        .toLowerCase();

      return (uploader === "all" || document.source === uploader) && (!query || haystack.includes(query));
    })
    .sort((a, b) => {
      if (sort === "oldest") {
        return new Date(a.createdAt) - new Date(b.createdAt);
      }

      if (sort === "document") {
        return String(a.name || "").localeCompare(String(b.name || ""));
      }

      if (sort === "uploader") {
        return uploaderLabel(a.source).localeCompare(uploaderLabel(b.source));
      }

      if (sort === "name") {
        return String(a.claimName || "").localeCompare(String(b.claimName || ""));
      }

      if (sort === "damage") {
        return String(a.claimDamage || "").localeCompare(String(b.claimDamage || ""));
      }

      return new Date(b.createdAt) - new Date(a.createdAt);
    });
}

function applyFilters() {
  filterBar.hidden = currentCrmView === "profile";
  const claims = filteredClaims();

  if (currentCrmView === "documents") {
    renderDocuments(claims);
    return;
  }

  if (currentCrmView === "portal") {
    renderPortalOverview(claims);
    return;
  }

  if (currentCrmView === "profile") {
    renderAdminProfile();
    return;
  }

  renderClaims(claims);
}

function crmViewTitle() {
  const titles = {
    inquiries: "Claim Inquiry Notification",
    leads: "Lead Pipeline",
    clients: "Client Claims",
    documents: "Claim Documents",
    portal: "Client Portal Access",
    profile: "Admin Profile",
    trash: "Trash Archive",
  };

  return titles[currentCrmView] || titles.inquiries;
}

function emptyMessage() {
  const messages = {
    inquiries: "No active claim inquiries.",
    leads: "No leads yet. Convert an inquiry into a lead to start follow-up.",
    clients: "No clients yet. Convert a lead into a client to manage documents and updates.",
    documents: "No client documents yet.",
    portal: "No client portal records yet.",
    profile: "Manage admin user profile settings.",
    trash: "No archived claim notifications.",
  };

  return messages[currentCrmView] || "No records.";
}

function stageLabel(claim) {
  if (claim.crmStage === "client") {
    return claim.clientStatus || "Active Claim";
  }

  if (claim.crmStage === "lead") {
    return claim.leadStatus || "Contact Needed";
  }

  return claim.status === "completed" ? "Completed Inquiry" : "New Inquiry";
}

function renderActivityLog(claim) {
  const entries = Array.isArray(claim.activityLog) ? claim.activityLog : [];

  if (!entries.length) {
    return "<p>No saved activity yet.</p>";
  }

  return entries
    .slice(0, 8)
    .map(
      (entry) => `
        <div class="activity-entry">
          <time datetime="${escapeHtml(entry.createdAt || "")}">${entry.createdAt ? formatDate(entry.createdAt) : "No date"}</time>
          <strong>${escapeHtml(entry.title || "Activity saved")}</strong>
          <p>${escapeHtml(entry.detail || "")}</p>
        </div>
      `
    )
    .join("");
}

function setLatestSubmission(value, visible = currentCrmView === "inquiries") {
  latestDate.textContent = value;
  latestCard.hidden = !visible;
}

function setTotalNotifications(value, visible = currentCrmView === "inquiries") {
  totalCount.textContent = value;
  totalCard.hidden = !visible;
}

async function loadAdminProfile() {
  const response = await fetch("/api/admin-profile", {
    headers: {
      Authorization: `Bearer ${getToken()}`,
    },
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Could not load admin profile.");
  }

  currentAdminProfile = data.profile;
}

function renderAdminProfile() {
  adminTitle.textContent = crmViewTitle();
  setTotalNotifications("1", false);
  setLatestSubmission("Profile", false);
  const profile = currentAdminProfile || {};

  notificationList.innerHTML = `
    <article class="profile-card">
      <div class="profile-card-header">
        <div>
          <span>Admin portal user</span>
          <strong>${escapeHtml(profile.name || "Action Adjusters Admin")}</strong>
        </div>
        <p>These settings identify the admin user inside the CRM dashboard.</p>
      </div>
      <div class="profile-form-grid">
        <label>
          Full Name
          <input type="text" data-admin-profile="name" value="${escapeHtml(profile.name || "")}" />
        </label>
        <label>
          Email
          <input type="email" data-admin-profile="email" value="${escapeHtml(profile.email || "")}" />
        </label>
        <label>
          Phone
          <input type="text" data-admin-profile="phone" value="${escapeHtml(profile.phone || "")}" />
        </label>
        <label>
          Role
          <input type="text" data-admin-profile="role" value="${escapeHtml(profile.role || "")}" />
        </label>
        <label>
          Time Zone
          <input type="text" data-admin-profile="timezone" value="${escapeHtml(profile.timezone || "")}" />
        </label>
        <label>
          Notification Email
          <input type="email" data-admin-profile="notificationEmail" value="${escapeHtml(profile.notificationEmail || "")}" />
        </label>
      </div>
      <button class="crm-link-button" type="button" data-admin-profile-save>Save Profile</button>
    </article>
  `;
}

function renderDocuments(claims) {
  adminTitle.textContent = crmViewTitle();
  const documents = documentRows(claims);

  setTotalNotifications(documents.length, false);
  setLatestSubmission("None yet", false);

  if (!documents.length) {
    notificationList.innerHTML = `<p class="empty-state">${emptyMessage()}</p>`;
    return;
  }

  notificationList.innerHTML = documents
    .map(
      (document) => `
        <article class="crm-card">
          <div>
            <span>Document</span>
            <strong>${escapeHtml(document.name)}</strong>
          </div>
          <div>
            <span>Client</span>
            <strong>${escapeHtml(document.claimName)}</strong>
          </div>
          <div>
            <span>Claim</span>
            <strong>${escapeHtml(document.claimDamage)}</strong>
          </div>
          <div>
            <span>Uploaded</span>
            <strong>${formatDate(document.createdAt)}</strong>
          </div>
          <div>
            <span>Uploaded By</span>
            <strong>${uploaderLabel(document.source)}</strong>
          </div>
          <a class="crm-link-button" href="${escapeHtml(document.dataUrl)}" download="${escapeHtml(document.name)}">Download</a>
        </article>
      `
    )
    .join("");
}

function renderPortalOverview(claims) {
  adminTitle.textContent = crmViewTitle();
  setTotalNotifications(claims.length, false);
  setLatestSubmission("None yet", false);

  if (!claims.length) {
    notificationList.innerHTML = `<p class="empty-state">${emptyMessage()}</p>`;
    return;
  }

  notificationList.innerHTML = claims
    .map(
      (claim) => `
        <article class="crm-card">
          <div>
            <span>Client</span>
            <strong>${escapeHtml(claim.name)}</strong>
          </div>
          <div>
            <span>Email</span>
            <strong>${escapeHtml(claim.email)}</strong>
          </div>
          <div>
            <span>Portal Code</span>
            <strong>${escapeHtml(claim.portalCode)}</strong>
          </div>
          <div>
            <span>Access</span>
            <strong>${claim.portalEnabled ? "Enabled" : "Disabled"}</strong>
          </div>
          <a class="crm-link-button" href="/portal/" target="_blank" rel="noreferrer">Open Portal</a>
        </article>
      `
    )
    .join("");
}

function renderDetailTabs(claim, tabs) {
  const activeTab = tabs.some((tab) => tab.id === activeDetailTabs[claim.id])
    ? activeDetailTabs[claim.id]
    : tabs[0].id;

  return `
    <div class="claim-detail-tabs" role="tablist" aria-label="Claim detail sections">
      ${tabs
        .map(
          (tab) => `
            <button
              type="button"
              class="${tab.id === activeTab ? "is-active" : ""}"
              data-detail-tab="${tab.id}"
              role="tab"
              aria-selected="${tab.id === activeTab ? "true" : "false"}"
            >
              ${escapeHtml(tab.label)}
            </button>`
        )
        .join("")}
    </div>
    <div class="claim-tab-window">
      ${tabs
        .map(
          (tab) => `
            <section class="claim-tab-panel ${tab.id === activeTab ? "is-active" : ""}" data-detail-panel="${tab.id}" role="tabpanel">
              ${tab.content}
            </section>`
        )
        .join("")}
    </div>
  `;
}

function renderOverviewPanel(claim) {
  return `
    <div class="notification-detail-grid">
      <section>
        <h2>Contact</h2>
        <p><span>Phone</span><a href="tel:${escapeHtml(claim.phone)}">${escapeHtml(claim.phone)}</a></p>
        <p><span>Email</span><a href="mailto:${escapeHtml(claim.email)}">${escapeHtml(claim.email)}</a></p>
      </section>
      <section>
        <h2>Claim</h2>
        <p><span>Damage</span>${escapeHtml(claim.damage)}</p>
        <p><span>Stage</span>${escapeHtml(claim.crmStage || "inquiry")}</p>
        <p><span>Status</span>${escapeHtml(stageLabel(claim))}</p>
        ${claim.followUpAt ? `<p><span>Follow Up</span>${escapeHtml(claim.followUpAt)}</p>` : ""}
      </section>
      <section class="message-panel">
        <h2>Message</h2>
        <p>${escapeHtml(claim.message)}</p>
      </section>
    </div>
  `;
}

function renderWorkflowPanel(claim) {
  return `
    <div class="crm-workflow-panel">
      <section>
        <h2>CRM Workflow</h2>
        <div class="crm-button-row">
          ${claim.crmStage === "inquiry" ? `<button type="button" data-claim-action="promoteLead" data-claim-id="${claim.id}">Turn Into Lead</button>` : ""}
          ${claim.crmStage === "lead" ? `<button type="button" data-claim-action="promoteClient" data-claim-id="${claim.id}">Turn Into Client</button>` : ""}
          <span>${escapeHtml(stageLabel(claim))}</span>
        </div>
      </section>
      <section>
        <h2>Status & Follow Up</h2>
        <div class="crm-form-grid">
          <label>
            Lead Status
            <select data-lead-status>
              ${["New Inquiry", "Contact Needed", "Contacted", "Inspection Scheduled", "Estimate Requested", "Waiting on Client", "Closed"].map(
                (status) => `<option value="${status}" ${claim.leadStatus === status ? "selected" : ""}>${status}</option>`
              ).join("")}
            </select>
          </label>
          <label>
            Client Status
            <select data-client-status>
              ${["", "Active Claim", "Documents Needed", "Submitted to Carrier", "Negotiating", "Settled", "Closed"].map(
                (status) => `<option value="${status}" ${claim.clientStatus === status ? "selected" : ""}>${status || "Not a client yet"}</option>`
              ).join("")}
            </select>
          </label>
          <label>
            Follow Up
            <input type="date" data-follow-up value="${escapeHtml(claim.followUpAt || "")}" />
          </label>
          <button type="button" data-claim-action="crm" data-claim-id="${claim.id}">Save CRM</button>
        </div>
      </section>
    </div>
  `;
}

function renderPortalPanel(claim) {
  if (claim.crmStage !== "client") {
    return `<div class="tab-empty-state">Turn this inquiry into a client to enable portal access and client profile settings.</div>`;
  }

  return `
    <div class="crm-workflow-panel">
      <section>
        <h2>Client Portal</h2>
        <p>Portal code: <strong>${escapeHtml(claim.portalCode)}</strong></p>
        <p>Portal access is ${claim.portalEnabled ? "enabled" : "disabled"}.</p>
        <div class="crm-button-row">
          <button type="button" data-claim-action="portal" data-portal-enabled="${claim.portalEnabled ? "false" : "true"}" data-claim-id="${claim.id}">
            ${claim.portalEnabled ? "Disable Portal" : "Enable Portal"}
          </button>
          <button type="button" data-claim-action="resetPortalCode" data-claim-id="${claim.id}">Reset Code</button>
          <a
            class="crm-link-button"
            href="mailto:${encodeURIComponent(claim.clientProfile?.email || claim.email || "")}?subject=${encodeURIComponent("Your Action Adjusters client portal code")}&body=${encodeURIComponent(`Hello ${claim.clientProfile?.displayName || claim.name || ""},\n\nYour Action Adjusters client portal is ready.\n\nPortal link: ${window.location.origin}/portal/\nPortal code: ${claim.portalCode}\n\nUse the email address on file to sign in.\n\nAction Adjusters`)}"
          >
            Email Code
          </a>
        </div>
      </section>
      <section class="client-profile-section">
        <h2>Client User Profile</h2>
        <div class="profile-form-grid compact">
          <label>
            Display Name
            <input type="text" data-client-profile="displayName" value="${escapeHtml(claim.clientProfile?.displayName || claim.name || "")}" />
          </label>
          <label>
            Email
            <input type="email" data-client-profile="email" value="${escapeHtml(claim.clientProfile?.email || claim.email || "")}" />
          </label>
          <label>
            Phone
            <input type="text" data-client-profile="phone" value="${escapeHtml(claim.clientProfile?.phone || claim.phone || "")}" />
          </label>
          <label>
            Preferred Contact
            <select data-client-profile="preferredContact">
              ${["Phone", "Email", "Text"].map(
                (option) => `<option value="${option}" ${(claim.clientProfile?.preferredContact || "Phone") === option ? "selected" : ""}>${option}</option>`
              ).join("")}
            </select>
          </label>
          <label>
            Portal Role
            <input type="text" data-client-profile="portalRole" value="${escapeHtml(claim.clientProfile?.portalRole || "Client")}" />
          </label>
          <label class="wide">
            Mailing Address
            <input type="text" data-client-profile="mailingAddress" value="${escapeHtml(claim.clientProfile?.mailingAddress || "")}" />
          </label>
          <label>
            City
            <input type="text" data-client-profile="city" value="${escapeHtml(claim.clientProfile?.city || "")}" />
          </label>
          <label>
            State
            <input type="text" data-client-profile="state" value="${escapeHtml(claim.clientProfile?.state || "")}" />
          </label>
          <label>
            ZIP
            <input type="text" data-client-profile="zip" value="${escapeHtml(claim.clientProfile?.zip || "")}" />
          </label>
          <label class="wide">
            Portal Notes
            <textarea rows="3" data-client-profile="portalNotes" placeholder="Private portal/profile notes...">${escapeHtml(claim.clientProfile?.portalNotes || "")}</textarea>
          </label>
        </div>
        <button type="button" data-claim-action="clientProfile" data-claim-id="${claim.id}">Save Client Profile</button>
      </section>
    </div>
  `;
}

function renderUpdatesDocumentsPanel(claim) {
  if (claim.crmStage !== "client") {
    return `<div class="tab-empty-state">Documents and client-visible updates are available after this inquiry becomes a client.</div>`;
  }

  return `
    <div class="crm-workflow-panel">
      <section>
        <h2>Updates</h2>
        <textarea data-update rows="3" placeholder="Add a claim update..."></textarea>
        <label class="checkbox-row"><input type="checkbox" data-update-visible checked /> Show in client portal</label>
        <button type="button" data-claim-action="update" data-claim-id="${claim.id}">Add Update</button>
        <div class="mini-list">
          ${(claim.updates || []).slice(0, 3).map((update) => `<p>${escapeHtml(update.text)}</p>`).join("") || "<p>No updates yet.</p>"}
        </div>
      </section>
      <section>
        <h2>Documents</h2>
        <input type="file" data-document-file />
        <label class="checkbox-row"><input type="checkbox" data-document-visible checked /> Show in client portal</label>
        <button type="button" data-claim-action="document" data-claim-id="${claim.id}">Upload Document</button>
        <div class="mini-list">
          ${(claim.documents || []).slice(0, 3).map((document) => `<p><a href="${escapeHtml(document.dataUrl)}" download="${escapeHtml(document.name)}">${escapeHtml(document.name)}</a></p>`).join("") || "<p>No documents yet.</p>"}
        </div>
      </section>
    </div>
  `;
}

function renderActivityPanel(claim) {
  return `
    <section class="activity-log">
      <h2>Activity Log</h2>
      ${renderActivityLog(claim)}
    </section>
  `;
}

function renderNotesPanel(claim) {
  return `
    <div class="internal-notes">
      <label>
        Internal notes
        <textarea data-notes rows="4" placeholder="Add private admin notes for this claim...">${escapeHtml(claim.internalNotes || "")}</textarea>
      </label>
      <button type="button" data-claim-action="notes" data-claim-id="${claim.id}">Save Notes</button>
    </div>
  `;
}

function renderClaimDetails(claim) {
  const tabs = [
    { id: "overview", label: "Overview", content: renderOverviewPanel(claim) },
    { id: "workflow", label: "Workflow", content: renderWorkflowPanel(claim) },
    { id: "portal", label: "Portal/Profile", content: renderPortalPanel(claim) },
    { id: "updates", label: "Updates/Docs", content: renderUpdatesDocumentsPanel(claim) },
    { id: "activity", label: "Activity", content: renderActivityPanel(claim) },
    { id: "notes", label: "Notes", content: renderNotesPanel(claim) },
  ];

  return renderDetailTabs(claim, tabs);
}

function renderClaims(claims) {
  adminTitle.textContent = crmViewTitle();
  setTotalNotifications(claims.length);
  setLatestSubmission(claims[0] ? formatDate(claims[0].createdAt) : "None yet");

  if (!claims.length) {
    notificationList.innerHTML = `<p class="empty-state">${emptyMessage()}</p>`;
    return;
  }

  const rows = claims
    .map(
      (claim) => `
        <article class="notification-card ${claim.status === "completed" ? "is-completed" : ""}" tabindex="0" data-claim-card data-claim-id="${escapeHtml(claim.id)}" aria-expanded="false">
          <div class="notification-summary">
            <div class="notification-field">
              <span>Name</span>
              <strong title="${escapeHtml(claim.name)}">${escapeHtml(claim.name)}</strong>
            </div>
            <div class="notification-field">
              <span>Date</span>
              <time datetime="${claim.createdAt}" title="${formatDate(claim.createdAt)}">${formatDateOnly(claim.createdAt)}</time>
            </div>
            <div class="notification-field">
              <span>Time</span>
              <time datetime="${claim.createdAt}" title="${formatDate(claim.createdAt)}">${formatTimeOnly(claim.createdAt)}</time>
            </div>
            <div class="notification-field">
              <span>Phone</span>
              <a href="tel:${escapeHtml(claim.phone)}" title="${escapeHtml(claim.phone)}">${escapeHtml(claim.phone)}</a>
            </div>
            <div class="notification-field">
              <span>Email</span>
              <a href="mailto:${escapeHtml(claim.email)}" title="${escapeHtml(claim.email)}">${escapeHtml(claim.email)}</a>
            </div>
            <div class="notification-field">
              <span>Damage</span>
              <span title="${escapeHtml(claim.damage)}">${escapeHtml(claim.damage)}</span>
            </div>
            <div class="notification-field">
              <span>${claim.crmStage === "inquiry" ? "Message" : "Stage"}</span>
              <span title="${escapeHtml(claim.crmStage === "inquiry" ? claim.message : stageLabel(claim))}">${escapeHtml(claim.crmStage === "inquiry" ? claim.message : stageLabel(claim))}</span>
            </div>
            <div class="notification-field notification-actions">
              <span>Actions</span>
              ${
                currentView === "archived"
                  ? ""
                  : `<button
                      class="icon-check ${claim.status === "completed" ? "is-complete" : ""}"
                      type="button"
                      data-claim-action="${claim.status === "completed" ? "uncomplete" : "complete"}"
                      data-claim-id="${claim.id}"
                      aria-label="${claim.status === "completed" ? "Mark claim not completed" : "Mark claim completed"}"
                      title="${claim.status === "completed" ? "Mark Not Completed" : "Mark Completed"}"
                    >
                      ${checkIcon()}
                    </button>`
              }
              <button
                class="${currentView === "archived" ? "" : "icon-trash"}"
                type="button"
                data-claim-action="${currentView === "archived" ? "restore" : "archive"}"
                data-claim-id="${claim.id}"
                aria-label="${currentView === "archived" ? "Restore claim" : "Move claim to trash"}"
                title="${currentView === "archived" ? "Restore" : "Move to Trash"}"
              >
                ${actionButtonContent()}
              </button>
              ${
                currentView === "archived"
                  ? `<button type="button" data-claim-action="delete" data-claim-id="${claim.id}">Purge</button>`
                  : ""
              }
            </div>
          </div>
          <div class="notification-details">
            ${renderClaimDetails(claim)}
          </div>
        </article>
      `
    )
    .join("");

  notificationList.innerHTML = rows;
}

async function loadClaims() {
  const response = await fetch(`/api/claims?status=${currentView}`, {
    headers: {
      Authorization: `Bearer ${getToken()}`,
    },
  });

  if (response.status === 401) {
    clearToken();
    showLogin("Please log in again.");
    return;
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Could not load notifications.");
  }

  showDashboard();
  if (!currentAdminProfile) {
    await loadAdminProfile();
  }
  currentClaims = data.claims || [];
  updateDamageOptions(currentClaims);
  applyFilters();
}

async function updateClaim(id, action, extra = {}) {
  const method = action === "delete" ? "DELETE" : "PATCH";
  const body = action === "delete" ? { id } : { id, action, ...extra };
  const response = await fetch("/api/claims", {
    method,
    headers: {
      Authorization: `Bearer ${getToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Could not update claim.");
  }

  await loadClaims();
}

async function updateAdminProfile(profile) {
  const response = await fetch("/api/admin-profile", {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${getToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(profile),
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Could not update admin profile.");
  }

  currentAdminProfile = data.profile;
  renderAdminProfile();
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(loginForm);
  const username = formData.get("username");
  const password = formData.get("password");

  if (window.location.protocol === "file:") {
    statusText.textContent = "Open the admin dashboard through the local Vercel server to log in.";
    return;
  }

  statusText.textContent = "Logging in...";

  try {
    const response = await fetch("/api/admin-login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Login failed.");
    }

    setToken(data.token);
    loginForm.reset();
    await loadClaims();
  } catch (error) {
    statusText.textContent = error.message || "Login failed.";
  }
});

refreshButton.addEventListener("click", () => {
  loadClaims().catch((error) => {
    notificationList.innerHTML = `<p class="empty-state">${error.message}</p>`;
  });
});

crmViewButtons.forEach((button) => {
  button.addEventListener("click", () => {
    currentCrmView = button.dataset.crmView;
    currentView = currentCrmView === "trash" ? "archived" : "active";
    crmViewButtons.forEach((item) => item.classList.toggle("is-active", item === button));
    searchInput.value = "";
    statusFilter.value = "all";
    damageFilter.value = "all";
    uploaderFilter.value = "all";
    loadClaims().catch((error) => {
      notificationList.innerHTML = `<p class="empty-state">${error.message}</p>`;
    });
  });
});

filterBar.addEventListener("submit", (event) => {
  event.preventDefault();
  applyFilters();
});

[searchInput, statusFilter, damageFilter, uploaderFilter, sortSelect].forEach((control) => {
  control.addEventListener("input", applyFilters);
  control.addEventListener("change", applyFilters);
});

notificationList.addEventListener("click", async (event) => {
  const adminProfileButton = event.target.closest("[data-admin-profile-save]");

  if (adminProfileButton) {
    const profile = {};
    notificationList.querySelectorAll("[data-admin-profile]").forEach((input) => {
      profile[input.dataset.adminProfile] = input.value;
    });

    updateAdminProfile(profile).catch((error) => {
      notificationList.innerHTML = `<p class="empty-state">${error.message}</p>`;
    });
    return;
  }

  const detailTabButton = event.target.closest("[data-detail-tab]");

  if (detailTabButton) {
    const card = detailTabButton.closest("[data-claim-card]");
    const selectedTab = detailTabButton.dataset.detailTab;

    if (card && selectedTab) {
      activeDetailTabs[card.dataset.claimId] = selectedTab;

      card.querySelectorAll("[data-detail-tab]").forEach((tabButton) => {
        const isActive = tabButton.dataset.detailTab === selectedTab;
        tabButton.classList.toggle("is-active", isActive);
        tabButton.setAttribute("aria-selected", String(isActive));
      });

      card.querySelectorAll("[data-detail-panel]").forEach((panel) => {
        panel.classList.toggle("is-active", panel.dataset.detailPanel === selectedTab);
      });
    }

    return;
  }

  const button = event.target.closest("[data-claim-action]");

  if (button) {
    const action = button.dataset.claimAction;
    const card = button.closest("[data-claim-card]");

    if (
      action === "archive" &&
      !window.confirm("Are you sure you want to move this claim to trash?")
    ) {
      return;
    }

    if (
      action === "delete" &&
      !window.confirm("Are you sure you want to permanently delete this claim?")
    ) {
      return;
    }

    if (
      action === "resetPortalCode" &&
      !window.confirm("Reset this client's portal code? The old code will stop working.")
    ) {
      return;
    }

    let extra = {};

    if (action === "notes") {
      extra = { notes: card?.querySelector("[data-notes]")?.value || "" };
    }

    if (action === "crm") {
      extra = {
        leadStatus: card?.querySelector("[data-lead-status]")?.value || "",
        clientStatus: card?.querySelector("[data-client-status]")?.value || "",
        followUpAt: card?.querySelector("[data-follow-up]")?.value || "",
      };
    }

    if (action === "portal") {
      extra = { portalEnabled: button.dataset.portalEnabled === "true" };
    }

    if (action === "clientProfile") {
      const clientProfile = {};
      card?.querySelectorAll("[data-client-profile]").forEach((input) => {
        clientProfile[input.dataset.clientProfile] = input.value;
      });
      extra = clientProfile;
    }

    if (action === "update") {
      extra = {
        update: card?.querySelector("[data-update]")?.value || "",
        visibleToClient: card?.querySelector("[data-update-visible]")?.checked || false,
      };
    }

    if (action === "document") {
      const file = card?.querySelector("[data-document-file]")?.files?.[0];

      if (!file) {
        window.alert("Choose a document first.");
        return;
      }

      extra = {
        name: file.name,
        type: file.type,
        dataUrl: await readFileAsDataUrl(file),
        visibleToClient: card?.querySelector("[data-document-visible]")?.checked !== false,
      };
    }

    updateClaim(button.dataset.claimId, action, extra).catch((error) => {
      notificationList.innerHTML = `<p class="empty-state">${error.message}</p>`;
    });
    return;
  }

  if (event.target.closest("a, button, input, textarea, select")) {
    return;
  }

  const card = event.target.closest("[data-claim-card]");

  if (card) {
    const isExpanded = card.classList.toggle("is-expanded");
    card.setAttribute("aria-expanded", String(isExpanded));
  }
});

notificationList.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }

  const card = event.target.closest("[data-claim-card]");

  if (!card || event.target.closest("a, button, input, textarea, select")) {
    return;
  }

  event.preventDefault();
  const isExpanded = card.classList.toggle("is-expanded");
  card.setAttribute("aria-expanded", String(isExpanded));
});

logoutButton.addEventListener("click", () => {
  clearToken();
  showLogin();
});

if (getToken()) {
  loadClaims().catch(() => {
    clearToken();
    showLogin("Please log in again.");
  });
}
