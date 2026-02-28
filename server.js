const express = require('express');
const cors = require('cors');
const http = require('http'); 
const { Server } = require('socket.io');
const { Sequelize, DataTypes } = require('sequelize');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const server = http.createServer(app); 
const port = process.env.PORT || 3000;

// 1. Initialize SQL Database
const sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    dialectOptions: { ssl: { require: true, rejectUnauthorized: false } }
});

// 2. Define the NEW Game Model (Only for finished games)
const GameLog = sequelize.define('GameLog', {
    whitePlayer: { type: DataTypes.JSON, allowNull: true },
    blackPlayer: { type: DataTypes.JSON, allowNull: true },
    outcome: { type: DataTypes.STRING, allowNull: false }, 
    history: { type: DataTypes.JSON, defaultValue: [] }
});

// 3. In-Memory Store for Active Games
const activeGames = {};

// 4. Initialize Socket.io
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(cors());
app.use(express.json());

// --- REAL-TIME CHESS & MATCHMAKING LOGIC ---
io.on('connection', (socket) => {
    console.log(`👤 User Connected: ${socket.id}`);

    socket.on('join_game', ({ gameId, user }) => {
        socket.join(gameId);
        
        // Initialize the room in memory if it doesn't exist
        if (!activeGames[gameId]) {
            activeGames[gameId] = {
                whitePlayer: null,
                blackPlayer: null,
                fen: 'startpos',
                history: [] 
            };
        }

        const room = activeGames[gameId];

        if (!room.whitePlayer) {
            room.whitePlayer = user;
        } else if (!room.blackPlayer && room.whitePlayer.email !== user.email) {
            room.blackPlayer = user;
        }

        io.to(gameId).emit('update_players', {
            white: room.whitePlayer,
            black: room.blackPlayer,
            fen: room.fen
        });
    });

    socket.on('make_move', ({ gameId, move, fen, san }) => {
        socket.to(gameId).emit('receive_move', { move, fen });

        if (activeGames[gameId]) {
            activeGames[gameId].fen = fen;
            if (san) activeGames[gameId].history.push(san);
        }
    });

    socket.on('game_over', async ({ gameId, outcome }) => {
        const room = activeGames[gameId];
        if (room) {
            try {
                await GameLog.create({
                    whitePlayer: room.whitePlayer,
                    blackPlayer: room.blackPlayer,
                    outcome: outcome,
                    history: room.history
                });
                delete activeGames[gameId];
            } catch (err) {
                console.error("Failed to save game log:", err);
            }
        }
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


// Chat Relay
    socket.on('send_chat', ({ gameId, message, author }) => {
        socket.to(gameId).emit('receive_chat', { message, author });
    });

    // Resign Relay
    socket.on('resign', ({ gameId, outcome }) => {
        socket.to(gameId).emit('opponent_resigned', { outcome });
    });

    // Draw Offer Relay
    socket.on('offer_draw', ({ gameId }) => {
        socket.to(gameId).emit('draw_offered');
    });

    // Draw Accept Relay
    socket.on('accept_draw', ({ gameId }) => {
        socket.to(gameId).emit('draw_accepted');
    });
// Start server (Using force: true temporarily to wipe the broken Game table)
sequelize.sync({ force: true }).then(() => {
    server.listen(port, () => console.log(`🚀 Server + WebSockets running on port ${port}`));
});