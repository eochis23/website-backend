// server.js - Updated Database and Socket Logic

// 1. Define the Database Model (ONLY for finished games)
// We call it GameLog so it creates a fresh table and avoids the previous ID error.
const GameLog = sequelize.define('GameLog', {
    whitePlayer: { type: DataTypes.JSON, allowNull: true },
    blackPlayer: { type: DataTypes.JSON, allowNull: true },
    outcome: { type: DataTypes.STRING, allowNull: false }, // "1-0", "0-1", or "1/2-1/2"
    history: { type: DataTypes.JSON, defaultValue: [] }
});

// 2. In-Memory Store for Active Games
const activeGames = {};

// 3. Socket Logic
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
                history: [] // We'll store the move SANs here
            };
        }

        const room = activeGames[gameId];

        // Assign spots
        if (!room.whitePlayer) {
            room.whitePlayer = user;
        } else if (!room.blackPlayer && room.whitePlayer.email !== user.email) {
            room.blackPlayer = user;
        }

        // Send current state to players
        io.to(gameId).emit('update_players', {
            white: room.whitePlayer,
            black: room.blackPlayer,
            fen: room.fen
        });
    });

    socket.on('make_move', ({ gameId, move, fen, san }) => {
        // Broadcast immediately
        socket.to(gameId).emit('receive_move', { move, fen });

        // Update in-memory state
        if (activeGames[gameId]) {
            activeGames[gameId].fen = fen;
            if (san) activeGames[gameId].history.push(san);
        }
    });

    // NEW: Save to DB only when the game is over
    socket.on('game_over', async ({ gameId, outcome }) => {
        const room = activeGames[gameId];
        if (room) {
            try {
                // Log to PostgreSQL
                await GameLog.create({
                    whitePlayer: room.whitePlayer,
                    blackPlayer: room.blackPlayer,
                    outcome: outcome,
                    history: room.history
                });
                console.log(`💾 Game ${gameId} saved to database. Outcome: ${outcome}`);
                
                // Clear the room from memory to reset for the next game
                delete activeGames[gameId];
            } catch (err) {
                console.error("Failed to save game log:", err);
            }
        }
    });

    socket.on('disconnect', () => console.log("User Disconnected"));
});

// Make sure to sync so the new GameLog table is created
sequelize.sync({ alter: true }).then(() => {
    server.listen(port, () => console.log(`🚀 Server + WebSockets running on port ${port}`));
});