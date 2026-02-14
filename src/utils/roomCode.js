/**
 * 生成四位数字房间号
 * @returns {string} 房间号
 */
export function generateRoomCode() {
  return Math.floor(1000 + Math.random() * 9000).toString()
}

/**
 * 验证房间号格式
 * @param {string} code 房间号
 * @returns {boolean} 是否有效
 */
export function validateRoomCode(code) {
  return /^\d{4}$/.test(code)
}
