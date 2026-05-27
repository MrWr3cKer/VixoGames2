/**
 * Vercel Serverless Function — forwards contact form to Discord webhook.
 * Set DISCORD_WEBHOOK_URL in Vercel Environment Variables (never in client code).
 */

const CATEGORY_LABELS = {
  bug: "Report a bug",
  game: "Game suggestion",
  partnership: "Partnership",
  other: "Other",
};

const CATEGORY_COLORS = {
  bug: 0xef4444,
  game: 0x22c55e,
  partnership: 0xa855f7,
  other: 0x64748b,
};

const ALLOWED_ORIGINS = [
  "https://www.vixogames.com",
  "https://vixogames.com",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
];

const LIMITS = {
  title: 120,
  message: 2000,
  contact: 200,
};

function setCors(req, res) {
  const origin = req.headers.origin || "";
  if (ALLOWED_ORIGINS.includes(origin) || /^http:\/\/localhost:\d+$/.test(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Vary", "Origin");
}

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function cleanString(value, maxLen) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLen);
}

function isValidCategory(cat) {
  return Object.prototype.hasOwnProperty.call(CATEGORY_LABELS, cat);
}

function looksLikeEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function readJsonBody(req) {
  return new Promise(function (resolve, reject) {
    var chunks = [];
    req.on("data", function (chunk) {
      chunks.push(chunk);
    });
    req.on("end", function () {
      try {
        var raw = Buffer.concat(chunks).toString("utf8") || "{}";
        resolve(JSON.parse(raw));
      } catch (e) {
        resolve(null);
      }
    });
    req.on("error", reject);
  });
}

module.exports = async function handler(req, res) {
  setCors(req, res);

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== "POST") {
    json(res, 405, { success: false, error: "Method not allowed" });
    return;
  }

  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    console.error("DISCORD_WEBHOOK_URL is not set");
    json(res, 503, { success: false, error: "Contact form is not configured." });
    return;
  }

  let body = req.body;
  if (body === undefined || body === null) {
    body = await readJsonBody(req);
  } else if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch (e) {
      json(res, 400, { success: false, error: "Invalid JSON" });
      return;
    }
  }
  if (!body || typeof body !== "object") {
    json(res, 400, { success: false, error: "Invalid request" });
    return;
  }

  if (body.website) {
    json(res, 200, { success: true });
    return;
  }

  const category = cleanString(body.category, 32);
  const title = cleanString(body.title, LIMITS.title);
  const message = cleanString(body.message, LIMITS.message);
  const contact = cleanString(body.contact, LIMITS.contact);

  if (!isValidCategory(category)) {
    json(res, 400, { success: false, error: "Please choose a valid category." });
    return;
  }
  if (!title || title.length < 2) {
    json(res, 400, { success: false, error: "Subject is too short." });
    return;
  }
  if (!message || message.length < 10) {
    json(res, 400, { success: false, error: "Message must be at least 10 characters." });
    return;
  }
  if (!contact || contact.length < 3) {
    json(res, 400, { success: false, error: "Please provide Discord or email." });
    return;
  }

  const categoryLabel = CATEGORY_LABELS[category];
  const color = CATEGORY_COLORS[category] || CATEGORY_COLORS.other;
  const contactType = looksLikeEmail(contact) ? "Email" : "Discord / other";

  const embed = {
    title: title.slice(0, 256),
    description: message.length > 4096 ? message.slice(0, 4093) + "…" : message,
    color: color,
    fields: [
      { name: "Category", value: categoryLabel, inline: true },
      { name: "Contact", value: contact, inline: true },
      { name: "Type", value: contactType, inline: true },
    ],
    footer: { text: "VixoGames · contact form" },
    timestamp: new Date().toISOString(),
  };

  try {
    const discordRes = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "VixoGames Contact",
        embeds: [embed],
      }),
    });

    if (!discordRes.ok) {
      console.error("Discord webhook failed:", discordRes.status, await discordRes.text());
      json(res, 502, { success: false, error: "Could not deliver your message." });
      return;
    }

    json(res, 200, { success: true });
  } catch (err) {
    console.error("Discord webhook error:", err);
    json(res, 502, { success: false, error: "Could not deliver your message." });
  }
};
