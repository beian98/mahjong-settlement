// 对再来一局进行投票
const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  const { roomId, agree } = event
  const wxContext = cloud.getWXContext()
  const openId = wxContext.OPENID

  try {
    console.log('🗳️ 投票再来一局:', { roomId, openId, agree })

    // 获取房间数据
    const roomResult = await db.collection('rooms').doc(roomId).get()
    if (!roomResult.data) {
      return { success: false, message: '房间不存在' }
    }

    const room = roomResult.data

    // 检查是否有进行中的投票
    if (!room.nextRoundVote || !room.nextRoundVote.active) {
      return { success: false, message: '没有进行中的投票' }
    }

    // 检查投票是否已过期
    if (Date.now() > room.nextRoundVote.expiresAt) {
      return { success: false, message: '投票已过期' }
    }

    // 更新投票
    const votes = room.nextRoundVote.votes
    votes[openId] = agree

    // 统计投票结果
    const totalPlayers = room.players.length
    const agreeCount = Object.values(votes).filter(v => v === true).length
    const disagreeCount = Object.values(votes).filter(v => v === false).length
    const notVotedCount = Object.values(votes).filter(v => v === null).length

    console.log('📊 投票统计:', { totalPlayers, agreeCount, disagreeCount, notVotedCount })

    // 判断投票是否通过（需要2票同意）
    const passed = agreeCount >= 2

    // 判断投票是否结束（所有人都投票了，或者已经确定结果）
    const allVoted = notVotedCount === 0
    const definitelyPassed = agreeCount >= 2
    const definitelyFailed = disagreeCount > totalPlayers - 2

    const voteEnded = allVoted || definitelyPassed || definitelyFailed

    console.log('📊 投票状态:', { passed, voteEnded, allVoted, definitelyPassed, definitelyFailed })

    if (voteEnded) {
      if (passed) {
        console.log('✅ 投票通过，准备下一局')

        // 重置所有玩家的筹码到初始值
        console.log('🔄 开始重置玩家筹码，初始筹码:', room.initialChips)
        console.log('🔄 重置前玩家数据:', room.players.map(p => ({ name: p.nickName, chips: p.chips })))

        const resetPlayers = room.players.map(player => ({
          ...player,
          chips: room.initialChips
        }))

        console.log('🔄 重置后玩家数据:', resetPlayers.map(p => ({ name: p.nickName, chips: p.chips })))

        // 投票通过，重置游戏状态
        // 关键修复：使用完整的 currentRound 对象替换，而不是点号更新
        // 这样可以确保 submissions 被完全清空，避免旧数据残留
        // 添加 gameSessionId 用于区分不同对局
        const gameSessionId = Date.now().toString()

        await db.collection('rooms').doc(roomId).update({
          data: {
            status: 'playing',
            players: resetPlayers,  // 重置玩家筹码
            lastRoundNumber: 0,  // 重置局数
            gameSessionId: gameSessionId,  // 新对局的唯一标识
            currentRound: {
              roundNumber: 1,  // 从第1局开始
              submissions: {},  // 完全清空提交记录
              allSubmitted: false,
              isBalanced: false,
              totalScore: 0,
              endGameVote: null,  // 清空结束游戏投票
              gameSessionId: gameSessionId  // 记录对局ID
            },
            nextRoundVote: {
              ...room.nextRoundVote,
              active: false,
              votes: votes,
              passed: true
            }
          }
        })

        console.log('✅ 数据库更新完成')

        return {
          success: true,
          passed: true,
          voteEnded: true,
          message: '投票通过，开始新的一局'
        }
      } else {
        console.log('❌ 投票未通过')

        // 投票未通过，关闭投票
        await db.collection('rooms').doc(roomId).update({
          data: {
            nextRoundVote: {
              ...room.nextRoundVote,
              active: false,
              votes: votes,
              passed: false
            }
          }
        })

        return {
          success: true,
          passed: false,
          voteEnded: true,
          message: '投票未通过'
        }
      }
    } else {
      // 投票尚未结束，更新投票数据
      await db.collection('rooms').doc(roomId).update({
        data: {
          'nextRoundVote.votes': votes
        }
      })

      return {
        success: true,
        passed: false,
        voteEnded: false,
        message: '投票已记录',
        agreeCount,
        disagreeCount,
        notVotedCount
      }
    }
  } catch (err) {
    console.error('❌ 投票失败:', err)
    return {
      success: false,
      message: '投票失败: ' + err.message
    }
  }
}
