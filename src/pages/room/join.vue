<template>
  <view class="join-room">
    <view class="header">
      <text class="title">加入房间</text>
      <text class="subtitle">输入房间号快速加入游戏</text>
    </view>

    <view class="form">
      <!-- 房间号输入 -->
      <view class="form-item">
        <text class="label">房间号</text>
        <input
          class="input room-code-input"
          type="number"
          v-model="roomCode"
          placeholder="请输入4位数字房间号"
          maxlength="4"
        />
      </view>

      <!-- 昵称输入 -->
      <view class="form-item">
        <text class="label">您的昵称</text>
        <input
          class="input"
          v-model="nickName"
          placeholder="请输入昵称"
          maxlength="10"
        />
      </view>

      <view class="tips">
        <text class="tips-icon">💡</text>
        <text class="tips-text">请向房主索要4位数字房间号</text>
      </view>
    </view>

    <view class="actions">
      <button class="join-btn" @click="handleJoinRoom" :disabled="!canJoin">
        加入房间
      </button>
    </view>
  </view>
</template>

<script>
export default {
  data() {
    return {
      roomCode: '',
      nickName: '',
      loading: false
    }
  },

  computed: {
    canJoin() {
      return (
        this.roomCode.length === 4 &&
        this.nickName.trim().length > 0 &&
        !this.loading
      )
    }
  },

  onLoad() {
    // 不自动获取用户信息，要求玩家手动输入昵称
  },

  methods: {
    // 移除自动获取用户信息的方法，要求玩家手动输入昵称

    async handleJoinRoom() {
      if (!this.canJoin) {
        return
      }

      // 验证房间号格式
      if (!/^\d{4}$/.test(this.roomCode)) {
        uni.showToast({
          title: '请输入4位数字房间号',
          icon: 'none'
        })
        return
      }

      await this.joinRoom()
    },

    async joinRoom() {
      this.loading = true
      uni.showLoading({
        title: '加入中...'
      })

      try {
        console.log('📞 准备调用 joinRoom 云函数')
        console.log('参数:', {
          roomCode: this.roomCode,
          nickName: this.nickName.trim()
        })

        const result = await wx.cloud.callFunction({
          name: 'joinRoom',
          data: {
            roomCode: this.roomCode,
            nickName: this.nickName.trim(),
            avatarUrl: ''
          }
        })

        console.log('📦 云函数返回结果:', result)

        uni.hideLoading()

        if (result.result.success) {
          console.log('✅ 加入成功，准备跳转')
          console.log('跳转参数:', {
            roomId: result.result.roomId,
            roomCode: result.result.roomCode,
            initialChips: result.result.initialChips,
            isRejoin: result.result.isRejoin,
            roomStatus: result.result.roomStatus
          })

          // 根据房间状态和是否重新加入来决定跳转页面
          if (result.result.isRejoin && result.result.roomStatus === 'playing') {
            // 重新加入进行中的游戏，直接跳转到游戏记录页面
            uni.redirectTo({
              url: `/pages/game/record?roomId=${result.result.roomId}&roomCode=${result.result.roomCode}&initialChips=${result.result.initialChips}`
            })
          } else {
            // 新加入或房间还在等待中，跳转到房间大厅
            uni.redirectTo({
              url: `/pages/room/lobby?roomId=${result.result.roomId}&roomCode=${result.result.roomCode}&isCreator=false&initialChips=${result.result.initialChips}`
            })
          }
        } else {
          console.error('❌ 加入失败:', result.result.message)
          uni.showToast({
            title: result.result.message || '加入失败',
            icon: 'none',
            duration: 2000
          })
        }
      } catch (err) {
        console.error('❌ 加入房间失败:', err)
        console.error('错误详情:', err.message, err.errMsg)
        uni.hideLoading()
        uni.showToast({
          title: '加入失败，请检查房间号',
          icon: 'none'
        })
      } finally {
        this.loading = false
      }
    }
  }
}
</script>

<style scoped>
.join-room {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 40rpx;
}

.header {
  text-align: center;
  margin-bottom: 60rpx;
  padding-top: 40rpx;
}

.title {
  display: block;
  font-size: 48rpx;
  font-weight: bold;
  color: #ffffff;
  margin-bottom: 16rpx;
}

.subtitle {
  display: block;
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.8);
}

.form {
  background: #ffffff;
  border-radius: 20rpx;
  padding: 40rpx;
  margin-bottom: 40rpx;
}

.form-item {
  margin-bottom: 40rpx;
}

.form-item:last-of-type {
  margin-bottom: 0;
}

.label {
  display: block;
  font-size: 28rpx;
  color: #333;
  margin-bottom: 16rpx;
  font-weight: 500;
}

.input {
  width: 100%;
  height: 88rpx;
  background: #f8f9fa;
  border-radius: 12rpx;
  padding: 0 24rpx;
  font-size: 28rpx;
  box-sizing: border-box;
}

.room-code-input {
  text-align: center;
  font-size: 48rpx;
  font-weight: bold;
  letter-spacing: 8rpx;
}

.tips {
  display: flex;
  align-items: center;
  margin-top: 24rpx;
  padding: 20rpx;
  background: #fff3cd;
  border-radius: 12rpx;
}

.tips-icon {
  font-size: 32rpx;
  margin-right: 12rpx;
}

.tips-text {
  font-size: 24rpx;
  color: #856404;
}

.actions {
  padding: 0 40rpx;
}

.join-btn {
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

.join-btn[disabled] {
  background: rgba(255, 255, 255, 0.5);
  color: rgba(102, 126, 234, 0.5);
}
</style>
