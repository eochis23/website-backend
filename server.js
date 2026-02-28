const express = require('express');
const cors = require('cors');
const http = require('http'); 
const { Server } = require('socket.io');
const { Sequelize, DataTypes } = require('sequelize');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const server = http.createServer(app); 
const port = process.env.PORT || 3000;

// 1. Initialize SQL Database (PostgreSQL on Render)
const sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    dialectOptions: { ssl: { require: true, rejectUnauthorized: false } }
});

// 2. Define the Game Model
// server.js - Update the Game Model definition
const Game = sequelize.define('Game', {
    id: {
        type: DataTypes.TEXT, // Changed from default Integer to TEXT
        primaryKey: true      // Explicitly set as primary key
    },
    fen: { type: DataTypes.TEXT, defaultValue: 'startpos' },
    whitePlayer: { type: DataTypes.JSON, allowNull: true },
    blackPlayer: { type: DataTypes.JSON, allowNull: true },
    history: { type: DataTypes.JSON, defaultValue: [] }
});

// 3. Initialize Socket.io
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(cors());
app.use(express.json());

// --- REAL-TIME CHESS & MATCHMAKING LOGIC ---
io.on('connection', (socket) => {
    console.log(`👤 User Connected: ${socket.id}`);

    // When a player joins a game room
    socket.on('join_game', async ({ gameId, user }) => {
        socket.join(gameId);
        
        // Find or create the game in the SQL database
        let [game, created] = await Game.findOrCreate({ where: { id: gameId } });

        // Assign spots (White or Black)
        if (!game.whitePlayer) {
            game.whitePlayer = user;
        } else if (!game.blackPlayer && game.whitePlayer.email !== user.email) {
            game.blackPlayer = user;
        }

        await game.save();

        // Tell everyone in the room who the players are
        io.to(gameId).emit('update_players', {
            white: game.whitePlayer,
            black: game.blackPlayer,
            fen: game.fen
        });
    });

    // Handle Moves
    socket.on('make_move', async ({ gameId, move, fen }) => {
        // Broadcast the move to the other player immediately
        socket.to(gameId).emit('receive_move', { move, fen });

        // Save the board state to SQL so it persists on refresh
        await Game.update({ fen: fen }, { where: { id: gameId } });
    });

    socket.on('disconnect', () => console.log("User Disconnected"));
});

// --- YOUR EXISTING ROUTES (DO NOT CHANGE DATA VALUES) ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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
    const { email, firstName } = req.body;
    if (!email || !email.endsWith('@andrew.cmu.edu')) return res.status(400).json({ error: "Invalid CMU email" });
    try {
        const scriptUrl = process.env.GOOGLE_SCRIPT_URL; 
        const response = await fetch(scriptUrl, {
            method: 'POST',
            body: JSON.stringify({ email: email, firstName: firstName }),
            headers: { 'Content-Type': 'application/json' }
        });
        res.json({ status: "success", message: "Visitor recorded!" });
    } catch (error) { res.status(500).json({ error: "Failed to log visitor." }); }
});

// Start server
sequelize.sync().then(() => {
    server.listen(port, () => console.log(`🚀 Server + WebSockets running on port ${port}`));
});