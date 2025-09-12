/**
 * 请求Dump工具
 * 用于记录Claude API请求的原始和最终版本
 */

const fs = require('fs').promises
const path = require('path')
const logger = require('./logger')

class RequestDumper {
  constructor() {
    this.dumpsBasePath = path.join(process.cwd(), 'logs', 'dumps')
  }

  /**
   * 检查是否应该启用dump
   * @returns {boolean} 是否应该dump
   */
  shouldDump() {
    // 获取当前日志级别
    const currentLevel = logger.level
    
    // Winston日志级别数值映射
    const levelValues = {
      error: 0,
      warn: 1,
      info: 2,
      http: 3,
      verbose: 4,
      debug: 5,
      silly: 6
    }
    
    // 当前级别数值 >= info(2) 时启用dump
    // 即：info、http、verbose、debug、silly级别时启用
    const currentLevelValue = levelValues[currentLevel] !== undefined ? levelValues[currentLevel] : 2
    return currentLevelValue >= levelValues.info
  }

  /**
   * 确保dump目录存在
   * @param {string} model - 模型名称
   * @returns {Promise<string>} 目录路径
   */
  async ensureDumpDirectory(model) {
    const modelDir = path.join(this.dumpsBasePath, model)
    try {
      await fs.mkdir(modelDir, { recursive: true })
      return modelDir
    } catch (error) {
      logger.error('❌ Failed to create dump directory:', error)
      throw error
    }
  }

  /**
   * 生成dump文件名
   * @param {string} type - 'original' 或 'final'
   * @returns {string} 文件名
   */
  generateFileName(type) {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const hours = String(now.getHours()).padStart(2, '0')
    const minutes = String(now.getMinutes()).padStart(2, '0')
    const seconds = String(now.getSeconds()).padStart(2, '0')
    const milliseconds = String(now.getMilliseconds()).padStart(3, '0')

    return `${year}${month}${day}_${hours}${minutes}${seconds}_${milliseconds}_${type}.log`
  }

  /**
   * 格式化dump内容
   * @param {Object} data - dump数据
   * @returns {string} 格式化的内容
   */
  formatDumpContent(data) {
    const {
      type,
      model,
      timestamp,
      url,
      accountId,
      apiKey,
      sessionHash,
      headers,
      body,
      metadata = {}
    } = data

    let content = '=== REQUEST DUMP ===\n'
    content += `Timestamp: ${new Date(timestamp).toISOString()}\n`
    content += `Type: ${type.toUpperCase()}\n`
    content += `Model: ${model || 'unknown'}\n`

    if (url) {
      content += `Request URL: ${url}\n`
    }

    if (accountId) {
      content += `Account ID: ${accountId}\n`
    }

    if (apiKey) {
      const maskedKey = apiKey.key ? `${apiKey.key.substring(0, 8)}...` : 'unknown'
      content += `API Key: ${maskedKey} (name: ${apiKey.name || 'unnamed'})\n`
    }

    if (sessionHash) {
      content += `Session Hash: ${sessionHash}\n`
    }

    content += '\n=== HEADERS ===\n'
    content += JSON.stringify(this.sanitizeHeaders(headers), null, 2)

    content += '\n\n=== REQUEST BODY ===\n'
    content += JSON.stringify(body, null, 2)

    if (Object.keys(metadata).length > 0) {
      content += '\n\n=== METADATA ===\n'
      Object.entries(metadata).forEach(([key, value]) => {
        content += `${key}: ${value}\n`
      })
    }

    content += '\n=== END DUMP ===\n'

    return content
  }

  /**
   * 清理敏感header信息
   * @param {Object} headers - 原始headers
   * @returns {Object} 清理后的headers
   */
  sanitizeHeaders(headers) {
    if (!headers) {
      return {}
    }

    const sanitized = { ...headers }
    const sensitiveKeys = ['authorization', 'x-api-key', 'cookie', 'proxy-authorization']

    Object.keys(sanitized).forEach((key) => {
      const lowerKey = key.toLowerCase()
      if (sensitiveKeys.includes(lowerKey)) {
        if (lowerKey === 'authorization' && sanitized[key]) {
          // 保留Bearer前缀，mask token
          if (sanitized[key].startsWith('Bearer ')) {
            sanitized[key] = 'Bearer [MASKED]'
          } else {
            sanitized[key] = '[MASKED]'
          }
        } else {
          sanitized[key] = '[MASKED]'
        }
      }
    })

    return sanitized
  }

  /**
   * Dump原始请求
   * @param {Object} params - dump参数
   */
  async dumpOriginalRequest(params) {
    // 检查是否应该启用dump
    if (!this.shouldDump()) {
      return
    }

    const { model, url, headers, body, apiKey, sessionHash } = params

    try {
      const modelName = model || body?.model || 'unknown-model'
      const dirPath = await this.ensureDumpDirectory(modelName)
      const fileName = this.generateFileName('original')
      const filePath = path.join(dirPath, fileName)

      const dumpData = {
        type: 'original',
        model: modelName,
        timestamp: Date.now(),
        url,
        apiKey,
        sessionHash,
        headers,
        body,
        metadata: {
          'Stream Mode': body?.stream ? 'true' : 'false',
          'Max Tokens': body?.max_tokens || 'not specified'
        }
      }

      const content = this.formatDumpContent(dumpData)
      await fs.writeFile(filePath, content, 'utf8')

      logger.debug(`📝 Original request dumped to: ${fileName}`)
    } catch (error) {
      logger.error('❌ Failed to dump original request:', error)
      // 不抛出错误，避免影响正常请求处理
    }
  }

  /**
   * Dump最终请求
   * @param {Object} params - dump参数
   */
  async dumpFinalRequest(params) {
    // 检查是否应该启用dump
    if (!this.shouldDump()) {
      return
    }

    const { model, url, headers, body, accountId, proxyInfo, sessionHash } = params

    try {
      const modelName = model || body?.model || 'unknown-model'
      const dirPath = await this.ensureDumpDirectory(modelName)
      const fileName = this.generateFileName('final')
      const filePath = path.join(dirPath, fileName)

      const metadata = {
        'Stream Mode': body?.stream ? 'true' : 'false',
        'Max Tokens': body?.max_tokens || 'not specified'
      }

      if (proxyInfo) {
        metadata['Has Proxy'] = 'true'
        metadata['Proxy Type'] = proxyInfo.type || 'unknown'
      } else {
        metadata['Has Proxy'] = 'false'
      }

      const dumpData = {
        type: 'final',
        model: modelName,
        timestamp: Date.now(),
        url,
        accountId,
        sessionHash,
        headers,
        body,
        metadata
      }

      const content = this.formatDumpContent(dumpData)
      await fs.writeFile(filePath, content, 'utf8')

      logger.debug(`📝 Final request dumped to: ${fileName}`)
    } catch (error) {
      logger.error('❌ Failed to dump final request:', error)
      // 不抛出错误，避免影响正常请求处理
    }
  }

  /**
   * 清理旧的dump文件（可选功能）
   * @param {number} daysToKeep - 保留天数
   */
  async cleanOldDumps(daysToKeep = 7) {
    try {
      const cutoffTime = Date.now() - daysToKeep * 24 * 60 * 60 * 1000
      const models = await fs.readdir(this.dumpsBasePath)

      for (const model of models) {
        const modelDir = path.join(this.dumpsBasePath, model)
        const stats = await fs.stat(modelDir)

        if (stats.isDirectory()) {
          const files = await fs.readdir(modelDir)

          for (const file of files) {
            const filePath = path.join(modelDir, file)
            const fileStats = await fs.stat(filePath)

            if (fileStats.mtime.getTime() < cutoffTime) {
              await fs.unlink(filePath)
              logger.debug(`🗑️ Deleted old dump file: ${file}`)
            }
          }
        }
      }
    } catch (error) {
      logger.error('❌ Failed to clean old dumps:', error)
    }
  }
}

// 导出单例实例
module.exports = new RequestDumper()
