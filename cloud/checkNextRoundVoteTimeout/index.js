// 检查再来一局投票是否超时
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

    // 检查是否有进行中的投票
    if (!room.nextRoundVote || !room.nextRoundVote.active) {
      return { success: true, timeout: false, message: '没有进行中的投票' }
    }

    // 检查是否超时
    const now = Date.now()
    const timeout = now > room.nextRoundVote.expiresAt

    if (timeout) {
      console.log('⏰ 投票已超时，关闭投票')

      // 关闭投票
      await db.collection('rooms').doc(roomId).update({
        data: {
          'nextRoundVote.active': false,
          'nextRoundVote.passed': false
        }
      })

      return {
        success: true,
        timeout: true,
        message: '投票已超时'
      }
    }

    return {
      success: true,
      timeout: false,
      message: '投票尚未超时'
    }
  } catch (err) {
    console.error('❌ 检查超时失败:', err)
    return {
      success: false,
      message: '检查超时失败: ' + err.message
    }
  }
}
