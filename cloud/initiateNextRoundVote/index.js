// 发起再来一局投票
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
    console.log('📢 发起再来一局投票:', { roomId, openId })

    // 获取房间数据
    const roomResult = await db.collection('rooms').doc(roomId).get()
    if (!roomResult.data) {
      return { success: false, message: '房间不存在' }
    }

    const room = roomResult.data

    // 检查游戏状态（允许在 playing 或 finished 状态下发起投票）
    if (room.status !== 'playing' && room.status !== 'finished') {
      return { success: false, message: '游戏状态不正确' }
    }

    // 检查是否已有进行中的投票
    if (room.nextRoundVote?.active) {
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
    const nextRoundVote = {
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
        nextRoundVote: nextRoundVote
      }
    })

    console.log('✅ 再来一局投票发起成功')

    return {
      success: true,
      message: '投票已发起',
      nextRoundVote
    }
  } catch (err) {
    console.error('❌ 发起投票失败:', err)
    return {
      success: false,
      message: '发起投票失败: ' + err.message
    }
  }
}
