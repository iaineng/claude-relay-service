/**
 * Beta Header 管理器
 * 根据模型动态决定应该包含哪些 beta 功能
 */

const logger = require('./logger')
const config = require('../../config/config')

class BetaHeaderManager {
  /**
   * 模型与 beta 功能的映射规则
   */
  static FEATURE_RULES = {
    // interleaved-thinking-2025-05-14 只对特定模型生效
    'interleaved-thinking-2025-05-14': {
      models: ['claude-sonnet-4-20250514', 'claude-opus-4-20250514', 'claude-opus-4-1-20250805']
    },
    // claude-code-20250219 只对 sonnet 和 opus 系列生效
    'claude-code-20250219': {
      patterns: [/sonnet/i, /opus/i]
    },
    // OAuth 和 fine-grained-tool-streaming 对所有模型生效
    'oauth-2025-04-20': {
      alwaysInclude: true
    },
    'fine-grained-tool-streaming-2025-05-14': {
      alwaysInclude: true
    },
    // token-counting-2024-11-01 对所有模型生效，但只在 count_tokens 请求时添加
    'token-counting-2024-11-01': {
      alwaysInclude: true
    }
  }

  /**
   * Beta headers 的固定顺序
   */
  static FEATURE_ORDER = [
    'claude-code-20250219', // 第一位
    'oauth-2025-04-20', // 第二位
    'interleaved-thinking-2025-05-14', // 第三位
    'fine-grained-tool-streaming-2025-05-14', // 第四位
    'context-1m-2025-08-07', // 第五位
    'token-counting-2024-11-01' // 第六位（最后）
  ]

  /**
   * 根据模型名称构建适用的 beta headers
   * @param {string} model - 模型名称
   * @param {string} baseBetaHeader - 基础 beta header (可能来自配置)
   * @param {string} clientBetaHeader - 客户端请求的 beta header
   * @param {object} requestOptions - 请求选项，可能包含 customPath
   * @returns {string|null} 构建好的 beta header 字符串
   */
  static buildBetaHeader(model, baseBetaHeader = '', clientBetaHeader = '', requestOptions = {}) {
    const features = new Set()

    // 解析基础 beta header
    if (baseBetaHeader) {
      baseBetaHeader.split(',').forEach((feature) => {
        const trimmed = feature.trim()
        if (trimmed && this.shouldIncludeFeature(trimmed, model)) {
          features.add(trimmed)
        }
      })
    }

    // 检查客户端是否请求 context-1m-2025-08-07
    if (clientBetaHeader && clientBetaHeader.includes('context-1m-2025-08-07')) {
      features.add('context-1m-2025-08-07')
      logger.info('📌 Adding context-1m-2025-08-07 from client request')
    }

    // 检查是否是 count_tokens 请求，如果是则添加 token-counting-2024-11-01
    const isCountTokens =
      requestOptions.customPath && requestOptions.customPath.includes('count_tokens')
    if (isCountTokens) {
      features.add('token-counting-2024-11-01')
      logger.debug('🔢 Adding token-counting-2024-11-01 for count_tokens request')
    }

    // 按照固定顺序排列 features
    const orderedFeatures = []
    for (const feature of this.FEATURE_ORDER) {
      if (features.has(feature)) {
        orderedFeatures.push(feature)
      }
    }

    // 添加任何不在预定义顺序中的 features（保持向后兼容）
    for (const feature of features) {
      if (!this.FEATURE_ORDER.includes(feature)) {
        orderedFeatures.push(feature)
      }
    }

    // 构建最终的 header
    const result = orderedFeatures.join(',')

    if (result) {
      logger.debug(`🏷️ Beta header for model ${model}: ${result}`)
    }

    return result || null
  }

  /**
   * 判断某个功能是否应该包含在给定模型的请求中
   * @param {string} feature - beta 功能名称
   * @param {string} model - 模型名称
   * @returns {boolean}
   */
  static shouldIncludeFeature(feature, model) {
    const rule = this.FEATURE_RULES[feature]

    // 如果没有规则，默认包含
    if (!rule) {
      return true
    }

    // 始终包含的功能
    if (rule.alwaysInclude) {
      return true
    }

    // 检查特定模型列表
    if (rule.models) {
      const included = rule.models.includes(model)
      if (!included && feature === 'interleaved-thinking-2025-05-14') {
        logger.debug(
          `⚠️ Excluding ${feature} for model ${model} (only for: ${rule.models.join(', ')})`
        )
      }
      return included
    }

    // 检查模型名称模式
    if (rule.patterns) {
      const matched = rule.patterns.some((pattern) => pattern.test(model))
      if (!matched && feature === 'claude-code-20250219') {
        logger.debug(`⚠️ Excluding ${feature} for model ${model} (only for sonnet/opus series)`)
      }
      return matched
    }

    return true
  }

  /**
   * 从请求选项中获取 beta header
   * @param {string} model - 模型名称
   * @param {object} requestOptions - 请求选项
   * @param {object} clientHeaders - 客户端请求头
   * @returns {string|null}
   */
  static getBetaHeader(model, requestOptions, clientHeaders) {
    // 使用请求选项中的 betaHeader 或从 config 读取默认值
    const baseBetaHeader =
      requestOptions?.betaHeader !== undefined
        ? requestOptions.betaHeader
        : config.claude.betaHeader

    // 获取客户端的 beta header
    const clientBetaHeader = clientHeaders?.['anthropic-beta'] || ''

    // 构建最终的 beta header，传递 requestOptions 以检测 count_tokens 请求
    return this.buildBetaHeader(model, baseBetaHeader, clientBetaHeader, requestOptions)
  }
}

module.exports = BetaHeaderManager
