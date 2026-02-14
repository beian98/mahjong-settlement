/**
 * 本地存储封装
 */

/**
 * 保存数据到本地存储
 * @param {string} key 键名
 * @param {any} data 数据
 */
export function setStorage(key, data) {
  try {
    uni.setStorageSync(key, JSON.stringify(data))
    return true
  } catch (e) {
    console.error('存储失败:', e)
    return false
  }
}

/**
 * 从本地存储读取数据
 * @param {string} key 键名
 * @param {any} defaultValue 默认值
 * @returns {any} 数据
 */
export function getStorage(key, defaultValue = null) {
  try {
    const data = uni.getStorageSync(key)
    return data ? JSON.parse(data) : defaultValue
  } catch (e) {
    console.error('读取失败:', e)
    return defaultValue
  }
}

/**
 * 删除本地存储数据
 * @param {string} key 键名
 */
export function removeStorage(key) {
  try {
    uni.removeStorageSync(key)
    return true
  } catch (e) {
    console.error('删除失败:', e)
    return false
  }
}

/**
 * 清空本地存储
 */
export function clearStorage() {
  try {
    uni.clearStorageSync()
    return true
  } catch (e) {
    console.error('清空失败:', e)
    return false
  }
}
