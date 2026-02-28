// server.js
const express = require('express');
const cors = require('cors');
const http = require('http'); 
const { Server } = require('socket.io');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { sequelize } = require('./models'); // Import the DB connection

const app = express();
const server = http.createServer(app); 
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Socket.io Setup
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});
require('./socket')(io);

// Existing Routes
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.get('/', (req, res) => res.send('Backend is live!'));

app.post('/api/draft-email', async (req, res) => {
    const { bullets, name } = req.body;
    if (!bullets) return res.status(400).json({ error: "Bullets required" });
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash"});
        const prompt = `Professional email from "${name || 'User'}" to Eric Ochis: ${bullets}`;
        const result = await model.generateContent(prompt);
        res.json({ draft: result.response.text() });
    } catch (e) { res.status(500).json({ error: "AI Error" }); }
});

app.post('/api/log-visitor', async (req, res) => {
    const { email, firstName } = req.body;
    if (!email || !email.endsWith('@andrew.cmu.edu')) return res.status(400).json({ error: "Invalid email" });
    try {
        await fetch(process.env.GOOGLE_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ email, firstName }),
            headers: { 'Content-Type': 'application/json' }
        });
        res.json({ status: "success" });
    } catch (e) { res.status(500).json({ error: "Logging error" }); }
});

// Sync and Start
sequelize.sync().then(() => {
    server.listen(port, () => console.log(`🚀 Server running on port ${port}`));
});