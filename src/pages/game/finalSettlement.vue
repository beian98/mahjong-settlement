<template>
  <view class="final-settlement">
    <!-- 头部 -->
    <view class="header">
      <text class="title">🎮 游戏结束</text>
      <text class="subtitle">最终结算</text>
    </view>

    <!-- 游戏摘要 -->
    <view class="section">
      <view class="game-summary">
        <view class="summary-item">
          <text class="summary-label">房间号</text>
          <text class="summary-value">{{ roomCode }}</text>
        </view>
        <view class="summary-item">
          <text class="summary-label">共进行</text>
          <text class="summary-value">{{ totalRounds }} 局</text>
        </view>
        <view class="summary-item">
          <text class="summary-label">初始筹码</text>
          <text class="summary-value">{{ initialChips }}</text>
        </view>
      </view>
    </view>

    <!-- 玩家排名 -->
    <view class="section">
      <text class="section-title">🏆 最终排名</text>
      <view class="ranking-list">
        <view
          v-for="(player, index) in rankedPlayers"
          :key="player.openId"
          class="rank-item"
          :class="'rank-' + (index + 1)"
        >
          <view class="rank-badge">
            <text class="rank-number">{{ index + 1 }}</text>
          </view>
          <view class="player-info">
            <text class="player-name">{{ player.nickName }}</text>
            <view class="player-stats">
              <text class="final-chips">最终筹码: {{ player.chips }}</text>
              <text
                class="profit"
                :class="{
                  positive: player.profit > 0,
                  negative: player.profit < 0,
                  zero: player.profit === 0
                }"
              >
                {{ player.profit > 0 ? '+' : '' }}{{ player.profit }}
              </text>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 最终结算方案 -->
    <view class="section" v-if="settlements.length > 0">
      <text class="section-title">💸 最终结算方案</text>
      <view class="settlements-list">
        <view
          v-for="(settlement, index) in settlements"
          :key="index"
          class="settlement-item"
        >
          <view class="settlement-content">
            <text class="from-player">{{ settlement.fromName }}</text>
            <text class="arrow">→</text>
            <text class="to-player">{{ settlement.toName }}</text>
          </view>
          <text class="amount">¥{{ settlement.amount }}</text>
        </view>
      </view>
    </view>

    <!-- 投票弹窗 -->
    <view v-if="showVoteModal" class="vote-modal">
      <view class="vote-content">
        <text class="vote-title">🎮 继续下一局投票</text>
        <text class="vote-initiator">{{ nextRoundVote.initiatorName }} 发起了投票</text>

        <view class="vote-progress">
          <view class="vote-stats">
            <view class="stat-item agree">
              <text class="stat-label">同意</text>
              <text class="stat-value">{{ voteAgreeCount }}</text>
            </view>
            <view class="stat-item disagree">
              <text class="stat-label">不同意</text>
              <text class="stat-value">{{ voteDisagreeCount }}</text>
            </view>
            <view class="stat-item pending">
              <text class="stat-label">未投票</text>
              <text class="stat-value">{{ voteNotVotedCount }}</text>
            </view>
          </view>

          <text class="vote-tip">需要2票同意才能继续</text>
          <text class="vote-countdown">剩余时间: {{ voteCountdown }}秒</text>
        </view>

        <view class="vote-actions" v-if="!hasVoted">
          <button class="vote-btn agree-btn" @click="vote(true)">
            ✅ 同意
          </button>
          <button class="vote-btn disagree-btn" @click="vote(false)">
            ❌ 不同意
          </button>
        </view>

        <view class="voted-tip" v-else>
          <text>你已投票: {{ myVote ? '✅ 同意' : '❌ 不同意' }}</text>
        </view>
      </view>
    </view>

    <!-- 操作按钮 -->
    <view class="actions">
      <button class="continue-btn" @click="initiateNextRound" :disabled="nextRoundVote?.active">
        🎮 再来一局
      </button>
      <button class="home-btn" @click="backToHome">
        返回首页
      </button>
    </view>
  </view>
</template>

<script>
import { calculateSettlement } from '@/utils/settlement.js'

export default {
  data() {
    return {
      roomId: '',
      roomCode: '',
      initialChips: 1000,
      totalRounds: 0,
      rankedPlayers: [],
      settlements: [],
      myOpenId: '',
      nextRoundVote: null,
      showVoteModal: false,
      voteCountdown: 30,
      voteTimer: null,
      roomWatcher: null,
      pollTimer: null
    }
  },

  computed: {
    voteAgreeCount() {
      if (!this.nextRoundVote?.votes) return 0
      return Object.values(this.nextRoundVote.votes).filter(v => v === true).length
    },
    voteDisagreeCount() {
      if (!this.nextRoundVote?.votes) return 0
      return Object.values(this.nextRoundVote.votes).filter(v => v === false).length
    },
    voteNotVotedCount() {
      if (!this.nextRoundVote?.votes) return 0
      return Object.values(this.nextRoundVote.votes).filter(v => v === null).length
    },
    hasVoted() {
      if (!this.nextRoundVote?.votes || !this.myOpenId) return false
      return this.nextRoundVote.votes[this.myOpenId] !== null
    },
    myVote() {
      if (!this.nextRoundVote?.votes || !this.myOpenId) return null
      return this.nextRoundVote.votes[this.myOpenId]
    }
  },

  async onLoad(options) {
    this.roomId = options.roomId
    this.roomCode = options.roomCode
    this.initialChips = parseInt(options.initialChips) || 1000

    // 游戏已结束，清除房间信息
    wx.removeStorageSync('currentRoom')

    // 获取当前用户的 openId
    try {
      const res = await wx.cloud.callFunction({ name: 'login' })
      this.myOpenId = res.result.openid
    } catch (err) {
      console.error('获取 openId 失败:', err)
    }

    // 加载最终结算数据
    await this.loadFinalResults()

    // 监听房间数据变化
    this.watchRoom()
  },

  onUnload() {
    // 清理定时器和监听器
    if (this.voteTimer) {
      clearInterval(this.voteTimer)
    }
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
    }
    if (this.roomWatcher) {
      this.roomWatcher.close()
    }
  },

  methods: {
    async loadFinalResults() {
      try {
        const db = wx.cloud.database()

        // 1. 加载房间数据
        const roomResult = await db.collection('rooms')
          .doc(this.roomId)
          .get()

        if (roomResult.data) {
          const room = roomResult.data
          this.totalRounds = room.lastRoundNumber || 0

          // 2. 计算每个玩家的盈亏并排序
          this.rankedPlayers = room.players
            .map(p => ({
              ...p,
              profit: p.chips - this.initialChips
            }))
            .sort((a, b) => b.chips - a.chips)

          // 3. 计算最终结算方案（基于盈亏）
          const finalScores = {}
          const playerMap = {}
          this.rankedPlayers.forEach(p => {
            finalScores[p.openId] = p.profit
            playerMap[p.openId] = p
          })

          this.settlements = calculateSettlement(finalScores, playerMap)

          // 4. 检查是否有进行中的投票
          if (room.nextRoundVote) {
            this.nextRoundVote = room.nextRoundVote
            if (room.nextRoundVote.active) {
              this.showVoteModal = true
              this.startVoteCountdown()
            }
          }
        }
      } catch (err) {
        console.error('加载最终结算失败:', err)
        uni.showToast({
          title: '加载失败',
          icon: 'none'
        })
      }
    },

    watchRoom() {
      const db = wx.cloud.database()

      // 启动实时监听
      this.roomWatcher = db.collection('rooms')
        .doc(this.roomId)
        .watch({
          onChange: (snapshot) => {
            console.log('📡 实时监听触发，收到房间数据更新')
            if (snapshot.docs.length > 0) {
              const room = snapshot.docs[0]
              console.log('📊 房间投票状态:', room.nextRoundVote)

              // 更新投票状态
              if (room.nextRoundVote) {
                this.nextRoundVote = room.nextRoundVote

                if (room.nextRoundVote.active) {
                  console.log('✅ 检测到活跃投票，显示投票弹窗')
                  this.showVoteModal = true
                  if (!this.voteTimer) {
                    this.startVoteCountdown()
                  }
                } else {
                  console.log('❌ 投票已结束')
                  this.showVoteModal = false
                  if (this.voteTimer) {
                    clearInterval(this.voteTimer)
                    this.voteTimer = null
                  }

                  // 如果投票通过，跳转到记录页面
                  if (room.nextRoundVote.passed && room.status === 'playing') {
                    uni.showToast({
                      title: '投票通过，开始新的一局',
                      icon: 'success',
                      duration: 1500
                    })

                    setTimeout(() => {
                      uni.redirectTo({
                        url: `/pages/game/record?roomId=${this.roomId}&roomCode=${this.roomCode}&initialChips=${this.initialChips}`
                      })
                    }, 1500)
                  }
                }
              }
            }
          },
          onError: (err) => {
            console.error('监听房间数据失败:', err)
          }
        })

      // 添加轮询作为备用机制（每2秒检查一次）
      // 因为微信云数据库的 watch 有时会有延迟
      this.pollTimer = setInterval(async () => {
        try {
          const roomResult = await db.collection('rooms').doc(this.roomId).get()
          if (roomResult.data && roomResult.data.nextRoundVote) {
            const vote = roomResult.data.nextRoundVote

            // 如果检测到新的投票或投票状态变化
            if (vote.active && (!this.nextRoundVote || !this.nextRoundVote.active)) {
              console.log('🔄 轮询检测到新投票，更新状态')
              this.nextRoundVote = vote
              this.showVoteModal = true
              if (!this.voteTimer) {
                this.startVoteCountdown()
              }
            } else if (!vote.active && this.nextRoundVote?.active) {
              console.log('🔄 轮询检测到投票结束')
              this.nextRoundVote = vote
              this.showVoteModal = false

              // 如果投票通过，跳转到记录页面
              if (vote.passed && roomResult.data.status === 'playing') {
                uni.showToast({
                  title: '投票通过，开始新的一局',
                  icon: 'success',
                  duration: 1500
                })

                setTimeout(() => {
                  uni.redirectTo({
                    url: `/pages/game/record?roomId=${this.roomId}&roomCode=${this.roomCode}&initialChips=${this.initialChips}`
                  })
                }, 1500)
              }
            }
          }
        } catch (err) {
          console.error('轮询房间数据失败:', err)
        }
      }, 2000)
    },

    startVoteCountdown() {
      if (this.voteTimer) {
        clearInterval(this.voteTimer)
      }

      const updateCountdown = () => {
        if (!this.nextRoundVote) return

        const remaining = Math.max(0, Math.ceil((this.nextRoundVote.expiresAt - Date.now()) / 1000))
        this.voteCountdown = remaining

        if (remaining <= 0) {
          clearInterval(this.voteTimer)
          this.voteTimer = null
          this.showVoteModal = false
        }
      }

      updateCountdown()
      this.voteTimer = setInterval(updateCountdown, 1000)
    },

    async initiateNextRound() {
      try {
        uni.showLoading({ title: '发起投票...' })

        const result = await wx.cloud.callFunction({
          name: 'initiateNextRoundVote',
          data: {
            roomId: this.roomId
          }
        })

        uni.hideLoading()

        if (result.result.success) {
          this.nextRoundVote = result.result.nextRoundVote
          this.showVoteModal = true
          this.startVoteCountdown()

          uni.showToast({
            title: '投票已发起',
            icon: 'success'
          })
        } else {
          uni.showToast({
            title: result.result.message || '发起失败',
            icon: 'none'
          })
        }
      } catch (err) {
        uni.hideLoading()
        console.error('发起投票失败:', err)
        uni.showToast({
          title: '发起失败，请重试',
          icon: 'none'
        })
      }
    },

    async vote(agree) {
      try {
        const result = await wx.cloud.callFunction({
          name: 'voteNextRound',
          data: {
            roomId: this.roomId,
            agree: agree
          }
        })

        if (result.result.success) {
          uni.showToast({
            title: agree ? '已投同意' : '已投不同意',
            icon: 'success'
          })
        } else {
          uni.showToast({
            title: result.result.message || '投票失败',
            icon: 'none'
          })
        }
      } catch (err) {
        console.error('投票失败:', err)
        uni.showToast({
          title: '投票失败，请重试',
          icon: 'none'
        })
      }
    },

    backToHome() {
      uni.reLaunch({
        url: '/pages/index/index'
      })
    }
  }
}
</script>

<style scoped>
.final-settlement {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: 140rpx;
}

.header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 80rpx 40rpx;
  text-align: center;
  color: #ffffff;
}

.title {
  display: block;
  font-size: 48rpx;
  font-weight: bold;
  margin-bottom: 12rpx;
}

.subtitle {
  display: block;
  font-size: 28rpx;
  opacity: 0.9;
}

.section {
  margin: 20rpx;
  background: #ffffff;
  border-radius: 16rpx;
  padding: 30rpx;
}

.game-summary {
  display: flex;
  justify-content: space-around;
  padding: 20rpx 0;
}

.summary-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
}

.summary-label {
  font-size: 24rpx;
  color: #999;
}

.summary-value {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
}

.section-title {
  display: block;
  font-size: 32rpx;
  font-weight: 600;
  color: #333;
  margin-bottom: 24rpx;
}

.ranking-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.rank-item {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 24rpx;
  background: #f8f9fa;
  border-radius: 12rpx;
  border-left: 4rpx solid #e9ecef;
}

.rank-item.rank-1 {
  background: linear-gradient(135deg, #fff9e6 0%, #ffe6cc 100%);
  border-left-color: #ffd700;
}

.rank-item.rank-2 {
  background: linear-gradient(135deg, #f5f5f5 0%, #e8e8e8 100%);
  border-left-color: #c0c0c0;
}

.rank-item.rank-3 {
  background: linear-gradient(135deg, #fff0e6 0%, #ffe0cc 100%);
  border-left-color: #cd7f32;
}

.rank-badge {
  width: 60rpx;
  height: 60rpx;
  border-radius: 50%;
  background: #667eea;
  display: flex;
  align-items: center;
  justify-content: center;
}

.rank-1 .rank-badge {
  background: #ffd700;
}

.rank-2 .rank-badge {
  background: #c0c0c0;
}

.rank-3 .rank-badge {
  background: #cd7f32;
}

.rank-number {
  font-size: 32rpx;
  font-weight: bold;
  color: #ffffff;
}

.player-info {
  flex: 1;
}

.player-name {
  display: block;
  font-size: 32rpx;
  font-weight: 600;
  color: #333;
  margin-bottom: 8rpx;
}

.player-stats {
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.final-chips {
  font-size: 26rpx;
  color: #666;
}

.profit {
  font-size: 28rpx;
  font-weight: bold;
}

.profit.positive {
  color: #4caf50;
}

.profit.negative {
  color: #f44336;
}

.profit.zero {
  color: #999;
}

.settlements-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.settlement-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24rpx;
  background: #f0f7ff;
  border-radius: 12rpx;
  border-left: 4rpx solid #667eea;
}

.settlement-content {
  display: flex;
  align-items: center;
  gap: 12rpx;
  flex: 1;
}

.from-player {
  font-size: 28rpx;
  color: #333;
  font-weight: 500;
}

.arrow {
  font-size: 32rpx;
  color: #667eea;
}

.to-player {
  font-size: 28rpx;
  color: #333;
  font-weight: 500;
}

.amount {
  font-size: 36rpx;
  font-weight: bold;
  color: #667eea;
}

.actions {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 20rpx;
  background: #ffffff;
  box-shadow: 0 -4rpx 12rpx rgba(0, 0, 0, 0.08);
  display: flex;
  gap: 20rpx;
}

.continue-btn,
.home-btn {
  flex: 1;
  height: 88rpx;
  border-radius: 44rpx;
  font-size: 28rpx;
  font-weight: 600;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
}

.continue-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #ffffff;
  box-shadow: 0 4rpx 12rpx rgba(102, 126, 234, 0.3);
}

.continue-btn:active {
  transform: scale(0.98);
  box-shadow: 0 2rpx 8rpx rgba(102, 126, 234, 0.25);
}

.continue-btn:disabled {
  opacity: 0.5;
  transform: none;
}

.home-btn {
  background: #ffffff;
  color: #667eea;
  border: 2rpx solid #667eea;
}

.home-btn:active {
  background: #f5f5f5;
}

/* 投票弹窗样式 */
.vote-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.vote-content {
  width: 600rpx;
  background: #ffffff;
  border-radius: 24rpx;
  padding: 40rpx;
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.vote-title {
  font-size: 36rpx;
  font-weight: bold;
  color: #333;
  text-align: center;
}

.vote-initiator {
  font-size: 28rpx;
  color: #666;
  text-align: center;
}

.vote-progress {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.vote-stats {
  display: flex;
  justify-content: space-around;
  padding: 20rpx 0;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
}

.stat-label {
  font-size: 24rpx;
  color: #999;
}

.stat-value {
  font-size: 40rpx;
  font-weight: bold;
}

.stat-item.agree .stat-value {
  color: #4caf50;
}

.stat-item.disagree .stat-value {
  color: #f44336;
}

.stat-item.pending .stat-value {
  color: #ff9800;
}

.vote-tip {
  font-size: 24rpx;
  color: #999;
  text-align: center;
}

.vote-countdown {
  font-size: 28rpx;
  color: #667eea;
  text-align: center;
  font-weight: 600;
}

.vote-actions {
  display: flex;
  gap: 20rpx;
  margin-top: 12rpx;
}

.vote-btn {
  flex: 1;
  height: 80rpx;
  border-radius: 40rpx;
  font-size: 28rpx;
  font-weight: 600;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
}

.agree-btn {
  background: #4caf50;
  color: #ffffff;
}

.agree-btn:active {
  background: #45a049;
}

.disagree-btn {
  background: #f44336;
  color: #ffffff;
}

.disagree-btn:active {
  background: #da190b;
}

.voted-tip {
  text-align: center;
  padding: 20rpx;
  background: #f5f5f5;
  border-radius: 12rpx;
  font-size: 28rpx;
  color: #666;
}
</style>
