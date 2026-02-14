// 投票结束游戏
const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { roomId, agree } = event  // agree: true=同意, false=不同意
  const wxContext = cloud.getWXContext()
  const openId = wxContext.OPENID

  try {
    console.log('🗳️ 玩家投票:', { roomId, openId, agree })

    // 获取房间数据
    const roomResult = await db.collection('rooms').doc(roomId).get()
    if (!roomResult.data) {
      return { success: false, message: '房间不存在' }
    }

    const room = roomResult.data
    const endGameVote = room.currentRound?.endGameVote

    // 检查是否有进行中的投票
    if (!endGameVote || !endGameVote.active) {
      return { success: false, message: '没���进行中的投票' }
    }

    // 检查投票是否已过期
    if (Date.now() > endGameVote.expiresAt) {
      return { success: false, message: '投票已结束' }
    }

    // 更新投票
    const voteKey = `currentRound.endGameVote.votes.${openId}`
    await db.collection('rooms').doc(roomId).update({
      data: {
        [voteKey]: agree
      }
    })

    // 重新获取房间数据，检查投票结果
    const updatedRoomResult = await db.collection('rooms').doc(roomId).get()
    const updatedVote = updatedRoomResult.data.currentRound.endGameVote
    const votes = updatedVote.votes

    // 统计投票结果
    let agreeCount = 0
    let disagreeCount = 0
    let notVotedCount = 0

    Object.values(votes).forEach(v => {
      if (v === true) agreeCount++
      else if (v === false) disagreeCount++
      else notVotedCount++
    })

    console.log('📊 投票统计:', { agreeCount, disagreeCount, notVotedCount })

    // 如果有3人或以上同意，结束游戏
    if (agreeCount >= 3) {
      console.log('✅ 投票通过，结束游戏')

      await db.collection('rooms').doc(roomId).update({
        data: {
          status: 'finished',
          'currentRound.endGameVote.active': false,
          'currentRound.endGameVote.passed': true
        }
      })

      return {
        success: true,
        votePassed: true,
        message: '投票通过，游戏结束',
        agreeCount,
        disagreeCount
      }
    }

    // 如果不同意的人数使得无法达到3人同意，投票失败
    const totalPlayers = room.players.length
    if (disagreeCount > totalPlayers - 3) {
      console.log('❌ 投票失败，不同意人数过多')

      await db.collection('rooms').doc(roomId).update({
        data: {
          'currentRound.endGameVote.active': false,
          'currentRound.endGameVote.passed': false
        }
      })

      return {
        success: true,
        votePassed: false,
        message: '投票未通过',
        agreeCount,
        disagreeCount
      }
    }

    return {
      success: true,
      votePassed: false,
      message: '投票已记录',
      agreeCount,
      disagreeCount,
      notVotedCount
    }
  } catch (err) {
    console.error('❌ 投票失败:', err)
    return {
      success: false,
      message: '投票失败: ' + err.message
    }
  }
}
