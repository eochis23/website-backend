const express = require('express');
const cors = require('cors');
const http = require('http'); 
const crypto = require('crypto');
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

// 2. Define the NEW Game Model
const GameLog = sequelize.define('GameLog', {
    whitePlayer: { type: DataTypes.JSON, allowNull: true },
    blackPlayer: { type: DataTypes.JSON, allowNull: true },
    outcome: { type: DataTypes.STRING, allowNull: false }, 
    history: { type: DataTypes.JSON, defaultValue: [] }
});

// 3. In-Memory Store
const activeGames = {};
const emailToGame = {}; 
const socketToEmail = {}; 
const disconnectTimers = {}; 
let waitingPlayer = null; // Only declare this once!

// 4. Initialize Socket.io
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(cors());
app.use(express.json());

// --- REAL-TIME CHESS & MATCHMAKING LOGIC ---
io.on('connection', (socket) => {
    console.log(`👤 User Connected: ${socket.id}`);

    socket.on('find_match', async ({ user }) => {
        const email = user.email;

        socketToEmail[socket.id] = email; // Map it immediately

        // --- 1. RECONNECTION CHECK ---
        if (emailToGame[email] && activeGames[emailToGame[email]]) {
            const gameId = emailToGame[email];
            const room = activeGames[gameId];

            // Re-assign the new socket ID
            if (room.whitePlayer.email === email) {
                room.whitePlayer.socketId = socket.id;
            } else if (room.blackPlayer.email === email) {
                room.blackPlayer.socketId = socket.id;
            }

            socket.join(gameId);
            socket.emit('update_players', {
                gameId: gameId, 
                white: room.whitePlayer,
                black: room.blackPlayer,
                fen: room.fen // Send the mid-game state!
            });

            // Clear the forfeit timer if they came back
            if (disconnectTimers[email]) {
                clearTimeout(disconnectTimers[email]);
                delete disconnectTimers[email];
                // Tell the opponent they returned
                socket.to(gameId).emit('receive_chat', { message: "Opponent reconnected!", author: "System" });
            }
            
            return; // MUST HAVE THIS RETURN to stop them from entering the queue
        }
        
        // --- 2. NORMAL MATCHMAKING ---
        if (waitingPlayer && waitingPlayer.socket.id === socket.id) return;

        if (waitingPlayer) {
            const gameId = crypto.randomUUID();
            const p1 = waitingPlayer;
            const p2 = { socket, user };

            const isP1White = Math.random() < 0.5;
            const whitePlayer = isP1White ? p1 : p2;
            const blackPlayer = isP1White ? p2 : p1;

            const whiteUser = { ...whitePlayer.user, socketId: whitePlayer.socket.id };
            const blackUser = { ...blackPlayer.user, socketId: blackPlayer.socket.id };

            // Lock the emails into the active game mapping
            emailToGame[whiteUser.email] = gameId;
            emailToGame[blackUser.email] = gameId;

            let whiteWins = 0; let blackWins = 0; let draws = 0;
            try {
                const pastGames = await GameLog.findAll(); 
                pastGames.forEach(game => {
                    const wEmail = game.whitePlayer?.email;
                    const bEmail = game.blackPlayer?.email;
                    
                    if ((wEmail === whiteUser.email && bEmail === blackUser.email) ||
                        (wEmail === blackUser.email && bEmail === whiteUser.email)) {
                        
                        if (game.outcome === '1/2-1/2') {
                            draws++;
                        } else if (game.outcome === '1-0') {
                            if (wEmail === whiteUser.email) whiteWins++; else blackWins++;
                        } else if (game.outcome === '0-1') {
                            if (bEmail === whiteUser.email) blackWins++; else whiteWins++;
                        }
                    }
                });
            } catch (err) {
                console.error("Failed to fetch head-to-head record:", err);
            }

            activeGames[gameId] = {
                whitePlayer: whiteUser,
                blackPlayer: blackUser,
                fen: 'startpos',
                history: []
            };

            whitePlayer.socket.join(gameId);
            blackPlayer.socket.join(gameId);

            io.to(gameId).emit('update_players', {
                gameId: gameId, 
                white: whiteUser,
                black: blackUser,
                fen: 'startpos',
                record: { whiteWins, blackWins, draws } 
            });

            waitingPlayer = null; 
        } else {
            waitingPlayer = { socket, user };
            socket.emit('waiting_for_match');
        }
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
                
                // --- NEW: Free the players to start a new match ---
                delete emailToGame[room.whitePlayer.email];
                delete emailToGame[room.blackPlayer.email];
                delete activeGames[gameId];

            } catch (err) {
                console.error("Failed to save game log:", err);
            }
        }
    });

    // Relays
    socket.on('send_chat', ({ gameId, message, author }) => socket.to(gameId).emit('receive_chat', { message, author }));
    socket.on('resign', ({ gameId, outcome }) => socket.to(gameId).emit('opponent_resigned', { outcome }));
    socket.on('offer_draw', ({ gameId }) => socket.to(gameId).emit('draw_offered'));
    socket.on('accept_draw', ({ gameId }) => socket.to(gameId).emit('draw_accepted'));
    socket.on('rescind_draw', ({ gameId }) => socket.to(gameId).emit('draw_rescinded'));

    socket.on('disconnect', () => {
        const email = socketToEmail[socket.id];

        // 1. Remove from queue if waiting
        if (waitingPlayer && waitingPlayer.socket.id === socket.id) {
            waitingPlayer = null;
        }

        // 2. Handle active game disconnects
        if (email && emailToGame[email]) {
            const gameId = emailToGame[email];
            const room = activeGames[gameId];

            if (room) {
                // Let the opponent know the clock is ticking
                socket.to(gameId).emit('receive_chat', { 
                    message: "Opponent disconnected. 60 seconds until forfeit...", 
                    author: "System" 
                });

                // Start the 60s forfeit timer
                disconnectTimers[email] = setTimeout(async () => {
                    const activeRoom = activeGames[gameId];
                    if (activeRoom) {
                        const isWhite = activeRoom.whitePlayer.email === email;
                        const outcome = isWhite ? '0-1' : '1-0'; // The person who stayed wins

                        // Tell the remaining player they won
                        io.to(gameId).emit('opponent_forfeited', { outcome });

                        // Log to DB and clean up
                        try {
                            await GameLog.create({
                                whitePlayer: activeRoom.whitePlayer,
                                blackPlayer: activeRoom.blackPlayer,
                                outcome: outcome,
                                history: activeRoom.history
                            });
                            
                            delete emailToGame[activeRoom.whitePlayer.email];
                            delete emailToGame[activeRoom.blackPlayer.email];
                            delete activeGames[gameId];
                            delete disconnectTimers[email];
                        } catch (err) {
                            console.error("Failed to save game log:", err);
                        }
                    }
                }, 60000);
            }
        }
        delete socketToEmail[socket.id]; // Clean up the map
        console.log("User Disconnected");
    });
});

// --- YOUR EXISTING ROUTES ---
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

// Start server (Using force: true temporarily to wipe the broken Game table)
sequelize.sync({ force: true }).then(() => {
    server.listen(port, () => console.log(`🚀 Server + WebSockets running on port ${port}`));
});