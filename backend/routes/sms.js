const express = require("express");
const router = express.Router();
const { sendSMS } = require("../services/smsService");

router.post("/send-admin-sms", async (req, res) => {
  try {
    const adminPhone = "+9779762639337";
    const message = " ,";

    await sendSMS(adminPhone, message);

    res.json({ success: true, message: "SMS sent" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false });
  }
});

module.exports = router;
