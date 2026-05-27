/**
 * Contact form → POST /api/contact → Discord webhook (server-side only)
 */
document.addEventListener("DOMContentLoaded", function () {
  var form = document.getElementById("contact-form");
  if (!form) return;

  var statusEl = document.getElementById("contact-status");
  var submitBtn = document.getElementById("contact-submit");

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    var category = document.getElementById("contact-category").value;
    var title = document.getElementById("contact-title").value.trim();
    var message = document.getElementById("contact-message").value.trim();
    var contact = document.getElementById("contact-info").value.trim();
    var honeypot = document.getElementById("contact-website").value;

    if (!category || !title || !message || !contact) {
      setStatus("Fyll ut alle feltene.", "error");
      return;
    }

    setStatus("Sender…", "");
    submitBtn.disabled = true;

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
          setStatus("Takk! Meldingen er sendt.", "success");
          form.reset();
          return;
        }
        var msg =
          (result.data && result.data.error) ||
          "Kunne ikke sende. Prøv igjen om litt.";
        setStatus(msg, "error");
      })
      .catch(function () {
        setStatus("Nettverksfeil. Sjekk tilkoblingen og prøv igjen.", "error");
      })
      .finally(function () {
        submitBtn.disabled = false;
      });
  });

  function setStatus(text, type) {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.classList.remove("is-success", "is-error");
    if (type === "success") statusEl.classList.add("is-success");
    if (type === "error") statusEl.classList.add("is-error");
  }
});
