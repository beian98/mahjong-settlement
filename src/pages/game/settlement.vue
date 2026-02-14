<template>
  <view class="settlement">
    <!-- 头部 -->
    <view class="header">
      <text class="title">第 {{ roundNumber }} 局结算</text>
      <text class="room-code">房间号: {{ roomCode }}</text>
    </view>

    <!-- 玩家分数卡片 -->
    <view class="section">
      <text class="section-title">本局分数</text>
      <view class="players-scores">
        <view
          v-for="player in players"
          :key="player.openId"
          class="player-score-card"
        >
          <view class="player-name">{{ player.nickName }}</view>
          <view class="score-info">
            <text
              class="score"
              :class="{
                positive: player.score > 0,
                negative: player.score < 0,
                zero: player.score === 0
              }"
            >
              {{ player.score > 0 ? '+' : '' }}{{ player.score }}
            </text>
          </view>
          <view class="chips-change">
            <text class="chips-before">{{ player.chipsBeforeRound }}</text>
            <text class="arrow">→</text>
            <text class="chips-after">{{ player.chipsAfterRound }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 结算方案 -->
    <view class="section" v-if="settlements.length > 0">
      <text class="section-title">💸 结算方案</text>
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

    <!-- 无需结算提示 -->
    <view class="section" v-else>
      <view class="no-settlement">
        <text class="no-settlement-text">本局无需转账</text>
      </view>
    </view>

    <!-- 投票界面 -->
    <view v-if="nextRoundVote && nextRoundVote.active" class="vote-panel">
      <view class="vote-header">
        <text class="vote-icon">🗳️</text>
        <text class="vote-title">{{ nextRoundVote.initiatorName }} 提议再来一局</text>
      </view>

      <view class="vote-timer">
        <text class="timer-text">剩余时间: {{ voteCountdown }}秒</text>
      </view>

      <view class="vote-stats">
        <view class="stat-item agree">
          <text class="stat-label">✓ 同意</text>
          <text class="stat-count">{{ voteAgreeCount }}</text>
        </view>
        <view class="stat-item disagree">
          <text class="stat-label">✗ 不同意</text>
          <text class="stat-count">{{ voteDisagreeCount }}</text>
        </view>
        <view class="stat-item pending">
          <text class="stat-label">⏳ 未投票</text>
          <text class="stat-count">{{ voteNotVotedCount }}</text>
        </view>
      </view>

      <view class="vote-players">
        <view
          v-for="player in players"
          :key="player.openId"
          class="vote-player-item"
        >
          <text class="vote-player-name">{{ player.nickName }}</text>
          <text
            class="vote-player-status"
            :class="{
              agreed: nextRoundVote && nextRoundVote.votes && nextRoundVote.votes[player.openId] === true,
              disagreed: nextRoundVote && nextRoundVote.votes && nextRoundVote.votes[player.openId] === false,
              pending: !nextRoundVote || !nextRoundVote.votes || nextRoundVote.votes[player.openId] === null
            }"
          >
            {{
              nextRoundVote && nextRoundVote.votes && nextRoundVote.votes[player.openId] === true ? '✓ 同意' :
              nextRoundVote && nextRoundVote.votes && nextRoundVote.votes[player.openId] === false ? '✗ 不同意' :
              '⏳ 未投票'
            }}
          </text>
        </view>
      </view>

      <view v-if="nextRoundVote && nextRoundVote.votes && nextRoundVote.votes[myOpenId] === null" class="vote-actions">
        <button class="vote-btn agree-btn" @click="voteNextRound(true)">
          ✓ 同意
        </button>
        <button class="vote-btn disagree-btn" @click="voteNextRound(false)">
          ✗ 不同意
        </button>
      </view>
      <view v-else-if="nextRoundVote && nextRoundVote.votes" class="vote-result">
        <text class="vote-result-text">
          你已投票: {{ nextRoundVote.votes[myOpenId] ? '✓ 同意' : '✗ 不同意' }}
        </text>
      </view>
    </view>

    <!-- 操作按钮 -->
    <view class="actions" v-if="!nextRoundVote || !nextRoundVote.active">
      <button class="join-room-btn" @click="joinRoom">
        加入房间
      </button>
      <button class="continue-btn" @click="initiateNextRoundVote">
        继续下一局
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
      roundNumber: 1,
      initialChips: 1000,
      players: [],
      settlements: [],
      myOpenId: '',
      nextRoundVote: null,
      voteCountdown: 0,
      voteTimer: null,
      pollTimer: null
    }
  },

  computed: {
    // 投票统计
    voteAgreeCount() {
      if (!this.nextRoundVote || !this.nextRoundVote.votes) return 0
      return Object.values(this.nextRoundVote.votes).filter(v => v === true).length
    },

    voteDisagreeCount() {
      if (!this.nextRoundVote || !this.nextRoundVote.votes) return 0
      return Object.values(this.nextRoundVote.votes).filter(v => v === false).length
    },

    voteNotVotedCount() {
      if (!this.nextRoundVote || !this.nextRoundVote.votes) return 0
      return Object.values(this.nextRoundVote.votes).filter(v => v === null).length
    }
  },

  async onLoad(options) {
    console.log('📄 结算页面加载，参数:', options)
    this.roomId = options.roomId
    this.roomCode = options.roomCode
    this.roundNumber = parseInt(options.roundNumber) || 1
    this.initialChips = parseInt(options.initialChips) || 1000

    console.log('📄 页面数据:', {
      roomId: this.roomId,
      roomCode: this.roomCode,
      roundNumber: this.roundNumber,
      initialChips: this.initialChips
    })

    // 获取当前用户的 openId
    try {
      const res = await wx.cloud.callFunction({ name: 'login' })
      this.myOpenId = res.result.openid
      console.log('👤 当前用户 openId:', this.myOpenId)
    } catch (err) {
      console.error('获取 openId 失败:', err)
    }

    // 加载本局数据
    await this.loadRoundData()

    // 开始轮询房间状态
    this.startPolling()
  },

  onUnload() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
    }
    if (this.voteTimer) {
      clearInterval(this.voteTimer)
    }
  },

  methods: {
    async loadRoundData() {
      try {
        const db = wx.cloud.database()

        // 查询本局游戏记录
        const result = await db.collection('games')
          .where({
            roomId: this.roomId,
            roundNumber: this.roundNumber
          })
          .orderBy('date', 'desc')
          .limit(1)
          .get()

        if (result.data.length > 0) {
          const game = result.data[0]
          this.players = game.players

          // 计算结算方案
          const scores = game.scores
          const playerMap = {}
          this.players.forEach(p => {
            playerMap[p.openId] = p
          })

          this.settlements = calculateSettlement(scores, playerMap)
        }
      } catch (err) {
        console.error('加载数据失败:', err)
        uni.showToast({
          title: '加载失败',
          icon: 'none'
        })
      }
    },

    joinRoom() {
      // 跳转到加入房间页面，并传递房间号
      uni.navigateTo({
        url: `/pages/room/join?roomCode=${this.roomCode}`
      })
    },

    async initiateNextRoundVote() {
      try {
        console.log('🗳️ 开始发起投票，roomId:', this.roomId)
        uni.showLoading({ title: '发起投票中...' })

        const result = await wx.cloud.callFunction({
          name: 'initiateNextRoundVote',
          data: {
            roomId: this.roomId
          }
        })

        console.log('🗳️ 云函数返回结果:', result)
        uni.hideLoading()

        if (result.result.success) {
          console.log('✅ 投票发起成功:', result.result.nextRoundVote)
          this.nextRoundVote = result.result.nextRoundVote
          this.startVoteTimer()
          uni.showToast({
            title: '投票已发起',
            icon: 'success'
          })
        } else {
          console.error('❌ 投票发起失败:', result.result.message)
          uni.showToast({
            title: result.result.message,
            icon: 'none',
            duration: 3000
          })
        }
      } catch (err) {
        uni.hideLoading()
        console.error('❌ 发起投票异常:', err)
        uni.showToast({
          title: '发起投票失败: ' + (err.message || '未知错误'),
          icon: 'none',
          duration: 3000
        })
      }
    },

    async voteNextRound(agree) {
      try {
        uni.showLoading({ title: '投票中...' })

        const result = await wx.cloud.callFunction({
          name: 'voteNextRound',
          data: {
            roomId: this.roomId,
            agree: agree
          }
        })

        uni.hideLoading()

        if (result.result.success) {
          if (result.result.voteEnded) {
            if (result.result.passed) {
              uni.showToast({
                title: '投票通过，开始新的一局',
                icon: 'success',
                duration: 2000
              })

              // 跳转到游戏记录页面
              setTimeout(() => {
                uni.redirectTo({
                  url: `/pages/game/record?roomId=${this.roomId}&roomCode=${this.roomCode}&initialChips=${this.initialChips}`
                })
              }, 2000)
            } else {
              uni.showToast({
                title: '投票未通过',
                icon: 'none'
              })
              this.nextRoundVote.active = false
            }
          } else {
            uni.showToast({
              title: '投票已记录',
              icon: 'success'
            })
          }
        } else {
          uni.showToast({
            title: result.result.message,
            icon: 'none'
          })
        }
      } catch (err) {
        uni.hideLoading()
        console.error('投票失败:', err)
        uni.showToast({
          title: '投票失败',
          icon: 'none'
        })
      }
    },

    startPolling() {
      // 每2秒轮询一次房间状态
      this.pollTimer = setInterval(async () => {
        await this.loadRoomStatus()
      }, 2000)
    },

    async loadRoomStatus() {
      try {
        const db = wx.cloud.database()
        const roomResult = await db.collection('rooms')
          .doc(this.roomId)
          .get()

        if (roomResult.data) {
          const room = roomResult.data
          console.log('🔄 轮询房间状态:', {
            status: room.status,
            hasNextRoundVote: !!room.nextRoundVote,
            voteActive: room.nextRoundVote?.active
          })

          this.nextRoundVote = room.nextRoundVote || null

          // 如果有进行中的投票，启动倒计时
          if (this.nextRoundVote && this.nextRoundVote.active) {
            console.log('✅ 检测到进行中的投票')
            this.updateVoteCountdown()
            if (!this.voteTimer) {
              this.startVoteTimer()
            }
          } else {
            if (this.voteTimer) {
              clearInterval(this.voteTimer)
              this.voteTimer = null
            }
          }

          // 如果投票通过，跳转到游戏页面
          if (this.nextRoundVote && !this.nextRoundVote.active && this.nextRoundVote.passed) {
            console.log('✅ 投票通过，跳转到游戏页面')
            uni.redirectTo({
              url: `/pages/game/record?roomId=${this.roomId}&roomCode=${this.roomCode}&initialChips=${this.initialChips}`
            })
          }
        }
      } catch (err) {
        console.error('加载房间状态失败:', err)
      }
    },

    startVoteTimer() {
      this.updateVoteCountdown()
      this.voteTimer = setInterval(() => {
        this.updateVoteCountdown()
        if (this.voteCountdown <= 0) {
          this.checkVoteTimeout()
        }
      }, 1000)
    },

    updateVoteCountdown() {
      if (!this.nextRoundVote || !this.nextRoundVote.active) {
        this.voteCountdown = 0
        return
      }

      const now = Date.now()
      const expiresAt = this.nextRoundVote.expiresAt
      const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000))
      this.voteCountdown = remaining
    },

    async checkVoteTimeout() {
      if (!this.nextRoundVote || !this.nextRoundVote.active) return

      try {
        const result = await wx.cloud.callFunction({
          name: 'checkNextRoundVoteTimeout',
          data: {
            roomId: this.roomId
          }
        })

        if (result.result.timeout) {
          uni.showToast({
            title: '投票已超时',
            icon: 'none'
          })
          this.nextRoundVote.active = false
          if (this.voteTimer) {
            clearInterval(this.voteTimer)
            this.voteTimer = null
          }
        }
      } catch (err) {
        console.error('检查投票超时失败:', err)
      }
    },

    continueNextRound() {
      // 返回到游戏记录页面，开始下一局
      uni.redirectTo({
        url: `/pages/game/record?roomId=${this.roomId}&roomCode=${this.roomCode}&initialChips=${this.initialChips}`
      })
    }
  }
}
</script>

<style scoped>
.settlement {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: 120rpx;
}

.header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 60rpx 40rpx;
  text-align: center;
  color: #ffffff;
}

.title {
  display: block;
  font-size: 40rpx;
  font-weight: bold;
  margin-bottom: 12rpx;
}

.room-code {
  display: block;
  font-size: 26rpx;
  opacity: 0.9;
}

.section {
  margin: 20rpx;
  background: #ffffff;
  border-radius: 16rpx;
  padding: 30rpx;
}

.section-title {
  display: block;
  font-size: 32rpx;
  font-weight: 600;
  color: #333;
  margin-bottom: 24rpx;
}

.players-scores {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20rpx;
}

.player-score-card {
  background: #f8f9fa;
  border-radius: 12rpx;
  padding: 24rpx;
  text-align: center;
}

.player-name {
  font-size: 28rpx;
  color: #333;
  font-weight: 500;
  margin-bottom: 12rpx;
}

.score-info {
  margin-bottom: 12rpx;
}

.score {
  font-size: 48rpx;
  font-weight: bold;
}

.score.positive {
  color: #4caf50;
}

.score.negative {
  color: #f44336;
}

.score.zero {
  color: #999;
}

.chips-change {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  font-size: 24rpx;
  color: #666;
}

.chips-before {
  color: #999;
}

.arrow {
  color: #999;
}

.chips-after {
  color: #333;
  font-weight: 500;
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

.settlement-content .arrow {
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

.no-settlement {
  text-align: center;
  padding: 60rpx 0;
}

.no-settlement-text {
  font-size: 28rpx;
  color: #999;
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

.join-room-btn {
  flex: 1;
  height: 96rpx;
  background: #ffffff;
  color: #667eea;
  border: 2rpx solid #667eea;
  border-radius: 48rpx;
  font-size: 32rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}

.continue-btn {
  flex: 1;
  height: 96rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #ffffff;
  border-radius: 48rpx;
  font-size: 32rpx;
  font-weight: 600;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 投票界面样式 */
.vote-panel {
  margin: 20rpx;
  background: #ffffff;
  border-radius: 16rpx;
  padding: 30rpx;
  box-shadow: 0 4rpx 12rpx rgba(102, 126, 234, 0.15);
}

.vote-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  margin-bottom: 24rpx;
}

.vote-icon {
  font-size: 40rpx;
}

.vote-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #333;
}

.vote-timer {
  text-align: center;
  margin-bottom: 24rpx;
}

.timer-text {
  font-size: 28rpx;
  color: #ff9800;
  font-weight: 500;
}

.vote-stats {
  display: flex;
  justify-content: space-around;
  margin-bottom: 24rpx;
  padding: 20rpx;
  background: #f8f9fa;
  border-radius: 12rpx;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
}

.stat-label {
  font-size: 24rpx;
  color: #666;
}

.stat-count {
  font-size: 36rpx;
  font-weight: bold;
}

.stat-item.agree .stat-count {
  color: #4caf50;
}

.stat-item.disagree .stat-count {
  color: #f44336;
}

.stat-item.pending .stat-count {
  color: #ff9800;
}

.vote-players {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  margin-bottom: 24rpx;
}

.vote-player-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16rpx 20rpx;
  background: #f8f9fa;
  border-radius: 8rpx;
}

.vote-player-name {
  font-size: 28rpx;
  color: #333;
  font-weight: 500;
}

.vote-player-status {
  font-size: 24rpx;
  padding: 8rpx 16rpx;
  border-radius: 20rpx;
  font-weight: 500;
}

.vote-player-status.agreed {
  background: #e8f5e9;
  color: #4caf50;
}

.vote-player-status.disagreed {
  background: #ffebee;
  color: #f44336;
}

.vote-player-status.pending {
  background: #fff3e0;
  color: #ff9800;
}

.vote-actions {
  display: flex;
  gap: 20rpx;
}

.vote-btn {
  flex: 1;
  height: 88rpx;
  border-radius: 44rpx;
  font-size: 32rpx;
  font-weight: 600;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
}

.agree-btn {
  background: linear-gradient(135deg, #4caf50 0%, #45a049 100%);
  color: #ffffff;
}

.disagree-btn {
  background: linear-gradient(135deg, #f44336 0%, #e53935 100%);
  color: #ffffff;
}

.vote-result {
  text-align: center;
  padding: 20rpx;
  background: #f0f7ff;
  border-radius: 12rpx;
}

.vote-result-text {
  font-size: 28rpx;
  color: #667eea;
  font-weight: 500;
}
</style>
