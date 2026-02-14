<template>
  <view class="lobby">
    <view class="header">
      <view class="room-code-display">
        <text class="label">房间号</text>
        <text class="code">{{ roomCode }}</text>
        <button class="copy-btn" @click="copyRoomCode" size="mini">
          复制
        </button>
      </view>
      <text class="chips-info">初始筹码: {{ initialChips }}</text>
    </view>

    <view class="players-container">
      <text class="section-title">玩家列表 ({{ players.length }}/4)</text>

      <view class="players-grid">
        <view
          class="player-card"
          v-for="(player, index) in displayPlayers"
          :key="index"
          :class="{ empty: !player.openId }"
        >
          <view class="player-avatar" v-if="player.openId">
            <text class="avatar-text">{{ player.nickName.charAt(0) }}</text>
          </view>
          <view class="player-avatar empty-avatar" v-else>
            <text class="avatar-text">?</text>
          </view>

          <text class="player-name">
            {{ player.openId ? player.nickName : '等待加入...' }}
          </text>

          <view class="player-status" v-if="player.openId">
            <text class="status-dot">●</text>
            <text class="status-text">已就绪</text>
          </view>
        </view>
      </view>
    </view>

    <view class="tips">
      <text v-if="players.length < 4" class="waiting-text">
        等待玩家加入... ({{ players.length }}/4人，需满4人开始)
      </text>
      <text v-else class="ready-text">
        ✓ 人数已满，即将开始游戏
      </text>
    </view>

    <view class="actions">
      <button
        v-if="isCreator && players.length < 4"
        class="test-btn"
        @click="addTestPlayer"
      >
        添加测试玩家 ({{ players.length }}/4)
      </button>
      <button v-if="isCreator && players.length < 4" class="cancel-btn" @click="cancelRoom">
        取消房间
      </button>
    </view>
  </view>
</template>

<script>
export default {
  data() {
    return {
      roomId: '',
      roomCode: '',
      initialChips: 1000,
      players: [],
      isCreator: false,
      watcher: null,
      pollTimer: null
    }
  },

  computed: {
    displayPlayers() {
      // 填充空位到4个
      const result = [...this.players]
      while (result.length < 4) {
        result.push({ openId: null })
      }
      return result
    }
  },

  onLoad(options) {
    this.roomId = options.roomId
    this.roomCode = options.roomCode || ''
    this.isCreator = options.isCreator === 'true'
    this.initialChips = parseInt(options.initialChips) || 1000

    // 保存当前房间信息到本地存储，用于恢复游戏
    wx.setStorageSync('currentRoom', {
      roomId: this.roomId,
      roomCode: this.roomCode,
      initialChips: this.initialChips
    })

    console.log('=== 房间大厅加载 ===')
    console.log('房间参数:', options)
    console.log('roomId:', this.roomId)
    console.log('roomCode:', this.roomCode)
    console.log('isCreator:', this.isCreator)

    // 立即加载一次房间数据
    this.loadRoomData()

    // 开始轮询房间状态（每2秒刷新一次）
    this.startPolling()
    console.log('✅ 轮询已启动')
  },

  onUnload() {
    // 停止轮询
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
    }
    // 停止监听
    if (this.watcher) {
      this.watcher.close()
    }
    // 页面卸载时清除房间信息
    wx.removeStorageSync('currentRoom')
  },

  methods: {
    async loadRoomData() {
      try {
        console.log('🔄 开始查询房间数据, roomId:', this.roomId)
        const db = wx.cloud.database()
        const result = await db.collection('rooms')
          .doc(this.roomId)
          .get()

        console.log('📦 数据库返回结果:', result)

        if (result.data) {
          const room = result.data
          const oldPlayerCount = this.players.length
          this.players = room.players || []
          this.roomCode = room.roomCode || this.roomCode

          console.log('✅ 房间数据:', room)
          console.log('👥 玩家列表:', this.players)
          console.log('📊 玩家数量变化:', oldPlayerCount, '->', this.players.length)

          // 打印每个玩家的详细信息
          this.players.forEach((player, index) => {
            console.log(`  玩家${index + 1}: ${player.nickName} (openId: ${player.openId.substring(0, 8)}...)`)
          })

          // 检查是否需要自动开始游戏
          if (room.status === 'playing') {
            console.log('🎮 房间状态已变为playing，准备跳转')
            this.startGame()
          } else if (room.players.length === 4 && room.status === 'waiting') {
            // 4人到齐，自动开始
            console.log('✨ 4人到齐，1秒后自动开始')
            setTimeout(() => {
              this.startGame()
            }, 1000)
          }
        } else {
          console.warn('⚠️ 未获取到房间数据')
        }
      } catch (err) {
        console.error('❌ 加载房间数据失败:', err)
        console.error('错误详情:', err.message, err.errMsg)
      }
    },

    startPolling() {
      // 每2秒轮询一次房间状态
      console.log('⏰ 启动定时器，每2秒轮询一次')
      this.pollTimer = setInterval(() => {
        console.log('⏱️ 定时器触发，查询房间数据...')
        this.loadRoomData()
      }, 2000)
    },

    watchRoom() {
      const db = wx.cloud.database()

      this.watcher = db.collection('rooms')
        .doc(this.roomId)
        .watch({
          onChange: (snapshot) => {
            if (snapshot.docs.length > 0) {
              const room = snapshot.docs[0]
              this.players = room.players || []

              // 4人到齐，自动开始游戏
              if (room.players.length === 4 && room.status === 'waiting') {
                setTimeout(() => {
                  this.startGame()
                }, 1000)
              }

              // 如果房间状态变为playing，跳转到游戏页面
              if (room.status === 'playing') {
                this.startGame()
              }
            }
          },
          onError: (err) => {
            console.error('监听失败:', err)
            uni.showToast({
              title: '连接失败，请重试',
              icon: 'none'
            })
          }
        })
    },

    async addTestPlayer() {
      if (this.players.length >= 4) {
        uni.showToast({
          title: '房间已满',
          icon: 'none'
        })
        return
      }

      try {
        const db = wx.cloud.database()
        const _ = db.command

        // 生成测试玩家
        const testPlayer = {
          openId: 'test_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
          nickName: '测试玩家' + (this.players.length + 1),
          avatarUrl: '',
          chips: this.initialChips
        }

        console.log('➕ 添加测试玩家:', testPlayer)

        await db.collection('rooms').doc(this.roomId).update({
          data: {
            players: _.push(testPlayer)
          }
        })

        uni.showToast({
          title: '已添加测试玩家',
          icon: 'success'
        })

        // 立即刷新房间数据
        this.loadRoomData()
      } catch (err) {
        console.error('添加测试玩家失败:', err)
        uni.showToast({
          title: '添加失败',
          icon: 'none'
        })
      }
    },

    async startGame() {
      // 更新房间状态为playing，并初始化 currentRound
      try {
        await wx.cloud.database()
          .collection('rooms')
          .doc(this.roomId)
          .update({
            data: {
              status: 'playing',
              currentRound: {
                roundNumber: 1,
                submissions: {},
                allSubmitted: false,
                isBalanced: false,
                totalScore: 0
              }
            }
          })

        // 跳转到游戏记录页面
        uni.redirectTo({
          url: `/pages/game/record?roomId=${this.roomId}&roomCode=${this.roomCode}&initialChips=${this.initialChips}`
        })
      } catch (err) {
        console.error('开始游戏失败:', err)
      }
    },

    copyRoomCode() {
      uni.setClipboardData({
        data: this.roomCode,
        success: () => {
          uni.showToast({
            title: '房间号已复制',
            icon: 'success'
          })
        }
      })
    },

    cancelRoom() {
      uni.showModal({
        title: '确认取消',
        content: '确定要取消房间吗？其他玩家将无法加入。',
        success: async (res) => {
          if (res.confirm) {
            try {
              // 删除房间
              await wx.cloud.database()
                .collection('rooms')
                .doc(this.roomId)
                .remove()

              uni.showToast({
                title: '已取消房间',
                icon: 'success'
              })

              setTimeout(() => {
                uni.navigateBack()
              }, 1000)
            } catch (err) {
              console.error('删除房间失败:', err)
              uni.showToast({
                title: '取消失败',
                icon: 'none'
              })
            }
          }
        }
      })
    }
  }
}
</script>

<style scoped>
.lobby {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 40rpx;
}

.header {
  text-align: center;
  margin-bottom: 60rpx;
  padding-top: 40rpx;
}

.room-code-display {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20rpx;
  margin-bottom: 20rpx;
}

.label {
  font-size: 28rpx;
  color: rgba(255, 255, 255, 0.8);
}

.code {
  font-size: 72rpx;
  font-weight: bold;
  color: #ffffff;
  letter-spacing: 8rpx;
}

.copy-btn {
  padding: 8rpx 24rpx;
  background: rgba(255, 255, 255, 0.2);
  color: #ffffff;
  border: 1rpx solid rgba(255, 255, 255, 0.3);
  border-radius: 20rpx;
  font-size: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.chips-info {
  display: block;
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.9);
}

.players-container {
  background: #ffffff;
  border-radius: 20rpx;
  padding: 40rpx;
  margin-bottom: 40rpx;
}

.section-title {
  display: block;
  font-size: 32rpx;
  font-weight: 600;
  color: #333;
  margin-bottom: 30rpx;
}

.players-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24rpx;
}

.player-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 30rpx 20rpx;
  background: #f8f9fa;
  border-radius: 16rpx;
  border: 2rpx solid #e9ecef;
}

.player-card.empty {
  background: #ffffff;
  border: 2rpx dashed #dee2e6;
}

.player-avatar {
  width: 100rpx;
  height: 100rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16rpx;
}

.empty-avatar {
  background: #e9ecef;
}

.avatar-text {
  font-size: 40rpx;
  font-weight: bold;
  color: #ffffff;
}

.empty-avatar .avatar-text {
  color: #adb5bd;
}

.player-name {
  font-size: 28rpx;
  color: #333;
  margin-bottom: 8rpx;
  text-align: center;
}

.player-card.empty .player-name {
  color: #adb5bd;
}

.player-status {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.status-dot {
  font-size: 16rpx;
  color: #28a745;
}

.status-text {
  font-size: 22rpx;
  color: #28a745;
}

.tips {
  text-align: center;
  padding: 30rpx;
}

.waiting-text {
  font-size: 28rpx;
  color: rgba(255, 255, 255, 0.9);
}

.ready-text {
  font-size: 32rpx;
  font-weight: 600;
  color: #ffffff;
}

.actions {
  padding: 0 40rpx;
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.start-btn {
  width: 100%;
  height: 96rpx;
  background: #ffffff;
  color: #667eea;
  border-radius: 48rpx;
  font-size: 32rpx;
  font-weight: 600;
  box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
}

.test-btn {
  width: 100%;
  height: 88rpx;
  background: rgba(255, 255, 255, 0.3);
  color: #ffffff;
  border: 2rpx solid rgba(255, 255, 255, 0.5);
  border-radius: 44rpx;
  font-size: 28rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cancel-btn {
  width: 100%;
  height: 88rpx;
  background: rgba(255, 255, 255, 0.2);
  color: #ffffff;
  border: 2rpx solid rgba(255, 255, 255, 0.3);
  border-radius: 44rpx;
  font-size: 28rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
