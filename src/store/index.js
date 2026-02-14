import { createStore } from 'vuex'
import players from './modules/players'
import games from './modules/games'

const store = createStore({
  modules: {
    players,
    games
  }
})

export default store
