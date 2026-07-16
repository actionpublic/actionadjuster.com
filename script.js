const menuButton = document.querySelector(".menu-toggle");
const nav = document.querySelector(".site-nav");
const claimForm = document.querySelector(".claim-form");

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
  const body = [
    `Full name: ${formData.get("name") || ""}`,
    `Phone: ${formData.get("phone") || ""}`,
    `Email: ${formData.get("email") || ""}`,
    `Type of damage: ${formData.get("damage") || ""}`,
    "",
    "What happened?",
    `${formData.get("message") || ""}`,
  ].join("\n");

  const subject = encodeURIComponent("New Action Adjusters Claim Review");
  const message = encodeURIComponent(body);

  window.location.href = `mailto:ActionPublicAdj@gmail.com?subject=${subject}&body=${message}`;
});
