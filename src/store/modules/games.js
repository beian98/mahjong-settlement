export default {
  namespaced: true,

  state: {
    currentRoom: null,
    currentGame: null,
    gameHistory: []
  },

  mutations: {
    SET_CURRENT_ROOM(state, room) {
      state.currentRoom = room
    },

    SET_CURRENT_GAME(state, game) {
      state.currentGame = game
    },

    SET_GAME_HISTORY(state, history) {
      state.gameHistory = history
    },

    ADD_GAME_TO_HISTORY(state, game) {
      state.gameHistory.unshift(game)
    }
  },

  actions: {
    async loadGameHistory({ commit }) {
      // TODO: 从云数据库加载历史游戏
      commit('SET_GAME_HISTORY', [])
    },

    async saveGame({ commit }, game) {
      // TODO: 保存到云数据库
      commit('ADD_GAME_TO_HISTORY', game)
    }
  }
}
