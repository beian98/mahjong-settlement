<script>
export default {
  onLaunch: function() {
    console.log('App Launch')
    // 初始化云开发
    wx.cloud.init({
      env: 'cloud1-0ghl3glb04b742fc',
      traceUser: true
    })
  },
  onShow: function() {
    console.log('App Show')

    // 检查是否有进行中的游戏
    const currentRoom = wx.getStorageSync('currentRoom')
    if (currentRoom && currentRoom.roomId) {
      console.log('检测到进行中的游戏:', currentRoom)

      // 获取当前页面栈
      const pages = getCurrentPages()
      const currentPage = pages[pages.length - 1]
      const currentRoute = currentPage ? currentPage.route : ''

      console.log('当前页面:', currentRoute)

      // 只在首页时询问是否恢复
      if (currentRoute === 'pages/index/index') {
        wx.showModal({
          title: '恢复游戏',
          content: `检测到房间 ${currentRoom.roomCode} 正在进行中，是否继续？`,
          confirmText: '继续游戏',
          cancelText: '取消',
          success: (res) => {
            if (res.confirm) {
              // 跳转到记录页面
              wx.reLaunch({
                url: `/pages/game/record?roomId=${currentRoom.roomId}&roomCode=${currentRoom.roomCode}`
              })
            } else {
              // 用户选择不继续，清除存储
              wx.removeStorageSync('currentRoom')
            }
          }
        })
      }
    }
  },
  onHide: function() {
    console.log('App Hide')
  }
}
</script>

<style>
/* 全局样式 */
page {
  background-color: #f8f8f8;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
}

/* 通用按钮样式 */
button {
  border-radius: 8rpx;
  font-size: 28rpx;
}

button::after {
  border: none;
}

/* 输入框样式 */
input {
  font-size: 28rpx;
}
</style>
