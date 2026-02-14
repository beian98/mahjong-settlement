export default {
  namespaced: true,

  state: {
    playerList: []
  },

  mutations: {
    SET_PLAYERS(state, players) {
      state.playerList = players
    },

    ADD_PLAYER(state, player) {
      state.playerList.push(player)
    },

    UPDATE_PLAYER(state, { id, data }) {
      const index = state.playerList.findIndex(p => p.id === id)
      if (index !== -1) {
        state.playerList[index] = { ...state.playerList[index], ...data }
      }
    },

    DELETE_PLAYER(state, id) {
      state.playerList = state.playerList.filter(p => p.id !== id)
    }
  },

  actions: {
    async loadPlayers({ commit }) {
      // TODO: 从云数据库加载玩家
      commit('SET_PLAYERS', [])
    },

    async addPlayer({ commit }, player) {
      // TODO: 保存到云数据库
      commit('ADD_PLAYER', player)
    }
  }
}
