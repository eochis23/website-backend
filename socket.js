// socket.js
const { UserStats, MatchResult } = require('./models');

module.exports = function(io) {
    io.on('connection', (socket) => {
        console.log(`👤 User Connected: ${socket.id}`);

        socket.on('join_game', async ({ gameId, user }) => {
            socket.join(gameId);
            try {
                const [stats] = await UserStats.findOrCreate({ 
                    where: { email: user.email },
                    defaults: { firstName: user.firstName, elo: 1500 }
                });

                io.to(gameId).emit('update_players', {
                    email: user.email,
                    firstName: user.firstName,
                    picture: user.picture,
                    elo: stats.elo,
                    record: `${stats.wins}W - ${stats.losses}L - ${stats.draws}D`
                });
            } catch (err) {
                console.error("Join Error:", err);
            }
        });

        socket.on('make_move', (data) => {
            socket.to(data.gameId).emit('receive_move', data);
        });

        socket.on('disconnect', () => console.log("User Disconnected"));
    });
};