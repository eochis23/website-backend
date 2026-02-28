const express = require('express');
const cors = require('cors');
const http = require('http'); 
const { Server } = require('socket.io');
const { Sequelize, DataTypes } = require('sequelize');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const server = http.createServer(app); 
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// --- DATABASE SETUP ---
const sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    dialectOptions: { ssl: { require: true, rejectUnauthorized: false } }
});

const UserStats = sequelize.define('UserStats', {
    email: { type: DataTypes.STRING, primaryKey: true },
    firstName: { type: DataTypes.STRING },
    elo: { type: DataTypes.INTEGER, defaultValue: 1500 },
    wins: { type: DataTypes.INTEGER, defaultValue: 0 },
    losses: { type: DataTypes.INTEGER, defaultValue: 0 },
    draws: { type: DataTypes.INTEGER, defaultValue: 0 }
});

const MatchResult = sequelize.define('MatchResult', {
    whiteEmail: { type: DataTypes.STRING },
    blackEmail: { type: DataTypes.STRING },
    winner: { type: DataTypes.STRING },
    finalFen: { type: DataTypes.TEXT }
});

// Export models so socket.js can use them
module.exports = { UserStats, MatchResult };

// --- SOCKET.IO INITIALIZATION ---
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// Import and run the separate socket logic
require('./socket')(io);

// --- EXISTING ROUTES ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.get('/', (req, res) => {
    res.send('Backend is running with Gemini and WebSockets!');
});

app.post('/api/draft-email', async (req, res) => {
    const { bullets, name } = req.body;
    if (!bullets) return res.status(400).json({ error: "Bullet points are required" });
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash"});
        const prompt = `You are a helpful assistant. Turn the following bullet points into a professional, polite email message from "${name || 'a user'}" to Eric Ochis.\n1. Keep it concise and friendly.\n2. Sign off the email with the name "${name || 'User'}".\nBullet points:\n${bullets}`;
        const result = await model.generateContent(prompt);
        const response = await result.response;
        res.json({ draft: response.text() });
    } catch (error) { res.status(500).json({ error: "Failed to generate draft." }); }
});

app.post('/api/log-visitor', async (req, res) => {
    const { email, firstName } = req.body; //
    if (!email || !email.endsWith('@andrew.cmu.edu')) return res.status(400).json({ error: "Invalid CMU email" });
    try {
        const scriptUrl = process.env.GOOGLE_SCRIPT_URL; 
        await fetch(scriptUrl, {
            method: 'POST',
            body: JSON.stringify({ email: email, firstName: firstName }),
            headers: { 'Content-Type': 'application/json' }
        });
        res.json({ status: "success", message: "Visitor recorded!" });
    } catch (error) { res.status(500).json({ error: "Failed to log visitor." }); }
});

// --- START SERVER ---
sequelize.sync().then(() => {
    server.listen(port, () => {
        console.log(`🚀 Server running on port ${port}`);
    });
});