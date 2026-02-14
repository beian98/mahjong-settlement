// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// 云函数入口函数
exports.main = async (event, context) => {
  const { roomId, playerId, score } = event

  console.log('=== submitScoreForTest 云函数开始 ===')
  console.log('参数:', { roomId, playerId, score })

  try {
    // 验证是否是测试玩家
    if (!playerId.startsWith('test_')) {
      return {
        success: false,
        message: '只能为测试玩家提交分数'
      }
    }

    // 获取房间数据
    const roomResult = await db.collection('rooms').doc(roomId).get()
    if (!roomResult.data) {
      return { success: false, message: '房间不存在' }
    }

    const room = roomResult.data
    const currentRound = room.currentRound || {}
    const currentRoundNumber = currentRound.roundNumber || 1
    const currentGameSessionId = room.gameSessionId || currentRound.gameSessionId

    // 创建一个新的 submissions 对象，避免直接修改数据库对象
    let submissions = JSON.parse(JSON.stringify(currentRound.submissions || {}))

    // 关键修复：清理没有 roundNumber 或 roundNumber 不匹配的旧数据
    // 同时验证 gameSessionId，确保不会混入其他对局的数据
    console.log('🔍 开始清理旧数据，当前局数:', currentRoundNumber, '当前对局ID:', currentGameSessionId)
    Object.keys(submissions).forEach(key => {
      const record = submissions[key]
      if (!record.roundNumber) {
        console.warn(`🗑️ 清理缺少 roundNumber 的旧数据: ${key}`)
        delete submissions[key]
      } else if (record.roundNumber !== currentRoundNumber) {
        console.warn(`🗑️ 清理过期数据: ${key} (记录局数: ${record.roundNumber}, 当前局数: ${currentRoundNumber})`)
        delete submissions[key]
      } else if (currentGameSessionId && record.gameSessionId && record.gameSessionId !== currentGameSessionId) {
        console.warn(`🗑️ 清理其他对局的数据: ${key} (记录对局ID: ${record.gameSessionId}, 当前对局ID: ${currentGameSessionId})`)
        delete submissions[key]
      }
    })
    console.log('✅ 清理完成，剩余记录:', Object.keys(submissions))

    console.log('📊 从数据库读取的 submissions:', submissions)
    console.log('📊 submissions 的 keys:', Object.keys(submissions))
    console.log('📊 当前要提交的测试玩家:', playerId)
    console.log('📊 房间所有玩家:', room.players.map(p => ({ openId: p.openId, nickName: p.nickName })))

    // 验证：检查 submissions 中是否有真实玩家的记录
    const realPlayersInSubmissions = Object.keys(submissions).filter(key => !key.startsWith('test_'))
    if (realPlayersInSubmissions.length > 0) {
      console.log('⚠️ 数据库中已有真实玩家的记录:', realPlayersInSubmissions)
    }

    // 不再清理真实玩家的提交记录，保留所有已提交的记录
    // 这样真实玩家和测试玩家可以独立提交

    // 更新测试玩家的提交
    submissions[playerId] = {
      score: parseFloat(score),
      submitted: true,
      timestamp: Date.now(),
      roundNumber: currentRoundNumber,  // 记录是哪一局的提交
      gameSessionId: currentGameSessionId  // 记录是哪个对局的提交
    }

    console.log('📊 更新后的 submissions:', submissions)
    console.log('📊 更新后的 keys:', Object.keys(submissions))

    // 检查是否所有玩家都提交了（只统计当前局的提交）
    const allSubmitted = room.players.every(p => {
      const submission = submissions[p.openId]
      // 必须已提交且是当前局的数据
      return submission?.submitted && submission?.roundNumber === currentRoundNumber
    })

    console.log('📊 检查所有玩家提交状态 (当前局:', currentRoundNumber, '):')
    room.players.forEach(p => {
      const submission = submissions[p.openId]
      const isCurrentRound = submission?.roundNumber === currentRoundNumber
      const status = submission?.submitted && isCurrentRound ? '✅ 已提交' : '❌ 未提交'
      const roundInfo = submission?.roundNumber ? `(第${submission.roundNumber}局)` : ''
      console.log(`  - ${p.nickName} (${p.openId}): ${status} ${roundInfo}`)
    })

    // 计算总分（只统计当前局的提交）
    let totalScore = 0
    room.players.forEach(p => {
      const submission = submissions[p.openId]
      if (submission?.submitted && submission?.roundNumber === currentRoundNumber) {
        totalScore += submission.score || 0
      }
    })

    // 检查是否平衡
    const isBalanced = Math.abs(totalScore) < 0.01

    console.log('📊 提交状态:', {
      allSubmitted,
      isBalanced,
      totalScore
    })

    // 如果所有人都提交了且平衡，自动保存本局
    if (allSubmitted && isBalanced) {
      console.log('✅ 所有人已提交且平衡，开始保存本局')

      // 更新玩家筹码
      const updatedPlayers = room.players.map(p => ({
        ...p,
        chipsBeforeRound: p.chips,
        chips: p.chips + (submissions[p.openId]?.score || 0)
      }))

      // 检查是否有人筹码≤0
      const isGameOver = updatedPlayers.some(p => p.chips <= 0)

      // 保存游戏记录
      await db.collection('games').add({
        data: {
          roomId: roomId,
          roomCode: room.roomCode,
          roundNumber: currentRound.roundNumber || 1,
          players: updatedPlayers,
          scores: submissions,
          timestamp: Date.now(),
          isGameOver: isGameOver
        }
      })

      // 更新房间玩家筹码，并立即重置 currentRound
      await db.collection('rooms').doc(roomId).update({
        data: {
          players: updatedPlayers,
          status: isGameOver ? 'finished' : 'playing',
          lastRoundNumber: currentRound.roundNumber || 1,
          // 重置 currentRound，准备下一局
          'currentRound.submissions': {},
          'currentRound.allSubmitted': false,
          'currentRound.isBalanced': false,
          'currentRound.totalScore': 0,
          'currentRound.roundNumber': _.inc(1)
        }
      })

      console.log('🎉 本局保存成功')

      return {
        success: true,
        allSubmitted: true,
        isBalanced: true,
        autoSaved: true,
        isGameOver: isGameOver
      }
    }

    // 如果所有人都提交了但不平衡，清空所有提交记录，要求重新填写
    if (allSubmitted && !isBalanced) {
      console.log('⚠️ 所有人已提交但不平衡，清空提交记录')

      await db.collection('rooms').doc(roomId).update({
        data: {
          'currentRound.submissions': {},
          'currentRound.allSubmitted': false,
          'currentRound.isBalanced': false,
          'currentRound.totalScore': 0
        }
      })

      return {
        success: true,
        allSubmitted: false,
        isBalanced: false,
        needResubmit: true,
        totalScore: totalScore
      }
    }

    // 只有在未完成提交时，才更新 submissions
    await db.collection('rooms').doc(roomId).update({
      data: {
        'currentRound.submissions': submissions,
        'currentRound.allSubmitted': allSubmitted,
        'currentRound.isBalanced': isBalanced,
        'currentRound.totalScore': totalScore
      }
    })

    return {
      success: true,
      allSubmitted,
      isBalanced,
      totalScore,
      autoSaved: false
    }
  } catch (err) {
    console.error('❌ 提交分数失败:', err)
    return {
      success: false,
      message: '提交失败: ' + err.message
    }
  }
}
