// 检查投票超时
const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  const { roomId } = event

  try {
    console.log('⏰ 检查投票超时:', { roomId })

    // 获取房间数据
    const roomResult = await db.collection('rooms').doc(roomId).get()
    if (!roomResult.data) {
      return { success: false, message: '房间不存在' }
    }

    const room = roomResult.data
    const endGameVote = room.currentRound?.endGameVote

    // 检查是否有进行中的投票
    if (!endGameVote || !endGameVote.active) {
      return { success: false, message: '没有进行中的投票' }
    }

    // 检查是否已超时
    const now = Date.now()
    if (now <= endGameVote.expiresAt) {
      return { success: false, timeout: false, message: '投票未超时' }
    }

    console.log('⏰ 投票已超时，处理结果')

    // 统计投票结果（未投票的视为不同意）
    const votes = endGameVote.votes
    let agreeCount = 0

    Object.values(votes).forEach(v => {
      if (v === true) agreeCount++
      // null 和 false 都算不同意
    })

    console.log('📊 最终投票统计:', { agreeCount, totalPlayers: room.players.length })

    // 判断是否通过（需要3人或以上同意）
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
        timeout: true,
        votePassed: true,
        message: '投票通过，游戏结束',
        agreeCount
      }
    } else {
      console.log('❌ 投票未通过')

      await db.collection('rooms').doc(roomId).update({
        data: {
          'currentRound.endGameVote.active': false,
          'currentRound.endGameVote.passed': false
        }
      })

      return {
        success: true,
        timeout: true,
        votePassed: false,
        message: '投票未通过',
        agreeCount
      }
    }
  } catch (err) {
    console.error('❌ 检查投票超时失败:', err)
    return {
      success: false,
      message: '检查投票超时失败: ' + err.message
    }
  }
}
