// models.js
const { Sequelize, DataTypes } = require('sequelize');

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

module.exports = { sequelize, UserStats, MatchResult };