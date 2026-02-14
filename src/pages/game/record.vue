<template>
  <view class="game-record">
    <!-- 调试信息 - 实机测试用 -->
    <view class="debug-info" v-if="true">
      <text class="debug-text">mySubmitted: {{ mySubmitted }}</text>
      <text class="debug-text">submissions数量: {{ Object.keys(submissions).length }}</text>
      <text class="debug-text">我的openId: {{ myOpenId ? myOpenId.substring(0, 8) : 'null' }}</text>
      <text class="debug-text">数据库有我: {{ submissions[myOpenId] ? '是' : '否' }}</text>
    </view>

    <!-- 游戏信息头部 -->
    <view class="game-header">
      <view class="round-info">
        <text class="round-number">第 {{ roundNumber }} 局</text>
        <!-- 提议结束游戏按钮（精巧版） -->
        <button
          v-if="!endGameVote || !endGameVote.active"
          class="end-game-btn-compact"
          @click="initiateEndGameVote"
        >
          📢 提议结束
        </button>
        <text class="room-code">房间号: {{ roomCode }}</text>
      </view>
    </view>

    <!-- 最后一个人的提示信息 -->
    <view v-if="isLastPlayer" class="last-player-hint">
      <view class="hint-header">
        <text class="hint-icon">💡</text>
        <text class="hint-title">你是最后一个提交的人</text>
      </view>
      <view class="hint-content">
        <text class="hint-label">其他玩家总分:</text>
        <text class="hint-value" :class="{ positive: othersTotal > 0, negative: othersTotal < 0 }">
          {{ othersTotal > 0 ? '+' : '' }}{{ othersTotal }}
        </text>
      </view>
      <view class="hint-content">
        <text class="hint-label">你需要填写:</text>
        <text class="hint-value balance-needed" :class="{ positive: neededScore > 0, negative: neededScore < 0 }">
          {{ neededScore > 0 ? '+' : '' }}{{ neededScore }}
        </text>
        <text class="hint-tip">（才能平衡）</text>
      </view>
    </view>

    <!-- 筹码破产警告 -->
    <view v-if="hasPlayerBankrupt" class="warning-box">
      <text class="warning-icon">⚠️</text>
      <text class="warning-text">有玩家筹码将为0或负数，本局结束后游戏将结束！</text>
    </view>

    <!-- 玩家分数输入列表 -->
    <view class="players-list">
      <view
        v-for="player in players"
        :key="player.openId"
        class="player-item"
        :class="{ 'is-me': player.openId === myOpenId }"
      >
        <view class="player-header">
          <view class="player-info">
            <text class="player-name">
              {{ player.nickName }}
              <text v-if="player.openId === myOpenId" class="me-tag">(我)</text>
            </text>
            <view class="chips-row">
              <text
                class="current-chips"
                :class="{ warning: player.chips <= 200 }"
              >
                当前筹码: {{ player.chips }}
              </text>
              <!-- 提交按钮（只对当前玩家显示） -->
              <button
                v-if="player.openId === myOpenId && !mySubmitted"
                class="submit-btn-compact"
                @click="submitMyScore"
                :disabled="!canSubmit"
              >
                提交我的筹码
              </button>
            </view>
          </view>
          <view v-if="submissions[player.openId]?.submitted" class="submit-status">
            <text class="status-icon">✓</text>
            <text class="status-text">已提交</text>
          </view>
        </view>

        <!-- 只有自己可��输入 -->
        <view v-if="player.openId === myOpenId" class="score-input-row">
          <!-- 输赢切换按钮 -->
          <view
            class="win-lose-toggle"
            :class="{ win: isWin, lose: !isWin }"
            @click="toggleWinLose"
          >
            <text class="toggle-text">{{ isWin ? '赢' : '输' }}</text>
          </view>

          <input
            class="score-input"
            type="number"
            v-model.number="myScore"
            @input="onScoreInput"
            placeholder="输入筹码数量"
            :disabled="mySubmitted"
          />
          <view class="chips-preview">
            <text class="arrow">→</text>
            <text
              class="after-chips"
              :class="{
                positive: actualScore > 0,
                negative: actualScore < 0,
                zero: actualScore === 0,
                bankrupt: (player.chips + actualScore) <= 0
              }"
            >
              {{ player.chips + actualScore }}
            </text>
          </view>
        </view>

        <!-- 其他玩家显示已提交的分数 -->
        <view v-else class="score-display-row">
          <view v-if="submissions[player.openId]?.submitted" class="score-display">
            <text class="score-label">分数:</text>
            <text
              class="score-value"
              :class="{
                positive: submissions[player.openId].score > 0,
                negative: submissions[player.openId].score < 0
              }"
            >
              {{ submissions[player.openId].score > 0 ? '+' : '' }}{{ submissions[player.openId].score }}
            </text>
          </view>
          <view v-else class="waiting-submit">
            <text class="waiting-text">等待提交...</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 总分验证（只在所有人都提交后显示） -->
    <view v-if="allSubmitted" class="balance-check" :class="{ error: !isBalanced, success: isBalanced }">
      <view class="balance-info">
        <text class="balance-label">总分:</text>
        <text class="balance-value" :class="{ error: !isBalanced }">
          {{ totalScore.toFixed(0) }}
        </text>
      </view>
      <view class="balance-status">
        <text v-if="!isBalanced" class="error-msg">
          ⚠️ 筹码不平衡！总和必须为0
        </text>
        <text v-else class="success-msg">
          ✓ 筹码平衡，自动结算中...
        </text>
      </view>
    </view>

    <!-- 投票界面 -->
    <view v-if="endGameVote && endGameVote.active" class="vote-panel">
      <view class="vote-header">
        <text class="vote-icon">🗳️</text>
        <text class="vote-title">{{ endGameVote.initiatorName }} 提议结束游戏</text>
      </view>

      <view class="vote-timer">
        <text class="timer-label">剩余时间:</text>
        <text class="timer-value">{{ voteCountdown }}秒</text>
      </view>

      <view class="vote-stats">
        <view class="stat-item agree">
          <text class="stat-icon">✓</text>
          <text class="stat-text">同意: {{ voteAgreeCount }}</text>
        </view>
        <view class="stat-item disagree">
          <text class="stat-icon">✗</text>
          <text class="stat-text">不同意: {{ voteDisagreeCount }}</text>
        </view>
        <view class="stat-item pending">
          <text class="stat-icon">⏳</text>
          <text class="stat-text">未投票: {{ voteNotVotedCount }}</text>
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
              agreed: endGameVote && endGameVote.votes && endGameVote.votes[player.openId] === true,
              disagreed: endGameVote && endGameVote.votes && endGameVote.votes[player.openId] === false,
              pending: !endGameVote || !endGameVote.votes || endGameVote.votes[player.openId] === null
            }"
          >
            {{
              endGameVote && endGameVote.votes && endGameVote.votes[player.openId] === true ? '✓ 同意' :
              endGameVote && endGameVote.votes && endGameVote.votes[player.openId] === false ? '✗ 不同意' :
              '⏳ 未投票'
            }}
          </text>
        </view>
      </view>

      <view v-if="endGameVote && endGameVote.votes && endGameVote.votes[myOpenId] === null" class="vote-actions">
        <button class="vote-btn agree-btn" @click="voteEndGame(true)">
          ✓ 同意结束
        </button>
        <button class="vote-btn disagree-btn" @click="voteEndGame(false)">
          ✗ 不同意
        </button>
      </view>
      <view v-else-if="endGameVote && endGameVote.votes" class="vote-result">
        <text class="vote-result-text">
          你已投票: {{ endGameVote.votes[myOpenId] ? '✓ 同意' : '✗ 不同意' }}
        </text>
      </view>
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
      roundNumber: 1,
      players: [],
      myOpenId: '',
      myScore: '',
      isWin: true, // true=赢(+), false=输(-)
      mySubmitted: false,
      submissions: {},
      totalScore: 0,
      isBalanced: false,
      hasNavigatedToFinal: false, // 防止重复跳转到最终结算
      allSubmitted: false,
      loading: false,
      pollTimer: null,
      lastRoundNumber: 0, // 记录上一次的局数，用于检测局数变化
      isResetting: false, // 标记是否正在重置状态
      hasShownResubmitToast: false, // 标记是否已显示重新提交提示
      endGameVote: {
        active: false,
        initiator: '',
        initiatorName: '',
        createdAt: 0,
        expiresAt: 0,
        votes: {},
        passed: false
      }, // 结束游戏投票数据
      voteCountdown: 0, // 投票倒计时（秒）
      voteTimer: null // 投票倒计时定时器
    }
  },

  computed: {
    // 实际分数：根据输赢状态决定正负
    actualScore() {
      if (!this.myScore || this.myScore === 0) return 0
      return this.isWin ? Math.abs(this.myScore) : -Math.abs(this.myScore)
    },

    hasPlayerBankrupt() {
      return this.players.some(p => {
        if (p.openId === this.myOpenId) {
          return (p.chips + this.actualScore) <= 0
        }
        const submission = this.submissions[p.openId]
        if (submission?.submitted) {
          return (p.chips + submission.score) <= 0
        }
        return false
      })
    },

    submittedCount() {
      return Object.values(this.submissions).filter(s => s.submitted).length
    },

    // 判断当前用户是否是最后一个未提交的人
    isLastPlayer() {
      // 如果已经提交了，就不是最后一个人
      if (this.mySubmitted) return false

      // 调试：打印所有玩家信息
      console.log('🔍 isLastPlayer 计算开始')
      console.log('🔍 this.players:', this.players.map(p => ({ openId: p.openId, nickName: p.nickName })))
      console.log('🔍 this.myOpenId:', this.myOpenId)
      console.log('🔍 this.mySubmitted:', this.mySubmitted)
      console.log('🔍 this.submissions:', this.submissions)

      // 计算未提交的人数
      let unsubmittedCount = 0
      this.players.forEach(p => {
        if (p.openId === this.myOpenId) {
          // 自己：根据 mySubmitted 判断
          if (!this.mySubmitted) {
            unsubmittedCount++
            console.log(`🔍 玩家 ${p.nickName} (我): 未提交`)
          } else {
            console.log(`🔍 玩家 ${p.nickName} (我): 已提交`)
          }
        } else {
          // 其他人：根据 submissions 判断
          if (!this.submissions[p.openId]?.submitted) {
            unsubmittedCount++
            console.log(`🔍 玩家 ${p.nickName}: 未提交`)
          } else {
            console.log(`🔍 玩家 ${p.nickName}: 已提交`)
          }
        }
      })

      console.log('🔍 未提交人数:', unsubmittedCount)
      console.log('🔍 总人数:', this.players.length)

      // 只有当只剩自己一个人未提交时，才是最后一个人
      const result = unsubmittedCount === 1 && this.players.length > 1
      console.log('🔍 isLastPlayer 结果:', result)
      return result
    },

    // 计算其他已提交玩家的总分
    othersTotal() {
      let total = 0
      this.players.forEach(p => {
        if (p.openId !== this.myOpenId && this.submissions[p.openId]?.submitted) {
          total += this.submissions[p.openId].score
        }
      })
      return total
    },

    // 需要填写的分数（用于平衡）
    neededScore() {
      return -this.othersTotal
    },

    canSubmit() {
      return this.myScore !== 0 && this.myScore !== '' && this.myScore !== null && !this.loading
    },

    // 投票统计
    voteAgreeCount() {
      if (!this.endGameVote || !this.endGameVote.votes) return 0
      return Object.values(this.endGameVote.votes).filter(v => v === true).length
    },

    voteDisagreeCount() {
      if (!this.endGameVote || !this.endGameVote.votes) return 0
      return Object.values(this.endGameVote.votes).filter(v => v === false).length
    },

    voteNotVotedCount() {
      if (!this.endGameVote || !this.endGameVote.votes) return 0
      return Object.values(this.endGameVote.votes).filter(v => v === null).length
    },

    // 判断当前用户是否已投票
    hasVoted() {
      if (!this.endGameVote || !this.endGameVote.votes) return false
      return this.endGameVote.votes[this.myOpenId] !== null && this.endGameVote.votes[this.myOpenId] !== undefined
    },

    // 获取当前用户的投票选择
    myVoteChoice() {
      if (!this.endGameVote || !this.endGameVote.votes) return null
      return this.endGameVote.votes[this.myOpenId]
    }
  },

  async onLoad(options) {
    this.roomId = options.roomId
    this.roomCode = options.roomCode
    this.initialChips = parseInt(options.initialChips) || 1000

    // 保存当前房间信息到本地存储，用于恢复游戏
    wx.setStorageSync('currentRoom', {
      roomId: this.roomId,
      roomCode: this.roomCode,
      initialChips: this.initialChips
    })

    // 获取当前用户的 openId
    try {
      const res = await wx.cloud.callFunction({ name: 'login' })
      this.myOpenId = res.result.openid
    } catch (err) {
      console.error('获取 openId 失败:', err)
    }

    // 加载房间数据
    await this.loadRoomData()

    // 页面加载时为测试玩家自动提交分数（生产环境无测试玩家时会自动跳过）
    await this.autoSubmitForTestPlayers()

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
    // 页面卸载时清除房间信息（用户主动离开）
    wx.removeStorageSync('currentRoom')
  },

  methods: {
    async loadRoomData() {
      // 如果已经在跳转到最终结算页面，不再加载数据
      if (this.hasNavigatedToFinal) {
        return
      }

      try {
        const db = wx.cloud.database()

        // 加载房间数据
        const roomResult = await db.collection('rooms')
          .doc(this.roomId)
          .get()

        if (roomResult.data) {
          const room = roomResult.data
          this.players = room.players
          const newRoundNumber = room.currentRound?.roundNumber || 1

          let dbSubmissions = room.currentRound?.submissions || {}

          // 检查当前玩家在数据库中是否有提交记录
          const mySubmissionInDb = dbSubmissions[this.myOpenId]

          // 检测局数是否变化
          const roundChanged = this.lastRoundNumber > 0 && newRoundNumber !== this.lastRoundNumber

          console.log('📊 局数检测:', {
            lastRoundNumber: this.lastRoundNumber,
            newRoundNumber: newRoundNumber,
            roundChanged: roundChanged,
            myOpenId: this.myOpenId,
            mySubmissionInDb: mySubmissionInDb,
            dbSubmissionsKeys: Object.keys(dbSubmissions)
          })

          if (roundChanged) {
            console.log('🔄 检测到局数变化:', this.lastRoundNumber, '->', newRoundNumber)
            // 强制重置状态
            this.mySubmitted = false
            this.myScore = ''
            this.isWin = true
            this.submissions = {}
            console.log('🔒 局数变化，强制重置 mySubmitted 为 false')
          }

          this.roundNumber = newRoundNumber
          this.lastRoundNumber = newRoundNumber

          console.log('📊 数据库提交记录:', JSON.stringify(dbSubmissions))
          console.log('📊 数据库提交记录的 keys:', Object.keys(dbSubmissions))
          console.log('📊 本地 mySubmitted:', this.mySubmitted)
          console.log('📊 我的 openId:', this.myOpenId)

          // 调试：打印每个提交记录的详细信息
          Object.keys(dbSubmissions).forEach(key => {
            console.log(`📊 数据库记录 [${key}]:`, {
              score: dbSubmissions[key].score,
              submitted: dbSubmissions[key].submitted,
              timestamp: dbSubmissions[key].timestamp,
              roundNumber: dbSubmissions[key].roundNumber,  // 添加 roundNumber
              isTestPlayer: key.startsWith('test_'),
              isMe: key === this.myOpenId
            })
          })

          // 关键修复：严格以数据库为准
          if (!mySubmissionInDb || !mySubmissionInDb.submitted) {
            // 数据库中没有我的提交记录
            // 无论本地状态如何，都强制重置为未提交
            const wasSubmitted = this.mySubmitted
            this.mySubmitted = false
            if (wasSubmitted) {
              // 如果之前是已提交状态，清空输入
              this.myScore = ''
              this.isWin = true
              console.log('🔄 数据库中没有我的提交记录，强制重置为未提交')
            }
            console.log('✅ 确保未提交状态，mySubmitted:', this.mySubmitted)
          } else {
            // 数据库中有我的提交记录
            // 但不自动同步为已提交状态，除非本地已经是已提交状态
            if (this.mySubmitted) {
              // 本地已提交，同步数据库的分数（用于显示）
              this.myScore = Math.abs(mySubmissionInDb.score)
              this.isWin = mySubmissionInDb.score >= 0
              console.log('🔄 本地已提交，同步数据库中的分数')
            } else {
              // 本地未提交，不同步数据库状态
              // 这样可以避免被其他设备或测试数据影响
              console.log('⚠️ 数据库有我的记录但本地未提交，不同步（避免误操作）')
            }
          }

          // 局数变化时的特殊处理（已经在前面第428-436行处理了，这里是额外确认）
          if (roundChanged) {
            // 局数变化时，即使数据库有记录也强制重置（可能是数据库清理延迟）
            console.log('🔒 局数变化，再次确认重置状态')
            this.mySubmitted = false
            this.myScore = ''
            this.isWin = true
          }

          // 同步其他玩家的提交记录
          // 关键修复：只同步测试玩家的记录，真实玩家的记录需要额外验证
          // 并且只同步当前局的记录
          this.submissions = {}
          Object.keys(dbSubmissions).forEach(key => {
            // 跳过自己的记录（已经在上面处理了）
            if (key === this.myOpenId) {
              console.log(`📊 跳过自己的记录 ${key}`)
              return
            }

            const record = dbSubmissions[key]

            // 验证是否是当前局的记录
            // 如果记录没有 roundNumber 字段，假设它是当前局的记录（兼容旧数据）
            if (record.roundNumber && record.roundNumber !== newRoundNumber) {
              console.warn(`⚠️ 跳过玩家 ${key} 的记录：不是当前局的数据 (记录局数: ${record.roundNumber}, 当前局数: ${newRoundNumber})`)
              return
            }

            if (!record.roundNumber) {
              console.log(`📊 玩家 ${key} 的记录缺少 roundNumber，假设为当前局`)
            }

            // 如果是测试玩家，直接同步
            if (key.startsWith('test_')) {
              console.log(`📊 同步测试玩家 ${key} 的记录:`, record)
              this.$set(this.submissions, key, record)
            } else {
              // 如果是真实玩家，需要验证
              // 只有当记录有 submitted: true 且有合理的 timestamp 时才同步
              if (record && record.submitted === true && record.timestamp) {
                console.log(`📊 同步真实玩家 ${key} 的记录:`, record)
                this.$set(this.submissions, key, record)
              } else {
                console.warn(`⚠️ 跳过真实玩家 ${key} 的无效记录:`, record)
              }
            }
          })

          console.log('📊 同步后 submissions:', JSON.stringify(this.submissions))
          console.log('📊 同步后 submissions 的 keys:', Object.keys(this.submissions))
          console.log('📊 最终 mySubmitted:', this.mySubmitted, 'myScore:', this.myScore)

          // 验证：检查 submissions 中是否有不应该存在的真实玩家记录
          const realPlayersInSubmissions = Object.keys(this.submissions).filter(key => !key.startsWith('test_'))
          if (realPlayersInSubmissions.length > 0) {
            console.warn('⚠️ 警告：submissions 中包含其他真实玩家的记录:', realPlayersInSubmissions)
            console.warn('⚠️ 这些玩家可能还没有真正提交，但数据库中有他们的记录')
          }

          this.totalScore = room.currentRound?.totalScore || 0
          this.isBalanced = room.currentRound?.isBalanced || false
          this.allSubmitted = room.currentRound?.allSubmitted || false

          // 强制更新视图
          this.$forceUpdate()

          // 更新投票数据
          this.endGameVote = room.currentRound?.endGameVote || null

          // 如果有进行中的投票，启动倒计时
          if (this.endGameVote && this.endGameVote.active) {
            this.updateVoteCountdown()
            if (!this.voteTimer) {
              this.startVoteTimer()
            }
          } else {
            // 如果投票结束，停止倒计时
            if (this.voteTimer) {
              clearInterval(this.voteTimer)
              this.voteTimer = null
            }
          }

          // 检查游戏是否结束
          if (room.status === 'finished' && !this.hasNavigatedToFinal) {
            console.log('🎉 游戏已结束，跳转到最终结算')
            this.hasNavigatedToFinal = true

            // 立即停止轮询
            if (this.pollTimer) {
              clearInterval(this.pollTimer)
              this.pollTimer = null
            }

            // 停止投票倒计时
            if (this.voteTimer) {
              clearInterval(this.voteTimer)
              this.voteTimer = null
            }

            // 使用 reLaunch 清除整个页面栈，确保所有页面都被卸载
            uni.reLaunch({
              url: `/pages/game/finalSettlement?roomId=${this.roomId}&roomCode=${this.roomCode}&initialChips=${this.initialChips}`
            })

            // 跳转后立即返回，不再执行后续代码
            return
          }

          console.log('📊 房间数据:', {
            roundNumber: this.roundNumber,
            submissions: this.submissions,
            allSubmitted: this.allSubmitted,
            isBalanced: this.isBalanced,
            myOpenId: this.myOpenId,
            mySubmitted: this.mySubmitted,
            mySubmissionData: this.submissions[this.myOpenId],
            isResetting: this.isResetting
          })

          // 注意：自动进入下一局的逻辑已移到 submitMyScore 方��中
          // 这里只保留轮询时的状态更新
        }
      } catch (err) {
        console.error('加载房间数据失败:', err)
        uni.showToast({
          title: '加载失败',
          icon: 'none'
        })
      }
    },

    startPolling() {
      this.pollTimer = setInterval(() => {
        this.loadRoomData()
      }, 2000)
    },

    onScoreInput() {
      // 确保输入为正数
      if (this.myScore < 0) {
        this.myScore = Math.abs(this.myScore)
      }

      // 实时更新总分预览（仅供参考）
      let total = this.actualScore || 0
      this.players.forEach(p => {
        if (p.openId !== this.myOpenId && this.submissions[p.openId]?.submitted) {
          total += this.submissions[p.openId].score
        }
      })
      this.totalScore = total
    },

    toggleWinLose() {
      if (!this.mySubmitted) {
        this.isWin = !this.isWin
        // 切换后重新计算总分预览
        this.onScoreInput()
      }
    },

    async submitMyScore() {
      if (!this.canSubmit) {
        uni.showToast({
          title: '请输入有效的分数',
          icon: 'none'
        })
        return
      }

      this.loading = true
      uni.showLoading({
        title: '提交中...'
      })

      try {
        const result = await wx.cloud.callFunction({
          name: 'submitScore',
          data: {
            roomId: this.roomId,
            score: this.actualScore  // 使用实际分数（带正负号）
          }
        })

        uni.hideLoading()

        if (result.result.success) {
          // 如果需要重新提交（总分不平衡）
          if (result.result.needResubmit) {
            uni.showToast({
              title: result.result.message,
              icon: 'none',
              duration: 3000
            })

            // 重置本地状态
            this.myScore = ''
            this.isWin = true
            this.mySubmitted = false

            // 刷新数据
            await this.loadRoomData()
            return
          }

          this.mySubmitted = true

          uni.showToast({
            title: result.result.message,
            icon: result.result.autoSaved ? 'success' : 'none',
            duration: 2000
          })

          // 立即刷新数据
          await this.loadRoomData()

          // 如果自动保存成功，检查是否游戏结束
          if (result.result.autoSaved) {
            if (result.result.isGameOver) {
              // 游戏结束，跳转到最终结算
              console.log('🎉 游戏结束，跳转到最终结算')
              setTimeout(() => {
                uni.redirectTo({
                  url: `/pages/game/finalSettlement?roomId=${this.roomId}&roomCode=${this.roomCode}&initialChips=${this.initialChips}`
                })
              }, 1500)
            } else {
              // 准备下一局
              console.log('✅ 本局已结算，准备下一局')
              setTimeout(() => {
                this.resetForNextRound()
              }, 1500)
            }
          }
        } else {
          uni.showToast({
            title: result.result.message || '提交失败',
            icon: 'none'
          })
        }
      } catch (err) {
        console.error('提交分数失败:', err)
        uni.hideLoading()
        uni.showToast({
          title: '提交失败，请重试',
          icon: 'none'
        })
      } finally {
        this.loading = false
      }
    },

    async resetForNextRound() {
      console.log('🔄 重置状态，准备下一局')

      // 停止轮询，避免干扰
      if (this.pollTimer) {
        clearInterval(this.pollTimer)
      }

      // 重置本地状态
      this.myScore = ''
      this.isWin = true  // 重置为赢
      this.mySubmitted = false
      this.submissions = {}
      this.totalScore = 0
      this.isBalanced = false
      this.allSubmitted = false

      console.log('✅ 本地状态已重置，mySubmitted:', this.mySubmitted)

      // 等待1秒，确保数据库更新完成
      await new Promise(resolve => setTimeout(resolve, 1000))

      // 查询数据库，更新玩家列表和局数
      try {
        const db = wx.cloud.database()
        const roomResult = await db.collection('rooms').doc(this.roomId).get()
        if (roomResult.data) {
          const room = roomResult.data
          this.players = room.players
          this.roundNumber = room.currentRound?.roundNumber || 1
          console.log('📊 更新局数:', this.roundNumber)
          console.log('📊 数据库 currentRound:', room.currentRound)
          console.log('📊 数据库 submissions:', JSON.stringify(room.currentRound?.submissions))
          console.log('📊 数据库 submissions 的 keys:', Object.keys(room.currentRound?.submissions || {}))
          console.log('📊 我的 openId:', this.myOpenId)
          console.log('📊 数据库中是否有我的记录:', !!room.currentRound?.submissions?.[this.myOpenId])

          // 如果数据库中有真实玩家的记录，说明云函数没有正确清空
          if (room.currentRound?.submissions?.[this.myOpenId]) {
            console.error('❌ 错误：进入新一局时，数据库中还有我的提交记录！')
            console.error('❌ 我的记录:', room.currentRound.submissions[this.myOpenId])
          }

          // 强制清空本地 submissions，确保不会使用旧数据
          this.submissions = {}
          console.log('🔒 强制清空本地 submissions')
        }
      } catch (err) {
        console.error('更新房间数据失败:', err)
      }

      console.log('更新后 mySubmitted:', this.mySubmitted)

      // 为测试玩家重新提交随机分数
      await this.autoSubmitForTestPlayers()

      console.log('autoSubmit后 mySubmitted:', this.mySubmitted)

      // 强制确保 mySubmitted 为 false
      this.mySubmitted = false
      console.log('🔒 强制设置 mySubmitted 为 false')

      // 强制更新视图
      this.$forceUpdate()

      // 重新启动轮询
      this.startPolling()
    },

    async autoSubmitForTestPlayers() {
      console.log('🤖 autoSubmitForTestPlayers 开始')
      console.log('📊 当前 submissions:', JSON.stringify(this.submissions))

      // 为测试玩家自动提交随机分数
      const testPlayers = this.players.filter(p => p.openId.startsWith('test_'))

      if (testPlayers.length === 0) {
        console.log('没有测试玩家，跳过自动提交')
        return
      }

      // 只为还没有提交的测试玩家提交
      const unsubmittedTestPlayers = testPlayers.filter(p => !this.submissions[p.openId]?.submitted)

      if (unsubmittedTestPlayers.length === 0) {
        console.log('所有测试玩家都已提交，跳过')
        return
      }

      console.log('🤖 为', unsubmittedTestPlayers.length, '个未提交的测试玩家自动提交分数')

      // 计算已提交玩家的总分
      let currentTotal = 0
      this.players.forEach(p => {
        if (this.submissions[p.openId]?.submitted) {
          currentTotal += this.submissions[p.openId].score
        }
      })

      console.log('📊 当前已提交玩家总分:', currentTotal)

      // 为测试玩家生成分数
      for (let i = 0; i < unsubmittedTestPlayers.length; i++) {
        const player = unsubmittedTestPlayers[i]
        let randomScore

        // 计算总共有多少人未提交（包括真实玩家）
        let totalUnsubmitted = 0
        this.players.forEach(p => {
          if (p.openId === this.myOpenId) {
            // 自己：根据 mySubmitted 判断
            if (!this.mySubmitted) {
              totalUnsubmitted++
            }
          } else {
            // 其他人：根据 submissions 判断
            if (!this.submissions[p.openId]?.submitted) {
              totalUnsubmitted++
            }
          }
        })

        // 如果是最后一个测试玩家，且只剩它和真实玩家未提交
        if (i === unsubmittedTestPlayers.length - 1 && totalUnsubmitted === 2) {
          // 生成一个分数，让真实玩家需要填写的分数在合理范围内
          randomScore = Math.floor(Math.random() * 401) - 200 // -200 到 +200
          console.log('🎯 最后一个测试玩家，生成较小的随机分数:', randomScore)
        } else {
          // 生成随机分数（-500 到 +500）
          randomScore = Math.floor(Math.random() * 1001) - 500
        }

        try {
          await wx.cloud.callFunction({
            name: 'submitScoreForTest',
            data: {
              roomId: this.roomId,
              playerId: player.openId,
              score: randomScore
            }
          })
          console.log(`✅ 测试玩家 ${player.nickName} 提交分��: ${randomScore}`)

          // 手动更新本地 submissions
          this.$set(this.submissions, player.openId, {
            score: randomScore,
            submitted: true,
            timestamp: Date.now(),
            roundNumber: this.roundNumber  // 记录是哪一局的提交
          })

          // 更新当前总分
          currentTotal += randomScore
        } catch (err) {
          console.error(`❌ 测试玩家 ${player.nickName} 提交失败:`, err)
        }
      }

      console.log('📊 更新后的 submissions:', this.submissions)
      console.log('📊 测试玩家提交后总分:', currentTotal)
    },

    // 发起结束游戏投票
    async initiateEndGameVote() {
      try {
        uni.showLoading({ title: '发起投票中...' })

        const result = await wx.cloud.callFunction({
          name: 'initiateEndGameVote',
          data: {
            roomId: this.roomId
          }
        })

        uni.hideLoading()

        if (result.result.success) {
          uni.showToast({
            title: '投票已发起',
            icon: 'success'
          })
          // 重新加载房间数据
          await this.loadRoomData()
        } else {
          uni.showModal({
            title: '发起失败',
            content: result.result.message || '发起投票失败',
            showCancel: false
          })
        }
      } catch (err) {
        uni.hideLoading()
        console.error('发起投票失败:', err)
        uni.showModal({
          title: '发起失败',
          content: err.message || '网络错误',
          showCancel: false
        })
      }
    },

    // 投票
    async voteEndGame(agree) {
      try {
        uni.showLoading({ title: '提交投票中...' })

        const result = await wx.cloud.callFunction({
          name: 'voteEndGame',
          data: {
            roomId: this.roomId,
            agree: agree
          }
        })

        uni.hideLoading()

        if (result.result.success) {
          uni.showToast({
            title: agree ? '已投同意' : '已投不同意',
            icon: 'success'
          })

          // 如果投票通过，显示提示
          if (result.result.votePassed) {
            uni.showModal({
              title: '投票通过',
              content: '游戏即将结束，正在进行最终结算...',
              showCancel: false
            })
          }

          // 重新加载房间数据
          await this.loadRoomData()
        } else {
          uni.showModal({
            title: '投票失败',
            content: result.result.message || '投票失败',
            showCancel: false
          })
        }
      } catch (err) {
        uni.hideLoading()
        console.error('投票失败:', err)
        uni.showModal({
          title: '投票失败',
          content: err.message || '网络错误',
          showCancel: false
        })
      }
    },

    // 启动投票倒计时定时器
    startVoteTimer() {
      this.voteTimer = setInterval(() => {
        this.updateVoteCountdown()

        // 如果倒计时结束，检查超时
        if (this.voteCountdown <= 0) {
          this.checkVoteTimeout()
        }
      }, 1000)
    },

    // 更新投票倒计时
    updateVoteCountdown() {
      if (!this.endGameVote || !this.endGameVote.active) {
        this.voteCountdown = 0
        return
      }

      const now = Date.now()
      const expiresAt = this.endGameVote.expiresAt
      const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000))
      this.voteCountdown = remaining
    },

    // 检查投票是否超时
    async checkVoteTimeout() {
      if (!this.endGameVote || !this.endGameVote.active) return

      try {
        const result = await wx.cloud.callFunction({
          name: 'checkVoteTimeout',
          data: {
            roomId: this.roomId
          }
        })

        if (result.result.timeout) {
          uni.showToast({
            title: '投票已超时',
            icon: 'none'
          })
          // 重新加载房间数据
          await this.loadRoomData()
        }
      } catch (err) {
        console.error('检查投票超时失败:', err)
      }
    }
  }
}
</script>

<style scoped>
.debug-info {
  position: fixed;
  top: 20rpx;
  right: 20rpx;
  background: rgba(0, 0, 0, 0.8);
  color: #fff;
  padding: 20rpx;
  border-radius: 10rpx;
  font-size: 24rpx;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.debug-text {
  color: #fff;
  font-size: 24rpx;
}

.game-record {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 32rpx;
}

.game-header {
  background: rgba(255, 255, 255, 0.98);
  border-radius: 24rpx;
  padding: 40rpx;
  margin-bottom: 32rpx;
  box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.15);
}

.round-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16rpx;
  flex-wrap: wrap;
}

.round-number {
  font-size: 44rpx;
  font-weight: 800;
  color: #667eea;
  text-shadow: 0 2rpx 4rpx rgba(102, 126, 234, 0.2);
}

.room-code {
  font-size: 28rpx;
  color: #666;
}

.players-list {
  margin-bottom: 32rpx;
}

.player-item {
  background: rgba(255, 255, 255, 0.98);
  border-radius: 24rpx;
  padding: 36rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 6rpx 20rpx rgba(0, 0, 0, 0.12);
  border: 3rpx solid transparent;
}

.player-item.is-me {
  background: rgba(255, 255, 255, 1);
  border: 4rpx solid #667eea;
  box-shadow: 0 10rpx 30rpx rgba(102, 126, 234, 0.25);
}

.player-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24rpx;
}

.player-info {
  flex: 1;
}

.player-name {
  font-size: 36rpx;
  font-weight: 700;
  color: #333;
  display: block;
  margin-bottom: 12rpx;
}

.me-tag {
  font-size: 26rpx;
  color: #fff;
  font-weight: 700;
  background: linear-gradient(135deg, #667eea, #764ba2);
  padding: 6rpx 16rpx;
  border-radius: 16rpx;
  box-shadow: 0 2rpx 8rpx rgba(102, 126, 234, 0.3);
}

.chips-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  flex-wrap: wrap;
}

.current-chips {
  font-size: 32rpx;
  color: #333;
  font-weight: 700;
}

.current-chips.warning {
  color: #ff6b6b;
  font-weight: 800;
  font-size: 36rpx;
  animation: pulse 1.5s ease-in-out infinite;
}

.submit-btn-compact {
  height: 56rpx;
  padding: 0 24rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  border: none;
  border-radius: 28rpx;
  font-size: 24rpx;
  font-weight: 700;
  box-shadow: 0 4rpx 12rpx rgba(102, 126, 234, 0.3);
  transition: all 0.3s ease;
  white-space: nowrap;
  display: flex;
  align-items: center;
  justify-content: center;
}

.submit-btn-compact:active {
  transform: scale(0.95);
  box-shadow: 0 2rpx 8rpx rgba(102, 126, 234, 0.25);
}

.submit-btn-compact[disabled] {
  background: linear-gradient(135deg, #ccc 0%, #999 100%);
  box-shadow: none;
  opacity: 0.6;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.7; transform: scale(1.05); }
}

.submit-status {
  display: flex;
  align-items: center;
  gap: 10rpx;
  padding: 12rpx 24rpx;
  background: linear-gradient(135deg, #4caf50, #45a049);
  border-radius: 24rpx;
  box-shadow: 0 4rpx 12rpx rgba(76, 175, 80, 0.3);
}

.status-icon {
  font-size: 28rpx;
  color: #fff;
}

.status-text {
  font-size: 28rpx;
  color: #fff;
  font-weight: 700;
}

.score-input-row {
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.win-lose-toggle {
  width: 100rpx;
  height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 16rpx;
  cursor: pointer;
  transition: all 0.3s ease;
  font-weight: 600;
  font-size: 32rpx;
}

.win-lose-toggle.win {
  background: linear-gradient(135deg, #4caf50 0%, #45a049 100%);
  color: #fff;
  box-shadow: 0 4rpx 12rpx rgba(76, 175, 80, 0.3);
}

.win-lose-toggle.lose {
  background: linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%);
  color: #fff;
  box-shadow: 0 4rpx 12rpx rgba(255, 107, 107, 0.3);
}

.win-lose-toggle:active {
  transform: scale(0.95);
}

.toggle-text {
  font-size: 32rpx;
  font-weight: 700;
}

.score-input {
  flex: 1;
  height: 96rpx;
  background: #fff;
  border-radius: 20rpx;
  padding: 0 28rpx;
  font-size: 40rpx;
  font-weight: 700;
  color: #333;
  border: 3rpx solid #e0e0e0;
  transition: all 0.3s ease;
}

.score-input:focus {
  border-color: #667eea;
  box-shadow: 0 0 0 4rpx rgba(102, 126, 234, 0.15);
}

.score-input[disabled] {
  background: #f0f0f0;
  color: #999;
  border-color: #e0e0e0;
}

.chips-preview {
  display: flex;
  align-items: center;
  gap: 16rpx;
  min-width: 160rpx;
}

.arrow {
  font-size: 32rpx;
  color: #999;
  font-weight: 700;
}

.after-chips {
  font-size: 40rpx;
  font-weight: 800;
  min-width: 120rpx;
  text-align: right;
}

.after-chips.positive {
  color: #4caf50;
}

.after-chips.negative {
  color: #ff6b6b;
}

.after-chips.zero {
  color: #999;
}

.after-chips.bankrupt {
  color: #ff6b6b;
  animation: pulse 1.5s ease-in-out infinite;
}

.after-chips.negative {
  color: #ff6b6b;
}

.after-chips.zero {
  color: #999;
}

.after-chips.bankrupt {
  color: #ff0000;
  animation: blink 1s infinite;
}

.score-display-row {
  padding: 20rpx 0;
}

.score-display {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 20rpx 24rpx;
  background: rgba(102, 126, 234, 0.08);
  border-radius: 16rpx;
}

.score-label {
  font-size: 30rpx;
  color: #666;
  font-weight: 600;
}

.score-value {
  font-size: 40rpx;
  font-weight: 800;
}

.score-value.positive {
  color: #4caf50;
}

.score-value.negative {
  color: #ff6b6b;
}

.waiting-submit {
  padding: 20rpx 0;
}

.waiting-text {
  font-size: 30rpx;
  color: #999;
  font-style: italic;
  font-weight: 500;
}

.warning-box {
  background: linear-gradient(135deg, rgba(255, 107, 107, 0.25), rgba(238, 90, 82, 0.2));
  border: 4rpx solid rgba(255, 107, 107, 0.6);
  border-radius: 24rpx;
  padding: 36rpx;
  margin: 0 32rpx 32rpx;
  display: flex;
  align-items: center;
  gap: 20rpx;
  box-shadow: 0 12rpx 32rpx rgba(255, 107, 107, 0.35), 0 0 0 4rpx rgba(255, 107, 107, 0.1);
  animation: slideInDown 0.5s ease-out, gentlePulseWarning 2s ease-in-out infinite 0.5s;
  position: relative;
  overflow: hidden;
}

.warning-box::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
  animation: shimmer 3s ease-in-out infinite;
}

@keyframes gentlePulseWarning {
  0%, 100% {
    box-shadow: 0 12rpx 32rpx rgba(255, 107, 107, 0.35), 0 0 0 4rpx rgba(255, 107, 107, 0.1);
    transform: scale(1);
  }
  50% {
    box-shadow: 0 16rpx 40rpx rgba(255, 107, 107, 0.45), 0 0 0 6rpx rgba(255, 107, 107, 0.2);
    transform: scale(1.01);
  }
}

.warning-icon {
  font-size: 48rpx;
  animation: warningIconPulse 1.5s ease-in-out infinite;
  position: relative;
  z-index: 1;
}

@keyframes warningIconPulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.15);
  }
}

.warning-text {
  flex: 1;
  font-size: 32rpx;
  color: #ff6b6b;
  font-weight: 800;
  line-height: 1.5;
  position: relative;
  z-index: 1;
  text-shadow: 0 2rpx 4rpx rgba(255, 107, 107, 0.2);
}

.last-player-hint {
  background: linear-gradient(135deg, rgba(255, 193, 7, 0.25), rgba(255, 152, 0, 0.2));
  border: 4rpx solid rgba(255, 152, 0, 0.6);
  border-radius: 24rpx;
  padding: 36rpx;
  margin: 0 32rpx 32rpx;
  box-shadow: 0 12rpx 32rpx rgba(255, 152, 0, 0.35), 0 0 0 4rpx rgba(255, 152, 0, 0.1);
  animation: slideInDown 0.5s ease-out, gentlePulse 2s ease-in-out infinite 0.5s;
  position: relative;
  overflow: hidden;
}

.last-player-hint::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
  animation: shimmer 3s ease-in-out infinite;
}

@keyframes slideInDown {
  0% {
    opacity: 0;
    transform: translateY(-30rpx);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes gentlePulse {
  0%, 100% {
    box-shadow: 0 12rpx 32rpx rgba(255, 152, 0, 0.35), 0 0 0 4rpx rgba(255, 152, 0, 0.1);
    transform: scale(1);
  }
  50% {
    box-shadow: 0 16rpx 40rpx rgba(255, 152, 0, 0.45), 0 0 0 6rpx rgba(255, 152, 0, 0.2);
    transform: scale(1.01);
  }
}

@keyframes shimmer {
  0% {
    left: -100%;
  }
  50%, 100% {
    left: 100%;
  }
}

.hint-header {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 28rpx;
}

.hint-icon {
  font-size: 40rpx;
}

.hint-title {
  font-size: 36rpx;
  color: #ff9800;
  font-weight: 800;
  text-shadow: 0 2rpx 4rpx rgba(255, 152, 0, 0.3);
}

.hint-content {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 16rpx;
  padding: 16rpx;
  background: rgba(255, 255, 255, 0.6);
  border-radius: 16rpx;
}

.hint-content:last-child {
  margin-bottom: 0;
  background: rgba(255, 255, 255, 0.8);
  border: 2rpx solid rgba(102, 126, 234, 0.3);
}

.hint-label {
  font-size: 32rpx;
  color: #333;
  font-weight: 600;
}

.hint-value {
  font-size: 40rpx;
  font-weight: 800;
}

.hint-value.positive {
  color: #4caf50;
}

.hint-value.negative {
  color: #ff6b6b;
}

.hint-value.balance-needed {
  font-size: 48rpx;
}

.hint-tip {
  font-size: 28rpx;
  color: #666;
  font-style: italic;
}

.balance-check {
  background: rgba(255, 255, 255, 0.98);
  border-radius: 24rpx;
  padding: 40rpx;
  margin-bottom: 32rpx;
  box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.12);
}

.balance-check.error {
  border: 4rpx solid #ff6b6b;
  background: rgba(255, 235, 235, 0.95);
}

.balance-check.success {
  border: 4rpx solid #4caf50;
  background: rgba(232, 245, 233, 0.95);
}

.balance-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
}

.balance-label {
  font-size: 32rpx;
  color: #333;
  font-weight: 600;
}

.balance-value {
  font-size: 56rpx;
  font-weight: 800;
  color: #333;
}

.balance-value.error {
  color: #ff6b6b;
}

.balance-status {
  text-align: center;
  padding: 16rpx;
  border-radius: 16rpx;
  background: rgba(255, 255, 255, 0.8);
}

.waiting-msg {
  font-size: 32rpx;
  color: #999;
  font-weight: 600;
}

.error-msg {
  font-size: 32rpx;
  color: #ff6b6b;
  font-weight: 700;
}

.success-msg {
  font-size: 32rpx;
  color: #4caf50;
  font-weight: 700;
}

.actions {
  padding: 0 32rpx;
}

.submit-btn {
  width: 100%;
  height: 104rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  border: none;
  border-radius: 24rpx;
  font-size: 36rpx;
  font-weight: 800;
  box-shadow: 0 8rpx 24rpx rgba(102, 126, 234, 0.4);
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.submit-btn:active {
  transform: scale(0.98);
  box-shadow: 0 4rpx 16rpx rgba(102, 126, 234, 0.3);
}

.submit-btn[disabled] {
  background: linear-gradient(135deg, #ccc 0%, #999 100%);
  box-shadow: none;
  opacity: 0.6;
}

.submitted-btn {
  width: 100%;
  height: 96rpx;
  background: #4caf50;
  color: #ffffff;
  border-radius: 48rpx;
  font-size: 32rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 投票面板样式 */
.vote-panel {
  background: rgba(255, 255, 255, 0.98);
  border-radius: 24rpx;
  padding: 40rpx;
  margin: 0 32rpx 32rpx;
  box-shadow: 0 8rpx 32rpx rgba(255, 152, 0, 0.25);
  border: 4rpx solid rgba(255, 152, 0, 0.3);
}

.vote-header {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 28rpx;
  padding-bottom: 24rpx;
  border-bottom: 3rpx solid rgba(255, 152, 0, 0.2);
}

.vote-icon {
  font-size: 48rpx;
}

.vote-title {
  flex: 1;
  font-size: 36rpx;
  font-weight: 800;
  color: #ff9800;
  text-shadow: 0 2rpx 4rpx rgba(255, 152, 0, 0.2);
}

.vote-timer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  padding: 20rpx 32rpx;
  background: linear-gradient(135deg, rgba(255, 152, 0, 0.15), rgba(255, 193, 7, 0.15));
  border-radius: 20rpx;
  margin-bottom: 28rpx;
  border: 3rpx solid rgba(255, 152, 0, 0.3);
}

.timer-label {
  font-size: 32rpx;
  color: #666;
  font-weight: 600;
}

.timer-value {
  font-size: 40rpx;
  font-weight: 800;
  color: #ff9800;
}

.vote-stats {
  display: flex;
  gap: 16rpx;
  margin-bottom: 28rpx;
}

.stat-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;
  padding: 24rpx 16rpx;
  border-radius: 20rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.1);
}

.stat-item.agree {
  background: rgba(76, 175, 80, 0.15);
  border: 3rpx solid rgba(76, 175, 80, 0.3);
}

.stat-item.disagree {
  background: rgba(255, 107, 107, 0.15);
  border: 3rpx solid rgba(255, 107, 107, 0.3);
}

.stat-item.pending {
  background: rgba(158, 158, 158, 0.15);
  border: 3rpx solid rgba(158, 158, 158, 0.3);
}

.stat-icon {
  font-size: 36rpx;
  font-weight: 800;
}

.stat-item.agree .stat-icon {
  color: #4caf50;
}

.stat-item.disagree .stat-icon {
  color: #ff6b6b;
}

.stat-item.pending .stat-icon {
  color: #9e9e9e;
}

.stat-text {
  font-size: 28rpx;
  font-weight: 700;
  color: #333;
}

.vote-players {
  margin-bottom: 28rpx;
}

.vote-player-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 24rpx;
  margin-bottom: 12rpx;
  border-radius: 16rpx;
  background: rgba(0, 0, 0, 0.03);
  border: 2rpx solid transparent;
}

.vote-player-item.agreed {
  background: rgba(76, 175, 80, 0.1);
  border-color: rgba(76, 175, 80, 0.3);
}

.vote-player-item.disagreed {
  background: rgba(255, 107, 107, 0.1);
  border-color: rgba(255, 107, 107, 0.3);
}

.vote-player-item.pending {
  background: rgba(158, 158, 158, 0.08);
  border-color: rgba(158, 158, 158, 0.2);
}

.vote-player-name {
  font-size: 30rpx;
  font-weight: 600;
  color: #333;
}

.vote-player-status {
  font-size: 28rpx;
  font-weight: 700;
}

.vote-player-item.agreed .vote-player-status {
  color: #4caf50;
}

.vote-player-item.disagreed .vote-player-status {
  color: #ff6b6b;
}

.vote-player-item.pending .vote-player-status {
  color: #9e9e9e;
}

.vote-actions {
  display: flex;
  gap: 16rpx;
}

.vote-btn {
  flex: 1;
  height: 96rpx;
  border: none;
  border-radius: 20rpx;
  font-size: 32rpx;
  font-weight: 800;
  color: #fff;
  box-shadow: 0 6rpx 20rpx rgba(0, 0, 0, 0.15);
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.vote-btn.agree-btn {
  background: linear-gradient(135deg, #4caf50, #45a049);
}

.vote-btn.disagree-btn {
  background: linear-gradient(135deg, #ff6b6b, #ff5252);
}

.vote-btn:active {
  transform: scale(0.98);
  box-shadow: 0 3rpx 12rpx rgba(0, 0, 0, 0.12);
}

.vote-result {
  text-align: center;
  padding: 24rpx;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.1), rgba(118, 75, 162, 0.1));
  border-radius: 16rpx;
  border: 3rpx solid rgba(102, 126, 234, 0.3);
}

.vote-result-text {
  font-size: 32rpx;
  font-weight: 700;
  color: #667eea;
}

/* 精巧版提议结束按钮 */
.end-game-btn-compact {
  height: 56rpx;
  padding: 0 24rpx;
  background: linear-gradient(135deg, #ff9800, #f57c00);
  color: #fff;
  border: none;
  border-radius: 28rpx;
  font-size: 24rpx;
  font-weight: 700;
  box-shadow: 0 4rpx 12rpx rgba(255, 152, 0, 0.3);
  transition: all 0.3s ease;
  white-space: nowrap;
  display: flex;
  align-items: center;
  justify-content: center;
}

.end-game-btn-compact:active {
  transform: scale(0.95);
  box-shadow: 0 2rpx 8rpx rgba(255, 152, 0, 0.25);
}

/* 保留原来的大按钮样式（已移除，但保留样式定义以防需要） */
.end-game-btn {
  width: 100%;
  height: 96rpx;
  background: linear-gradient(135deg, #ff9800, #f57c00);
  color: #fff;
  border: none;
  border-radius: 20rpx;
  font-size: 32rpx;
  font-weight: 800;
  margin-top: 24rpx;
  box-shadow: 0 6rpx 20rpx rgba(255, 152, 0, 0.3);
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.end-game-btn:active {
  transform: scale(0.98);
  box-shadow: 0 3rpx 12rpx rgba(255, 152, 0, 0.25);
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
</style>
