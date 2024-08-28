'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('hoaxes',
      {
        id: {
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
          type: Sequelize.INTEGER,
        },
        content: { type: Sequelize.STRING },
        timestamp : { type: Sequelize.BIGINT },
        userid: {
          type: Sequelize.INTEGER,
          references: {
            model: 'users',
            key: 'id'
          },
          onDelete: 'cascade'
        },
  
      }      
    );
  },

  // eslint-disable-next-line no-unused-vars
  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('hoaxes');

  }
};
