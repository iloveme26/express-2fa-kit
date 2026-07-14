async function postJson(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function getJson(url) {
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

/** Redirects to /login.html unless the session is already authenticated. Returns whether it's safe to proceed. */
async function requireAuthOrRedirect() {
  const { status } = await getJson("/auth/me");
  if (status !== 200) {
    window.location.href = "/login.html";
    return false;
  }
  return true;
}

/** Wires up every .password-toggle button's data-target input to flip between password/text. */
function initPasswordToggles() {
  document.querySelectorAll(".password-toggle").forEach((button) => {
    const input = document.getElementById(button.getAttribute("data-target"));
    const eyeIcon = button.querySelector(".icon-eye");
    const eyeOffIcon = button.querySelector(".icon-eye-off");
    if (!input) return;

    button.addEventListener("click", () => {
      const willShow = input.type === "password";
      input.type = willShow ? "text" : "password";
      eyeIcon.classList.toggle("hidden", willShow);
      eyeOffIcon.classList.toggle("hidden", !willShow);
      button.setAttribute("aria-label", willShow ? "Hide password" : "Show password");
    });
  });
}

document.addEventListener("DOMContentLoaded", initPasswordToggles);
