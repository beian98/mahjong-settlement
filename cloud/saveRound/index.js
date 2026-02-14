// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const { roomId, roomCode, roundNumber, scores, players, isGameOver } = event
  const { OPENID } = cloud.getWXContext()

  try {
    // 1. 验证筹码平衡（零和游戏）
    const totalScore = Object.values(scores).reduce((sum, score) => sum + score, 0)
    if (Math.abs(totalScore) >= 0.01) {
      return {
        success: false,
        message: '筹码不平衡，总和必须为0'
      }
    }

    // 2. 更新房间中的玩家筹码
    await db.collection('rooms').doc(roomId).update({
      data: {
        players: players,
        lastRoundNumber: roundNumber,
        updatedAt: Date.now()
      }
    })

    // 3. 保存本局游戏记录到games集合
    const gameData = {
      roomId: roomId,
      roomCode: roomCode,
      roundNumber: roundNumber,
      date: Date.now(),
      players: players.map(p => ({
        openId: p.openId,
        nickName: p.nickName,
        avatarUrl: p.avatarUrl || '',
        chipsBeforeRound: p.chipsBeforeRound,
        chipsAfterRound: p.chips,
        score: scores[p.openId]
      })),
      scores: scores,
      isGameOver: isGameOver,
      createdBy: OPENID
    }

    const gameResult = await db.collection('games').add({
      data: gameData
    })

    // 4. 如果游戏结束，更新房间状态
    if (isGameOver) {
      await db.collection('rooms').doc(roomId).update({
        data: {
          status: 'finished',
          finishedAt: Date.now()
        }
      })
    }

    return {
      success: true,
      gameId: gameResult._id,
      isGameOver: isGameOver,
      message: isGameOver ? '游戏结束' : '本局保存成功'
    }
  } catch (err) {
    console.error('保存游戏失败:', err)
    return {
      success: false,
      message: '保存游戏失败: ' + err.message
    }
  }
}
