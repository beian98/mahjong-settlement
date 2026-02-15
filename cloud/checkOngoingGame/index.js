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
    // 计算 1 小时前的时间戳（使用数字类型）
    const now = Date.now()
    const oneHourAgo = now - 60 * 60 * 1000
    console.log('当前时间戳:', now, '对应日期:', new Date(now))
    console.log('1小时前时间戳:', oneHourAgo, '对应日期:', new Date(oneHourAgo))

    // 先查询所有该用户参与的房间（不限时间）
    const allRoomsResult = await db.collection('rooms')
      .where({
        'players.openId': OPENID
      })
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get()

    console.log('📦 用户参与的所有房间（最近5个）:', allRoomsResult.data.map(r => ({
      roomCode: r.roomCode,
      status: r.status,
      createdAt: r.createdAt,
      createdAtDate: new Date(r.createdAt).toISOString(),
      isWithinOneHour: r.createdAt >= oneHourAgo,
      playersCount: r.players?.length
    })))

    // 查找用户参与的所有未结束的房间（waiting 或 playing 状态），且创建时间在 1 小时内
    const roomResult = await db.collection('rooms')
      .where({
        status: db.command.in(['waiting', 'playing']),
        'players.openId': OPENID,
        createdAt: db.command.gte(oneHourAgo)
      })
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get()

    console.log('📦 查询结果（1小时内未结束的房间）:', roomResult)

    if (roomResult.data.length > 0) {
      const room = roomResult.data[0]
      console.log('✅ 找到未结束的对局:', {
        roomId: room._id,
        roomCode: room.roomCode,
        status: room.status,
        createdAt: room.createdAt
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
