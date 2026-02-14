/**
 * 计算结算方案（最小化转账次数）
 * @param {Object} scores 玩家分数 { playerId: score }
 * @param {Object} playerMap 玩家ID到玩家对象的映射 { playerId: player }
 * @returns {Array} 结算方案 [{ from, to, amount, fromName, toName }]
 */
export function calculateSettlement(scores, playerMap = {}) {
  // 1. 创建余额数组
  let balances = Object.entries(scores).map(([id, score]) => ({
    playerId: id,
    amount: score,
    name: playerMap[id]?.nickName || '未知玩家'
  }))

  // 2. 分离债权人和债务人
  let creditors = balances
    .filter(b => b.amount > 0)
    .sort((a, b) => b.amount - a.amount)

  let debtors = balances
    .filter(b => b.amount < 0)
    .sort((a, b) => a.amount - b.amount)

  // 3. 匹配并创建结算
  let settlements = []
  let i = 0, j = 0

  while (i < creditors.length && j < debtors.length) {
    let creditor = creditors[i]
    let debtor = debtors[j]
    let amount = Math.min(creditor.amount, -debtor.amount)

    settlements.push({
      from: debtor.playerId,
      to: creditor.playerId,
      amount: amount,
      fromName: debtor.name,
      toName: creditor.name
    })

    creditor.amount -= amount
    debtor.amount += amount

    if (Math.abs(creditor.amount) < 0.01) i++
    if (Math.abs(debtor.amount) < 0.01) j++
  }

  return settlements
}

/**
 * 验证分数是否平衡（零和游戏）
 * @param {Object} scores 玩家分数
 * @returns {boolean} 是否平衡
 */
export function validateScores(scores) {
  const sum = Object.values(scores).reduce((a, b) => a + b, 0)
  return Math.abs(sum) < 0.01
}
