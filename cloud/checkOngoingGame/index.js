// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()

  console.log('=== checkOngoingGame 云函数开始 ===')
  console.log('用户 OPENID:', OPENID)

  try {
    // 查找用户参与的所有未结束的房间（waiting 或 playing 状态）
    const roomResult = await db.collection('rooms')
      .where({
        status: db.command.in(['waiting', 'playing']),
        'players.openId': OPENID
      })
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get()

    console.log('📦 查询结果:', roomResult)

    if (roomResult.data.length > 0) {
      const room = roomResult.data[0]
      console.log('✅ 找到未结束的对局:', {
        roomId: room._id,
        roomCode: room.roomCode,
        status: room.status
      })

      return {
        success: true,
        hasOngoingGame: true,
        room: {
          _id: room._id,
          roomCode: room.roomCode,
          status: room.status,
          initialChips: room.initialChips
        }
      }
    } else {
      console.log('✅ 没有未结束的对局')
      return {
        success: true,
        hasOngoingGame: false
      }
    }
  } catch (err) {
    console.error('❌ 检查失败:', err)
    return {
      success: false,
      message: '检查失败: ' + err.message
    }
  }
}
