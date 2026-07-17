const loginPanel = document.querySelector("[data-login-panel]");
const dashboard = document.querySelector("[data-dashboard]");
const loginForm = document.querySelector(".admin-login-form");
const statusText = document.querySelector(".admin-status");
const notificationList = document.querySelector("[data-notifications]");
const totalCount = document.querySelector("[data-total]");
const latestDate = document.querySelector("[data-latest]");
const refreshButton = document.querySelector("[data-refresh]");
const logoutButton = document.querySelector("[data-logout]");

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

function renderClaims(claims) {
  totalCount.textContent = claims.length;
  latestDate.textContent = claims[0] ? formatDate(claims[0].createdAt) : "None yet";

  if (!claims.length) {
    notificationList.innerHTML = '<p class="empty-state">No claim notifications yet.</p>';
    return;
  }

  notificationList.innerHTML = claims
    .map(
      (claim) => `
        <article class="notification-card">
          <div class="notification-topline">
            <strong>${escapeHtml(claim.name)}</strong>
            <time datetime="${claim.createdAt}">${formatDate(claim.createdAt)}</time>
          </div>
          <dl>
            <div>
              <dt>Phone</dt>
              <dd><a href="tel:${escapeHtml(claim.phone)}">${escapeHtml(claim.phone)}</a></dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd><a href="mailto:${escapeHtml(claim.email)}">${escapeHtml(claim.email)}</a></dd>
            </div>
            <div>
              <dt>Damage</dt>
              <dd>${escapeHtml(claim.damage)}</dd>
            </div>
            <div class="wide">
              <dt>Message</dt>
              <dd>${escapeHtml(claim.message)}</dd>
            </div>
          </dl>
        </article>
      `
    )
    .join("");
}

async function loadClaims() {
  const response = await fetch("/api/claims", {
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
  renderClaims(data.claims || []);
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(loginForm);
  const username = formData.get("username");
  const password = formData.get("password");
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
