// 发起结束游戏投票
const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  const { roomId } = event
  const wxContext = cloud.getWXContext()
  const openId = wxContext.OPENID

  try {
    console.log('📢 发起结束游戏投票:', { roomId, openId })

    // 获取房间数据
    const roomResult = await db.collection('rooms').doc(roomId).get()
    if (!roomResult.data) {
      return { success: false, message: '房间不存在' }
    }

    const room = roomResult.data

    // 检查是否已有进行中的投票
    if (room.currentRound?.endGameVote?.active) {
      return { success: false, message: '已有进行中的投票' }
    }

    // 初始化投票数据
    const votes = {}
    room.players.forEach(p => {
      votes[p.openId] = null  // null表示未投票
    })

    // 发起人自动投同意
    votes[openId] = true

    const now = Date.now()
    const endGameVote = {
      active: true,
      initiator: openId,
      initiatorName: room.players.find(p => p.openId === openId)?.nickName || '未知',
      createdAt: now,
      expiresAt: now + 30000,  // 30秒后过期
      votes: votes,
      passed: false
    }

    // 更新房间数据
    await db.collection('rooms').doc(roomId).update({
      data: {
        'currentRound.endGameVote': endGameVote
      }
    })

    console.log('✅ 投票发起成功')

    return {
      success: true,
      message: '投票已发起',
      endGameVote
    }
  } catch (err) {
    console.error('❌ 发起投票失败:', err)
    return {
      success: false,
      message: '发起投票失败: ' + err.message
    }
  }
}
