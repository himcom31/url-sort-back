const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const { nanoid } = require("nanoid");
const validUrl = require("valid-url");
const path = require("path");

dotenv.config();

const PORT = process.env.PORT || 5000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

const app = express();
app.use(express.json());
app.use(cors());

// MongoDB connection
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// Schema
const urlSchema = new mongoose.Schema({
  longUrl: { type: String, required: true },
  shortCode: { type: String, required: true, unique: true },
  date: { type: Date, default: Date.now },
});

const Url = mongoose.model("Url", urlSchema);

// POST - create short link
app.post("/api/shorten", async (req, res) => {
  const { longUrl } = req.body;
  if (!longUrl) return res.status(400).json({ error: "longUrl is required" });

  if (!validUrl.isUri(longUrl)) {
    return res.status(400).json({ error: "Invalid URL" });
  }

  try {
    let existing = await Url.findOne({ longUrl });
    if (existing) {
      return res.json({ shortUrl: `${BASE_URL}/${existing.shortCode}` });
    }

    let shortCode;
    let tries = 0;
    do {
      shortCode = nanoid(8);
      const conflict = await Url.findOne({ shortCode });
      if (!conflict) break;
      tries++;
    } while (tries < 5);

    const newUrl = new Url({ longUrl, shortCode });
    await newUrl.save();

    res.json({ shortUrl: `${BASE_URL}/${shortCode}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Serve frontend in production
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "frontend", "build")));
  app.get("/*", (req, res) => {
    res.sendFile(path.resolve(__dirname, "frontend", "build", "index.html"));
  });
}

// Redirect short URL
app.get("/:shortCode", async (req, res) => {
  try {
    const urlDoc = await Url.findOne({ shortCode: req.params.shortCode });
    if (urlDoc) {
      return res.redirect(urlDoc.longUrl);
    } else {
      return res.status(404).json({ error: "Short URL not found" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));


