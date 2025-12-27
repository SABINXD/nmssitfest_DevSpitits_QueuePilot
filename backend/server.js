require("dotenv").config();

const express = require("express");
const path = require("path");

const app = express();

app.use(express.json());

// ✅ ROUTE (IMPORTANT)
const smsRoutes = require("./routes/sms");
app.use("/api/sms", smsRoutes);

// ✅ STATIC FILES
app.use(express.static(path.join(__dirname, "../public")));

// ✅ KEEP SERVER ALIVE
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
