// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const { nickName, avatarUrl, initialChips } = event
  const { OPENID } = cloud.getWXContext()

  try {
    // 生成唯一房间号
    let roomCode
    let exists = true
    let attempts = 0

    while (exists && attempts < 10) {
      roomCode = Math.floor(1000 + Math.random() * 9000).toString()
      const result = await db.collection('rooms')
        .where({ roomCode })
        .count()
      exists = result.total > 0
      attempts++
    }

    if (exists) {
      return {
        success: false,
        message: '生成房间号失败，请重试'
      }
    }

    // 创建房间
    const room = await db.collection('rooms').add({
      data: {
        roomCode,
        creatorOpenId: OPENID,
        initialChips: initialChips || 1000,
        players: [{
          openId: OPENID,
          nickName: nickName || '玩家1',
          avatarUrl: avatarUrl || '',
          chips: initialChips || 1000
        }],
        status: 'waiting',
        createdAt: Date.now(),
        expireAt: Date.now() + 2 * 60 * 60 * 1000 // 2小时后过期
      }
    })

    return {
      success: true,
      roomId: room._id,
      roomCode,
      initialChips: initialChips || 1000
    }
  } catch (err) {
    console.error('创建房间失败:', err)
    return {
      success: false,
      message: '创建房间失败: ' + err.message
    }
  }
}
