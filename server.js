const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Gemini
// Ensure you added GEMINI_API_KEY in Render Environment Variables!
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.get('/', (req, res) => {
    res.send('Backend is running with Gemini!');
});

// ROUTE 1: Generate Email Draft (The AI Feature)
app.post('/api/draft-email', async (req, res) => {
    const { bullets, name } = req.body;

    if (!bullets) {
        return res.status(400).json({ error: "Bullet points are required" });
    }

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash"});
        
        // This prompt now uses the sender's name
        const prompt = `
        You are a helpful assistant. 
        Turn the following bullet points into a professional, polite email message from "${name || 'a user'}" to Eric Ochis.
        
        1. Keep it concise and friendly.
        2. Sign off the email with the name "${name || 'User'}".
        
        Bullet points:
        ${bullets}
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        res.json({ draft: text });
    } catch (error) {
        console.error("Gemini Error:", error);
        res.status(500).json({ error: "Failed to generate draft." });
    }
});

// ROUTE 2: Receive Contact Form (The Logging Feature)
app.post('/api/contact', (req, res) => {
    const { name, email, message } = req.body;
    
    // Log to Render Console
    console.log("========================================");
    console.log("📨 NEW MESSAGE RECEIVED");
    console.log(`👤 Name: ${name}`);
    console.log(`📧 Email: ${email}`);
    console.log(`📝 Message: ${message}`);
    console.log("========================================");

    res.json({ status: "success", message: "Message logged successfully!" });
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
// ROUTE 3: Log Authenticated Visitors to Google Sheets
// ROUTE 3: Log Authenticated Visitors to Google Sheets
app.post('/api/log-visitor', async (req, res) => {
    const { email } = req.body;

    if (!email || !email.endsWith('@andrew.cmu.edu')) {
        console.log("❌ Rejected invalid email:", email);
        return res.status(400).json({ error: "Invalid or missing CMU email" });
    }

    try {
        const scriptUrl = process.env.GOOGLE_SCRIPT_URL; 
        
        if (!scriptUrl) {
            console.error("❌ ERROR: GOOGLE_SCRIPT_URL is missing in Render Environment Variables!");
            return res.status(500).json({ error: "Server config error" });
        }

        console.log(`⏳ Attempting to send ${email} to Google Sheets...`);

        const response = await fetch(scriptUrl, {
            method: 'POST',
            body: JSON.stringify({ email: email }),
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (!response.ok) {
            console.error(`❌ Google Sheets returned an error: ${response.status} ${response.statusText}`);
            return res.status(500).json({ error: "Failed to log visitor to sheet." });
        }

        console.log("========================================");
        console.log(`✅ SUCCESS: NEW VISITOR LOGGED TO SHEET: ${email}`);
        console.log("========================================");
        
        res.json({ status: "success", message: "Visitor recorded!" });
    } catch (error) {
        console.error("❌ Backend Fetch Error:", error.message);
        res.status(500).json({ error: "Failed to log visitor." });
    }
});
