const { SocksProxyAgent } = require('socks-proxy-agent')
const { HttpsProxyAgent } = require('https-proxy-agent')
const logger = require('./logger')
const config = require('../../config/config')

/**
 * 统一的代理创建工具
 * 支持 SOCKS5 和 HTTP/HTTPS 代理，可配置 IPv4/IPv6
 */
class ProxyHelper {
  static agentCache = new Map()
  static cacheStats = { hits: 0, misses: 0 }

  /**
   * 创建代理 Agent
   * @param {object|string|null} proxyConfig - 代理配置对象或 JSON 字符串
   * @param {object} options - 额外选项
   * @param {boolean|number} options.useIPv4 - 是否使用 IPv4 (true=IPv4, false=IPv6, undefined=auto)
   * @returns {Agent|null} 代理 Agent 实例或 null
   */
  static createProxyAgent(proxyConfig, options = {}) {
    if (!proxyConfig) {
      return null
    }

    try {
      // 解析代理配置
      const proxy = typeof proxyConfig === 'string' ? JSON.parse(proxyConfig) : proxyConfig

      // 验证必要字段
      if (!proxy.type || !proxy.host || !proxy.port) {
        logger.warn('⚠️ Invalid proxy configuration: missing required fields (type, host, port)')
        return null
      }

      // 生成缓存键
      const cacheKey = `${proxy.type}://${proxy.host}:${proxy.port}:${proxy.username || ''}`

      // 尝试从缓存获取
      if (ProxyHelper.agentCache.has(cacheKey)) {
        ProxyHelper.cacheStats.hits++
        const cachedAgent = ProxyHelper.agentCache.get(cacheKey)
        logger.debug(
          `🎯 Proxy agent cache hit [${ProxyHelper.cacheStats.hits}/${ProxyHelper.cacheStats.hits + ProxyHelper.cacheStats.misses}]`
        )
        return cachedAgent
      }

      // 获取 IPv4/IPv6 配置
      const useIPv4 = ProxyHelper._getIPFamilyPreference(options.useIPv4)

      // 构建认证信息
      const auth = proxy.username && proxy.password ? `${proxy.username}:${proxy.password}@` : ''

      // 根据代理类型创建 Agent
      let agent = null

      if (proxy.type === 'socks5') {
        const socksUrl = `socks5h://${auth}${proxy.host}:${proxy.port}`
        const socksOptions = {
          keepAlive: true,
          keepAliveMsecs: 30000, // 30秒心跳
          maxSockets: 50,
          maxFreeSockets: 10,
          timeout: 30000
        }

        // 设置 IP 协议族（如果指定）
        if (useIPv4 !== null) {
          socksOptions.family = useIPv4 ? 4 : 6
        }

        agent = new SocksProxyAgent(socksUrl, socksOptions)
      } else if (proxy.type === 'http' || proxy.type === 'https') {
        const proxyUrl = `${proxy.type}://${auth}${proxy.host}:${proxy.port}`

        const httpOptions = {
          keepAlive: true,
          keepAliveMsecs: 30000, // 30秒心跳
          maxSockets: 50,
          maxFreeSockets: 10,
          timeout: 30000
        }

        // HttpsProxyAgent 支持 family 参数（通过底层的 agent-base）
        if (useIPv4 !== null) {
          httpOptions.family = useIPv4 ? 4 : 6
        }

        agent = new HttpsProxyAgent(proxyUrl, httpOptions)
      } else {
        logger.warn(`⚠️ Unsupported proxy type: ${proxy.type}`)
        return null
      }

      // 添加到缓存
      if (agent) {
        ProxyHelper.agentCache.set(cacheKey, agent)
        ProxyHelper.cacheStats.misses++
        logger.info(
          `✨ Created and cached new proxy agent [Cache size: ${ProxyHelper.agentCache.size}]`
        )
      }

      return agent
    } catch (error) {
      logger.warn('⚠️ Failed to create proxy agent:', error.message)
      return null
    }
  }

  /**
   * 获取 IP 协议族偏好设置
   * @param {boolean|number|string} preference - 用户偏好设置
   * @returns {boolean|null} true=IPv4, false=IPv6, null=auto
   * @private
   */
  static _getIPFamilyPreference(preference) {
    // 如果没有指定偏好，使用配置文件或默认值
    if (preference === undefined) {
      // 从配置文件读取默认设置，默认使用 IPv4
      const defaultUseIPv4 = config.proxy?.useIPv4
      if (defaultUseIPv4 !== undefined) {
        return defaultUseIPv4
      }
      // 默认值：IPv4（兼容性更好）
      return true
    }

    // 处理各种输入格式
    if (typeof preference === 'boolean') {
      return preference
    }
    if (typeof preference === 'number') {
      return preference === 4 ? true : preference === 6 ? false : null
    }
    if (typeof preference === 'string') {
      const lower = preference.toLowerCase()
      if (lower === 'ipv4' || lower === '4') {
        return true
      }
      if (lower === 'ipv6' || lower === '6') {
        return false
      }
      if (lower === 'auto' || lower === 'both') {
        return null
      }
    }

    // 无法识别的值，返回默认（IPv4）
    return true
  }

  /**
   * 验证代理配置
   * @param {object|string} proxyConfig - 代理配置
   * @returns {boolean} 是否有效
   */
  static validateProxyConfig(proxyConfig) {
    if (!proxyConfig) {
      return false
    }

    try {
      const proxy = typeof proxyConfig === 'string' ? JSON.parse(proxyConfig) : proxyConfig

      // 检查必要字段
      if (!proxy.type || !proxy.host || !proxy.port) {
        return false
      }

      // 检查支持的类型
      if (!['socks5', 'http', 'https'].includes(proxy.type)) {
        return false
      }

      // 检查端口范围
      const port = parseInt(proxy.port)
      if (isNaN(port) || port < 1 || port > 65535) {
        return false
      }

      return true
    } catch (error) {
      return false
    }
  }

  /**
   * 获取代理配置的描述信息
   * @param {object|string} proxyConfig - 代理配置
   * @returns {string} 代理描述
   */
  static getProxyDescription(proxyConfig) {
    if (!proxyConfig) {
      return 'No proxy'
    }

    try {
      const proxy = typeof proxyConfig === 'string' ? JSON.parse(proxyConfig) : proxyConfig
      const hasAuth = proxy.username && proxy.password
      return `${proxy.type}://${proxy.host}:${proxy.port}${hasAuth ? ' (with auth)' : ''}`
    } catch (error) {
      return 'Invalid proxy config'
    }
  }

  /**
   * 脱敏代理配置信息用于日志记录
   * @param {object|string} proxyConfig - 代理配置
   * @returns {string} 脱敏后的代理信息
   */
  static maskProxyInfo(proxyConfig) {
    if (!proxyConfig) {
      return 'No proxy'
    }

    try {
      const proxy = typeof proxyConfig === 'string' ? JSON.parse(proxyConfig) : proxyConfig

      let proxyDesc = `${proxy.type}://${proxy.host}:${proxy.port}`

      // 如果有认证信息，进行脱敏处理
      if (proxy.username && proxy.password) {
        const maskedUsername =
          proxy.username.length <= 2
            ? proxy.username
            : proxy.username[0] +
              '*'.repeat(Math.max(1, proxy.username.length - 2)) +
              proxy.username.slice(-1)
        const maskedPassword = '*'.repeat(Math.min(8, proxy.password.length))
        proxyDesc += ` (auth: ${maskedUsername}:${maskedPassword})`
      }

      return proxyDesc
    } catch (error) {
      return 'Invalid proxy config'
    }
  }

  /**
   * 清理代理缓存
   * @param {boolean} force - 是否强制清理所有缓存
   */
  static clearCache(force = false) {
    if (force) {
      const { size } = ProxyHelper.agentCache
      ProxyHelper.agentCache.clear()
      ProxyHelper.cacheStats = { hits: 0, misses: 0 }
      logger.info(`🧹 Cleared ${size} cached proxy agents`)
    }
  }

  /**
   * 获取缓存统计信息
   * @returns {object} 缓存统计
   */
  static getCacheStats() {
    const total = ProxyHelper.cacheStats.hits + ProxyHelper.cacheStats.misses
    return {
      cacheSize: ProxyHelper.agentCache.size,
      hits: ProxyHelper.cacheStats.hits,
      misses: ProxyHelper.cacheStats.misses,
      hitRate: total > 0 ? `${((ProxyHelper.cacheStats.hits / total) * 100).toFixed(2)}%` : '0%'
    }
  }

  /**
   * 创建代理 Agent（兼容旧的函数接口）
   * @param {object|string|null} proxyConfig - 代理配置
   * @param {boolean} useIPv4 - 是否使用 IPv4
   * @returns {Agent|null} 代理 Agent 实例或 null
   * @deprecated 使用 createProxyAgent 替代
   */
  static createProxy(proxyConfig, useIPv4 = true) {
    logger.warn('⚠️ ProxyHelper.createProxy is deprecated, use createProxyAgent instead')
    return ProxyHelper.createProxyAgent(proxyConfig, { useIPv4 })
  }
}

module.exports = ProxyHelper
