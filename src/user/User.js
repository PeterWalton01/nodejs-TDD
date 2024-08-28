const Sequelize = require('sequelize');
const sequelize = require('../config/database');
const Token = require('../auth/Token');
const Hoax = require('../hoax/Hoax');

const Model = Sequelize.Model;

class User extends Model {}

User.init(
  {
    username: { type: Sequelize.STRING, unique: true },
    email: { type: Sequelize.STRING},
    password: { type: Sequelize.STRING},
    inactive: { type: Sequelize.BOOLEAN, defaultValue: true},
    activationToken: { type: Sequelize.STRING },
    passwordResetToken: { type: Sequelize.STRING },
    image: { type: Sequelize.STRING },
  },
  {
    sequelize,
    modelName: 'user',
  },
);

User.hasMany(Token, {onDelete: 'cascade', 
                     foreignKey: 'userid'});
User.hasMany(Hoax, {onDelete: 'cascade',
                     foreignKey: 'userid'});

Hoax.belongsTo(User, {foreignKey: 'userid'});
            

module.exports = User;
