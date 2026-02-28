// socket.js - Chess Logic & Real-time Events
const { UserStats, MatchResult } = require('./models'); // We'll define these in server.js or a models file

module.exports = function(io) {
    io.on('connection', (socket) => {
        console.log(`👤 User Connected: ${socket.id}`);

        // 1. JOIN GAME & SYNC ELO
        socket.on('join_game', async ({ gameId, user }) => {
            socket.join(gameId);

            try {
                // Find or create player stats in SQL
                const [stats] = await UserStats.findOrCreate({ 
                    where: { email: user.email },
                    defaults: { 
                        firstName: user.firstName, 
                        elo: 1500,
                        wins: 0,
                        losses: 0,
                        draws: 0
                    }
                });

                // Send the updated stats back to everyone in the room
                io.to(gameId).emit('update_players', {
                    email: user.email,
                    firstName: user.firstName,
                    picture: user.picture,
                    elo: stats.elo,
                    record: `${stats.wins}W - ${stats.losses}L - ${stats.draws}D`
                });

                console.log(`✅ ${user.firstName} joined room: ${gameId} with Elo: ${stats.elo}`);
            } catch (err) {
                console.error("SQL Error during join:", err);
            }
        });

        // 2. BROADCAST MOVES
        socket.on('make_move', (data) => {
            // Send the move to the opponent immediately (skip the sender)
            socket.to(data.gameId).emit('receive_move', {
                move: data.move,
                fen: data.fen
            });
        });

        // 3. GAME OVER & DATABASE UPDATE
        socket.on('game_over', async ({ gameId, winnerEmail, loserEmail, isDraw, finalFen }) => {
            console.log(`🏁 Game Over in ${gameId}. Winner: ${winnerEmail}`);
            
            try {
                if (isDraw) {
                    await UserStats.increment('draws', { where: { email: [winnerEmail, loserEmail] } });
                } else {
                    await UserStats.increment('wins', { where: { email: winnerEmail } });
                    await UserStats.increment('losses', { where: { email: loserEmail } });
                }

                // Save the final match result to SQL
                await MatchResult.create({
                    whiteEmail: winnerEmail, // Simplified for now
                    blackEmail: loserEmail,
                    winner: isDraw ? 'draw' : winnerEmail,
                    finalFen: finalFen
                });

                io.to(gameId).emit('stats_updated');
            } catch (err) {
                console.error("Failed to save match result:", err);
            }
        });

        socket.on('disconnect', () => {
            console.log("User Disconnected");
        });
    });
};