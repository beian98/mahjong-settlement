<template>
  <view class="container">
    <view class="header">
      <text class="title">🀄️ 你胡十三幺了吗</text>
      <text class="subtitle">快速组局 · 智能结算 · 轻松记账</text>
    </view>

    <view class="actions">
      <button class="action-btn primary" @click="createRoom">
        <view class="btn-content">
          <text class="btn-icon">➕</text>
          <view class="btn-text-group">
            <text class="btn-text">创建房间</text>
            <text class="btn-hint">发起新游戏</text>
          </view>
        </view>
        <text class="btn-arrow">›</text>
      </button>

      <button class="action-btn secondary" @click="joinRoom">
        <view class="btn-content">
          <text class="btn-icon">🚪</text>
          <view class="btn-text-group">
            <text class="btn-text">加入房间</text>
            <text class="btn-hint">输入房间号</text>
          </view>
        </view>
        <text class="btn-arrow">›</text>
      </button>
    </view>

    <view class="rules-card">
      <view class="rules-header">
        <text class="rules-icon">📋</text>
        <text class="rules-title">游戏规则</text>
      </view>
      <view class="rules-list">
        <view class="rule-item">
          <text class="rule-dot">•</text>
          <text class="rule-text">4人游戏，通过房间号组局</text>
        </view>
        <view class="rule-item">
          <text class="rule-dot">•</text>
          <text class="rule-text">每人初始筹码可自定义（100-500）</text>
        </view>
        <view class="rule-item">
          <text class="rule-dot">•</text>
          <text class="rule-text">每局输赢直接增减筹码</text>
        </view>
        <view class="rule-item">
          <text class="rule-dot">•</text>
          <text class="rule-text">智能结算，自动计算最优转账方案</text>
        </view>
        <view class="rule-item">
          <text class="rule-dot">•</text>
          <text class="rule-text">任意玩家筹码≤0时游戏结束</text>
        </view>
      </view>
    </view>

    <view class="recent-games" v-if="recentGames.length > 0">
      <view class="section-title">最近游戏</view>
      <view class="game-list">
        <view
          class="game-item"
          v-for="game in recentGames"
          :key="game.id"
          @click="viewGameDetail(game.id)"
        >
          <view class="game-info">
            <text class="game-date">{{ formatDate(game.date) }}</text>
            <text class="game-players">{{ game.players.length }}人</text>
          </view>
          <text class="arrow">›</text>
        </view>
      </view>
    </view>

    <view class="footer">
      <text class="footer-text">🎲 祝你好运连连</text>
    </view>
  </view>
</template>

<script>
export default {
  data() {
    return {
      recentGames: []
    };
  },

  onShow() {
    this.loadRecentGames();
    this.checkCurrentRoom();
  },

  methods: {
    checkCurrentRoom() {
      const currentRoom = wx.getStorageSync('currentRoom')
      if (currentRoom && currentRoom.roomId) {
        uni.showModal({
          title: '恢复游戏',
          content: `检测到房间 ${currentRoom.roomCode} 正在进行中，是否继续？`,
          confirmText: '继续游戏',
          cancelText: '取消',
          success: (res) => {
            if (res.confirm) {
              // 跳转到记录页面
              uni.reLaunch({
                url: `/pages/game/record?roomId=${currentRoom.roomId}&roomCode=${currentRoom.roomCode}`
              })
            } else {
              // 用户选择不继续，清除房间信息
              wx.removeStorageSync('currentRoom')
            }
          }
        })
      }
    },

    createRoom() {
      // 检查是否有进行中的对局
      const currentRoom = wx.getStorageSync('currentRoom')
      if (currentRoom && currentRoom.roomId) {
        uni.showModal({
          title: '提示',
          content: `检测到房间 ${currentRoom.roomCode} 正在进行中，创建新房间将放弃当前对局，是否继续？`,
          confirmText: '继续创建',
          cancelText: '取消',
          success: (res) => {
            if (res.confirm) {
              // 清除旧的房间信息
              wx.removeStorageSync('currentRoom')
              uni.navigateTo({
                url: '/pages/room/create'
              })
            }
          }
        })
      } else {
        uni.navigateTo({
          url: '/pages/room/create'
        })
      }
    },

    async joinRoom() {
      try {
        console.log('📞 开始调用 checkOngoingGame 云函数')

        // 调用云函数检查是否有未结束的对局（设置超时时间）
        const result = await Promise.race([
          wx.cloud.callFunction({
            name: 'checkOngoingGame',
            data: {}
          }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('检查超时')), 3000)
          )
        ])

        console.log('📦 云函数返回结果:', result)

        // 检查云函数是否成功执行且有进行中的对局
        if (result.result && result.result.hasOngoingGame && result.result.room) {
          // 有未结束的对局，询问是否恢复
          const room = result.result.room
          console.log('✅ 检测到未结束的对局，显示弹窗')

          uni.showModal({
            title: '恢复游戏',
            content: `检测到房间 ${room.roomCode} 正在进行中，是否继续游戏？`,
            showCancel: true,
            confirmText: '继续游戏',
            cancelText: '加入新房',
            success: (res) => {
              if (res.confirm) {
                // 继续当前游戏
                uni.navigateTo({
                  url: `/pages/game/record?roomId=${room._id}&roomCode=${room.roomCode}&initialChips=${room.initialChips}`
                })
              } else if (res.cancel) {
                // 加入其他房间
                uni.navigateTo({
                  url: '/pages/room/join'
                })
              }
            },
            fail: (err) => {
              console.error('弹窗失败:', err)
              // 失败时直接跳转到加入房间页面
              uni.navigateTo({
                url: '/pages/room/join'
              })
            }
          })
        } else {
          // 没有进行中的对局或查询失败，直接跳转到加入房间页面
          console.log('✅ 没有未结束的对局，跳转到加入房间页面')
          uni.navigateTo({
            url: '/pages/room/join'
          })
        }
      } catch (err) {
        // 检查失败不影响正常流程，直接跳转到加入房间页面
        console.warn('⚠️ 检查未结束对局失败，跳过检查:', err)
        uni.navigateTo({
          url: '/pages/room/join'
        })
      }
    },

    loadRecentGames() {
      // TODO: 从云数据库加载最近的游戏
      this.recentGames = [];
    },

    viewGameDetail(gameId) {
      uni.navigateTo({
        url: `/pages/history/detail?id=${gameId}`
      });
    },

    formatDate(timestamp) {
      const date = new Date(timestamp);
      return `${date.getMonth() + 1}月${date.getDate()}日 ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
    }
  }
};
</script>

<style scoped>
.container {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 40rpx;
  display: flex;
  flex-direction: column;
}

.header {
  text-align: center;
  margin-bottom: 100rpx;
  padding-top: 80rpx;
}

.title {
  display: block;
  font-size: 60rpx;
  font-weight: bold;
  color: #ffffff;
  margin-bottom: 24rpx;
  text-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.15);
}

.subtitle {
  display: block;
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.9);
  letter-spacing: 2rpx;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 32rpx;
  margin-bottom: 60rpx;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: auto;
  min-height: 160rpx;
  border-radius: 32rpx;
  border: none;
  padding: 32rpx 40rpx;
  transition: all 0.3s ease;
}

.action-btn.primary {
  background: #ffffff;
  color: #667eea;
  box-shadow: 0 16rpx 48rpx rgba(102, 126, 234, 0.25);
}

.action-btn.secondary {
  background: rgba(255, 255, 255, 0.2);
  color: #ffffff;
  border: none;
  backdrop-filter: blur(20rpx);
  box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.1);
}

.btn-content {
  display: flex;
  align-items: center;
  gap: 28rpx;
  flex: 1;
}

.btn-icon {
  font-size: 56rpx;
  line-height: 1;
}

.btn-text-group {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8rpx;
}

.btn-text {
  font-size: 36rpx;
  font-weight: 600;
  line-height: 1.2;
}

.btn-hint {
  font-size: 24rpx;
  opacity: 0.65;
  line-height: 1.2;
}

.btn-arrow {
  font-size: 56rpx;
  opacity: 0.4;
  line-height: 1;
  margin-left: 32rpx;
  flex-shrink: 0;
}

.rules-card {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 32rpx;
  padding: 40rpx;
  margin-bottom: 60rpx;
  box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.1);
}

.rules-header {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 32rpx;
}

.rules-icon {
  font-size: 40rpx;
  line-height: 1;
}

.rules-title {
  font-size: 36rpx;
  font-weight: 600;
  color: #333;
}

.rules-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.rule-item {
  display: flex;
  align-items: flex-start;
  gap: 16rpx;
}

.rule-dot {
  font-size: 32rpx;
  color: #667eea;
  line-height: 1.5;
  font-weight: bold;
}

.rule-text {
  flex: 1;
  font-size: 28rpx;
  color: #666;
  line-height: 1.6;
}

.recent-games {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 24rpx;
  padding: 32rpx;
  box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.1);
}

.section-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #333;
  margin-bottom: 24rpx;
}

.game-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.game-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 28rpx 24rpx;
  background: #f8f9fa;
  border-radius: 16rpx;
  transition: all 0.3s ease;
}

.game-info {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.game-date {
  font-size: 28rpx;
  color: #333;
  font-weight: 500;
}

.game-players {
  font-size: 24rpx;
  color: #999;
}

.arrow {
  font-size: 48rpx;
  color: #ccc;
}

.footer {
  flex: 1;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 60rpx 0 40rpx;
}

.footer-text {
  font-size: 28rpx;
  color: rgba(255, 255, 255, 0.8);
  text-align: center;
}
</style>
