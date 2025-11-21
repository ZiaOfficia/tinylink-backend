// index.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { query } = require("./db");
const { generateCode, isValidCode, isValidUrl } = require("./utils");

const app = express();
const PORT = process.env.PORT || 5000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const VERSION = process.env.VERSION || "1.0";

// Middleware
app.use(cors({ origin: "*" })); // later you can restrict to your React app origin
app.use(express.json());

// Health check: /healthz -> 200
app.get("/healthz", (req, res) => {
  res.status(200).json({ ok: true, version: VERSION });
});

// POST /api/links - create new short link
// body: { url: string, code?: string }
app.post("/api/links", async (req, res) => {
  const { url, code } = req.body;

  if (!url) {
    return res.status(400).json({ message: "url is required" });
  }
  if (!isValidUrl(url)) {
    return res.status(400).json({ message: "Invalid URL" });
  }

  let finalCode = code;

  // If client provided code, validate pattern [A-Za-z0-9]{6,8}
  if (finalCode) {
    if (!isValidCode(finalCode)) {
      return res.status(400).json({
        message: "Code must match [A-Za-z0-9]{6,8}",
      });
    }
  }

  try {
    // If no custom code, generate unique one
    if (!finalCode) {
      let exists = true;
      while (exists) {
        finalCode = generateCode(6); // you can randomize 6–8 if you want
        const existing = await query(
          "SELECT id FROM links WHERE code = $1",
          [finalCode]
        );
        exists = existing.rows.length > 0;
      }
    }

    // Try to insert into DB
    const result = await query(
      "INSERT INTO links (code, original_url) VALUES ($1, $2) RETURNING *",
      [finalCode, url]
    );
    const link = result.rows[0];

    return res.status(201).json({
      id: link.id,
      code: link.code,
      original_url: link.original_url,
      clicks: link.clicks,
      last_clicked_at: link.last_clicked_at,
      created_at: link.created_at,
      short_url: `${BASE_URL}/${link.code}`,
    });
  } catch (err) {
    // Unique violation (code already exists) -> 409
    if (err.code === "23505") {
      return res.status(409).json({ message: "Code already exists" });
    }
    console.error("Error creating link:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// GET /api/links - list all links
app.get("/api/links", async (req, res) => {
  try {
    const result = await query(
      "SELECT id, code, original_url, clicks, last_clicked_at, created_at FROM links ORDER BY created_at DESC"
    );

    const links = result.rows.map((row) => ({
      ...row,
      short_url: `${BASE_URL}/${row.code}`,
    }));

    res.json(links);
  } catch (err) {
    console.error("Error listing links:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/links/:code - stats for one code
app.get("/api/links/:code", async (req, res) => {
  const { code } = req.params;

  if (!isValidCode(code)) {
    return res.status(400).json({ message: "Invalid code format" });
  }

  try {
    const result = await query(
      "SELECT id, code, original_url, clicks, last_clicked_at, created_at FROM links WHERE code = $1",
      [code]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Code not found" });
    }

    const link = result.rows[0];

    res.json({
      ...link,
      short_url: `${BASE_URL}/${link.code}`,
    });
  } catch (err) {
    console.error("Error getting link stats:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// DELETE /api/links/:code - delete link
app.delete("/api/links/:code", async (req, res) => {
  const { code } = req.params;

  if (!isValidCode(code)) {
    return res.status(400).json({ message: "Invalid code format" });
  }

  try {
    const result = await query("DELETE FROM links WHERE code = $1", [code]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Code not found" });
    }

    return res.status(204).end();
  } catch (err) {
    console.error("Error deleting link:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Redirect route: GET /:code
// Increments clicks + last_clicked_at, then redirects
app.get("/:code", async (req, res) => {
  const { code } = req.params;

  // Don't treat /api or /healthz as codes
  if (code === "api" || code === "healthz") {
    return res.status(404).send("Not found");
  }

  if (!isValidCode(code)) {
    return res.status(404).send("Short URL not found");
  }

  try {
    const result = await query(
      "SELECT id, original_url FROM links WHERE code = $1",
      [code]
    );

    if (result.rows.length === 0) {
      return res.status(404).send("Short URL not found");
    }

    const link = result.rows[0];

    // Update clicks + last_clicked_at
    await query(
      "UPDATE links SET clicks = clicks + 1, last_clicked_at = NOW() WHERE id = $1",
      [link.id]
    );

    return res.redirect(link.original_url);
  } catch (err) {
    console.error("Error redirecting:", err);
    res.status(500).send("Server error");
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
