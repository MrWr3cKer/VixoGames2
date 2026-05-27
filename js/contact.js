/**
 * Contact form → POST /api/contact → Discord webhook (server-side only)
 */
document.addEventListener("DOMContentLoaded", function () {
  document.querySelectorAll(".contact-form").forEach(initContactForm);
  initContactModal();
});

function initContactForm(form) {
  var statusEl = form.querySelector(".contact-status");
  var submitBtn = form.querySelector(".contact-submit");

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    var category = form.querySelector('[name="category"]').value;
    var title = form.querySelector('[name="title"]').value.trim();
    var message = form.querySelector('[name="message"]').value.trim();
    var contact = form.querySelector('[name="contact"]').value.trim();
    var honeypotEl = form.querySelector('[name="website"]');
    var honeypot = honeypotEl ? honeypotEl.value : "";

    if (!category || !title || !message || !contact) {
      setFormStatus(statusEl, "Please fill in all fields.", "error");
      return;
    }

    setFormStatus(statusEl, "Sending…", "");
    if (submitBtn) submitBtn.disabled = true;

    fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: category,
        title: title,
        message: message,
        contact: contact,
        website: honeypot,
      }),
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, data: data };
        });
      })
      .then(function (result) {
        if (result.ok && result.data && result.data.success) {
          setFormStatus(statusEl, "Thanks! Your message was sent.", "success");
          form.reset();
          if (form.classList.contains("contact-form--modal")) {
            window.setTimeout(function () {
              closeContactModal();
            }, 1400);
          }
          return;
        }
        var msg =
          (result.data && result.data.error) ||
          "Could not send. Please try again in a moment.";
        setFormStatus(statusEl, msg, "error");
      })
      .catch(function () {
        setFormStatus(statusEl, "Network error. Check your connection and try again.", "error");
      })
      .finally(function () {
        if (submitBtn) submitBtn.disabled = false;
      });
  });
}

function setFormStatus(statusEl, text, type) {
  if (!statusEl) return;
  statusEl.textContent = text;
  statusEl.classList.remove("is-success", "is-error");
  if (type === "success") statusEl.classList.add("is-success");
  if (type === "error") statusEl.classList.add("is-error");
}

function initContactModal() {
  var modal = document.getElementById("contact-modal");
  var openBtn = document.getElementById("contact-open");
  if (!modal || !openBtn) return;

  openBtn.addEventListener("click", openContactModal);

  modal.querySelectorAll("[data-contact-close]").forEach(function (el) {
    el.addEventListener("click", closeContactModal);
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !modal.hidden) {
      closeContactModal();
    }
  });
}

function openContactModal() {
  var modal = document.getElementById("contact-modal");
  if (!modal) return;

  modal.hidden = false;
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("contact-modal-open");

  var firstField = modal.querySelector("select, input, textarea");
  if (firstField) {
    window.setTimeout(function () {
      firstField.focus();
    }, 80);
  }
}

function closeContactModal() {
  var modal = document.getElementById("contact-modal");
  if (!modal || modal.hidden) return;

  modal.hidden = true;
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("contact-modal-open");

  var openBtn = document.getElementById("contact-open");
  if (openBtn) openBtn.focus();
}
