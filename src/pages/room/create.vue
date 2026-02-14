<template>
  <view class="create-room">
    <view class="header">
      <text class="title">创建房间</text>
      <text class="subtitle">设置游戏参数并生成房间号</text>
    </view>

    <view class="form">
      <!-- 昵���输入 -->
      <view class="form-item">
        <text class="label">您的昵称</text>
        <input
          class="input"
          v-model="nickName"
          placeholder="请输入昵称"
          maxlength="10"
        />
      </view>

      <!-- 初始筹码选择 -->
      <view class="form-item">
        <text class="label">初始筹码</text>
        <picker
          mode="selector"
          :range="chipsOptions"
          :value="selectedChipsIndex"
          @change="onChipsChange"
        >
          <view class="picker">
            <text>{{ selectedChips }} 筹码</text>
            <text class="arrow">›</text>
          </view>
        </picker>
      </view>

      <!-- 自定义筹码 -->
      <view class="form-item" v-if="selectedChips === '自定义'">
        <text class="label">自定义筹码数</text>
        <input
          class="input"
          type="number"
          v-model.number="customChips"
          placeholder="请输入筹码数（>100的整数）"
        />
        <text class="input-hint">💡 筹码必须是大于100的整数</text>
      </view>

      <!-- 游戏规则说明 -->
      <view class="rules">
        <text class="rules-title">📋 游戏规则</text>
        <text class="rules-item">• 4人游戏，通过房间号组局</text>
        <text class="rules-item">• 每人初始筹码：{{ finalChips }}</text>
        <text class="rules-item">• 每局输赢直接增减筹码</text>
        <text class="rules-item">• 任意玩家筹码≤0时游戏结束</text>
      </view>
    </view>

    <view class="actions">
      <button class="create-btn" @click="handleCreateRoom" :disabled="!canCreate">
        创建房间
      </button>
    </view>
  </view>
</template>

<script>
export default {
  data() {
    return {
      nickName: '',
      chipsOptions: ['100', '200', '300', '400', '500', '自定义'],
      selectedChipsIndex: 0,
      selectedChips: '100',
      customChips: '',
      loading: false
    }
  },

  computed: {
    finalChips() {
      if (this.selectedChips === '自定义') {
        return this.customChips || 0
      }
      return parseInt(this.selectedChips)
    },

    canCreate() {
      // 基础校验：昵称不能为空
      if (this.nickName.trim().length === 0 || this.loading) {
        return false
      }

      // 如果选择了自定义筹码，需要额外校验
      if (this.selectedChips === '自定义') {
        const chips = Number(this.customChips)
        // 必须是有效数字、整数、且大于100
        return !isNaN(chips) && Number.isInteger(chips) && chips > 100
      }

      // 预设筹码直接通过
      return this.finalChips > 0
    }
  },

  onLoad() {
    // 不自动获取用户信息，要求玩家手动输入昵称
  },

  methods: {
    // 移除自动获取用户信息的方法，要求玩家手动输入昵称

    onChipsChange(e) {
      this.selectedChipsIndex = e.detail.value
      this.selectedChips = this.chipsOptions[e.detail.value]
    },

    async handleCreateRoom() {
      if (!this.canCreate) {
        return
      }

      this.loading = true
      uni.showLoading({
        title: '创建中...'
      })

      try {
        const result = await wx.cloud.callFunction({
          name: 'createRoom',
          data: {
            nickName: this.nickName.trim(),
            avatarUrl: '',
            initialChips: this.finalChips
          }
        })

        uni.hideLoading()

        if (result.result.success) {
          // 跳转到房间大厅
          uni.redirectTo({
            url: `/pages/room/lobby?roomId=${result.result.roomId}&roomCode=${result.result.roomCode}&isCreator=true&initialChips=${result.result.initialChips}`
          })
        } else {
          uni.showToast({
            title: result.result.message || '创建失败',
            icon: 'none'
          })
        }
      } catch (err) {
        console.error('创建房间失败:', err)
        uni.hideLoading()
        uni.showToast({
          title: '创建失败，请重试',
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
.create-room {
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

.form-item:last-child {
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

.input-hint {
  display: block;
  margin-top: 12rpx;
  font-size: 24rpx;
  color: #ff9800;
  line-height: 1.5;
}

.picker {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 88rpx;
  background: #f8f9fa;
  border-radius: 12rpx;
  padding: 0 24rpx;
  font-size: 28rpx;
}

.arrow {
  font-size: 40rpx;
  color: #ccc;
}

.rules {
  margin-top: 40rpx;
  padding: 24rpx;
  background: #f0f7ff;
  border-radius: 12rpx;
  border-left: 4rpx solid #667eea;
}

.rules-title {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  color: #333;
  margin-bottom: 16rpx;
}

.rules-item {
  display: block;
  font-size: 24rpx;
  color: #666;
  line-height: 40rpx;
  margin-bottom: 8rpx;
}

.actions {
  padding: 0 40rpx;
}

.create-btn {
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

.create-btn[disabled] {
  background: rgba(255, 255, 255, 0.5);
  color: rgba(102, 126, 234, 0.5);
}
</style>
