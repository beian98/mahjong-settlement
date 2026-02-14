// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// 云函数入口函数
exports.main = async (event, context) => {
  const { roomCode, nickName, avatarUrl } = event
  const { OPENID } = cloud.getWXContext()

  console.log('=== joinRoom 云函数开始 [VERSION 2.0 - 已修复size错误] ===')
  console.log('参数:', { roomCode, nickName, avatarUrl })
  console.log('用户 OPENID:', OPENID)

  try {
    // 查找房间
    console.log('🔍 查找房间，roomCode:', roomCode)
    const roomResult = await db.collection('rooms')
      .where({
        roomCode
        // 移除 status 限制，允许玩家重新加入进行中的游戏
      })
      .get()

    console.log('📦 查询结果:', roomResult)

    if (roomResult.data.length === 0) {
      console.log('❌ 房间不存在')
      return {
        success: false,
        message: '房间不存在'
      }
    }

    const room = roomResult.data[0]
    console.log('✅ 找到房间:', room)

    // 检查游戏是否已结束
    if (room.status === 'finished') {
      console.log('❌ 游戏已结束')
      return {
        success: false,
        message: '游戏已结束'
      }
    }

    // 检查是否已加入
    const alreadyJoined = room.players.some(p => p.openId === OPENID)
    if (alreadyJoined) {
      console.log('⚠️ 用户已在房间中，允许重新进入')
      return {
        success: true,
        roomId: room._id,
        roomCode: room.roomCode,
        initialChips: room.initialChips,
        playerCount: room.players.length,
        isRejoin: true,  // 标记为重新加入
        roomStatus: room.status  // 返回房间状态
      }
    }

    // 检查是否已满（提前检查，减少不必要的更新尝试）
    if (room.players.length >= 4) {
      console.log('❌ 房间已满')
      return {
        success: false,
        message: '房间已满'
      }
    }

    // 准备新玩家信息
    console.log('➕ 准备添加玩家到房间')
    const newPlayer = {
      openId: OPENID,
      nickName: nickName || '玩家' + (room.players.length + 1),
      avatarUrl: avatarUrl || '',
      chips: room.initialChips
    }
    console.log('新玩家信息:', newPlayer)

    // 使用原子操作添加玩家
    // 先尝试更新，然后检查是否成功（处理并发情况）
    const updateResult = await db.collection('rooms')
      .where({
        _id: room._id
      })
      .update({
        data: {
          players: _.push(newPlayer)
        }
      })

    console.log('✅ 更新结果:', updateResult)

    // 检查更新是否成功
    if (updateResult.stats.updated === 0) {
      console.log('❌ 更新失败')
      return {
        success: false,
        message: '加入房间失败，请重试'
      }
    }

    // 更新成功后，重新查询房间以获取最新的玩家数量
    const updatedRoomResult = await db.collection('rooms')
      .doc(room._id)
      .get()

    const updatedRoom = updatedRoomResult.data
    console.log('📊 更新后的房间信息:', updatedRoom)

    // 检查是否超过4人（处理并发情况）
    if (updatedRoom.players.length > 4) {
      console.log('⚠️ 检测到超过4人，移除当前玩家')
      // 移除刚加入的玩家
      await db.collection('rooms')
        .doc(room._id)
        .update({
          data: {
            players: updatedRoom.players.filter(p => p.openId !== OPENID)
          }
        })
      return {
        success: false,
        message: '房间已满，请重试'
      }
    }

    const result = {
      success: true,
      roomId: room._id,
      roomCode: room.roomCode,
      initialChips: room.initialChips,
      playerCount: updatedRoom.players.length,
      isRejoin: false,  // 新加入的玩家
      roomStatus: updatedRoom.status  // 返回房间状态
    }

    console.log('🎉 加入成功，返回结果:', result)
    return result
  } catch (err) {
    console.error('❌ 加入房间失败:', err)
    return {
      success: false,
      message: '加入房间失败: ' + err.message
    }
  }
}
