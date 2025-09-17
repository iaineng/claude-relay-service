const http2 = require('http2')
const tls = require('tls')
const { URL } = require('url')
const logger = require('./logger')
const zlib = require('zlib')

/**
 * HTTP/2客户端封装
 * 提供统一的HTTP/2请求接口，支持代理和连接池管理
 */
class Http2Client {
  constructor() {
    // 会话池: hostname -> { session, lastUsed }
    this.sessions = new Map()
    // 会话超时时间（5分钟）
    this.sessionTimeout = 5 * 60 * 1000
    // 定期清理过期会话
    this.startCleanupTimer()
  }

  /**
   * 启动定期清理定时器
   */
  startCleanupTimer() {
    setInterval(() => {
      const now = Date.now()
      for (const [hostname, sessionInfo] of this.sessions.entries()) {
        if (now - sessionInfo.lastUsed > this.sessionTimeout) {
          logger.debug(`🧹 Cleaning up HTTP/2 session for ${hostname}`)
          try {
            sessionInfo.session.close()
          } catch (e) {
            // 忽略关闭错误
          }
          this.sessions.delete(hostname)
        }
      }
    }, 60000) // 每分钟清理一次
  }

  /**
   * 获取或创建HTTP/2会话
   * @param {string} hostname - 目标主机名
   * @param {object} options - 连接选项
   * @returns {http2.ClientHttp2Session} HTTP/2会话
   */
  async getSession(hostname, options = {}) {
    const sessionKey = `${hostname}:${options.port || 443}`

    // 检查现有会话
    if (this.sessions.has(sessionKey)) {
      const sessionInfo = this.sessions.get(sessionKey)
      if (!sessionInfo.session.closed && !sessionInfo.session.destroyed) {
        sessionInfo.lastUsed = Date.now()
        logger.debug(`♻️ Reusing HTTP/2 session for ${sessionKey}`)
        return sessionInfo.session
      } else {
        // 会话已关闭，移除
        this.sessions.delete(sessionKey)
      }
    }

    // 创建新会话
    logger.info(`🔌 Creating new HTTP/2 session for ${sessionKey}`)
    const session = await this.createSession(hostname, options)

    // 监听会话事件
    session.on('error', (err) => {
      logger.error(`❌ HTTP/2 session error for ${sessionKey}:`, err.message)
      this.sessions.delete(sessionKey)
    })

    session.on('goaway', () => {
      logger.info(`👋 HTTP/2 session received GOAWAY for ${sessionKey}`)
      this.sessions.delete(sessionKey)
    })

    session.on('close', () => {
      logger.debug(`🔒 HTTP/2 session closed for ${sessionKey}`)
      this.sessions.delete(sessionKey)
    })

    // 存储会话
    this.sessions.set(sessionKey, {
      session,
      lastUsed: Date.now()
    })

    return session
  }

  /**
   * 创建新的HTTP/2会话
   * @param {string} hostname - 目标主机名
   * @param {object} options - 连接选项
   * @returns {Promise<http2.ClientHttp2Session>} HTTP/2会话
   */
  createSession(hostname, options = {}) {
    return new Promise((resolve, reject) => {
      const connectOptions = {
        ...options,
        ALPNProtocols: ['h2'],
        servername: hostname
      }

      // 如果有代理agent，需要特殊处理
      if (options.agent) {
        // 使用代理的createConnection方法建立隧道
        connectOptions.createConnection = () =>
          new Promise((connResolve, connReject) => {
            // 代理agent会处理连接
            const socket = options.agent.createConnection(
              { host: hostname, port: options.port || 443 },
              (err, sock) => {
                if (err) {
                  connReject(err)
                } else {
                  // 在代理隧道上建立TLS连接
                  const tlsSocket = tls.connect({
                    socket: sock,
                    servername: hostname,
                    ALPNProtocols: ['h2']
                  })

                  tlsSocket.once('secureConnect', () => {
                    connResolve(tlsSocket)
                  })

                  tlsSocket.once('error', connReject)
                }
              }
            )

            if (socket && !socket.connecting) {
              // 同步返回的socket
              const tlsSocket = tls.connect({
                socket,
                servername: hostname,
                ALPNProtocols: ['h2']
              })

              tlsSocket.once('secureConnect', () => {
                connResolve(tlsSocket)
              })

              tlsSocket.once('error', connReject)
            }
          })
      }

      const url = `https://${hostname}:${options.port || 443}`
      const session = http2.connect(url, connectOptions)

      session.once('connect', () => {
        logger.info(`✅ HTTP/2 session connected to ${hostname}`)
        resolve(session)
      })

      session.once('error', (err) => {
        logger.error(`❌ Failed to create HTTP/2 session for ${hostname}:`, err.message)
        reject(err)
      })

      // 设置超时
      session.setTimeout(options.timeout || 30000, () => {
        session.close()
        reject(new Error(`HTTP/2 session timeout for ${hostname}`))
      })
    })
  }

  /**
   * 发送HTTP/2请求（Promise封装）
   * @param {string} url - 请求URL
   * @param {object} options - 请求选项
   * @returns {Promise<object>} 响应对象
   */
  async request(url, options = {}) {
    const parsedUrl = new URL(url)
    const { hostname } = parsedUrl
    const pathname = parsedUrl.pathname + parsedUrl.search

    try {
      // 获取或创建会话
      const session = await this.getSession(hostname, {
        port: parsedUrl.port || 443,
        agent: options.agent,
        timeout: options.timeout
      })

      // 构建HTTP/2请求头
      const headers = {
        ':method': options.method || 'GET',
        ':path': pathname,
        ':scheme': 'https',
        ':authority': hostname,
        ...this.normalizeHeaders(options.headers || {})
      }

      logger.debug(`🚀 HTTP/2 request: ${headers[':method']} ${url}`)

      return new Promise((resolve, reject) => {
        const stream = session.request(headers)
        let responseHeaders = {}
        let responseData = Buffer.alloc(0)
        let statusCode = null

        // 处理响应头
        stream.on('response', (hdrs) => {
          statusCode = hdrs[':status']
          responseHeaders = hdrs
          logger.debug(`📥 HTTP/2 response status: ${statusCode}`)
        })

        // 收集响应数据
        stream.on('data', (chunk) => {
          responseData = Buffer.concat([responseData, chunk])
        })

        // 请求完成
        stream.on('end', () => {
          // 解压响应（如果需要）
          let body = responseData
          const encoding = responseHeaders['content-encoding']

          if (encoding === 'gzip') {
            try {
              body = zlib.gunzipSync(responseData)
            } catch (e) {
              logger.error('Failed to decompress gzip response:', e)
            }
          } else if (encoding === 'deflate') {
            try {
              body = zlib.inflateSync(responseData)
            } catch (e) {
              logger.error('Failed to decompress deflate response:', e)
            }
          } else if (encoding === 'br') {
            try {
              body = zlib.brotliDecompressSync(responseData)
            } catch (e) {
              logger.error('Failed to decompress brotli response:', e)
            }
          }

          resolve({
            statusCode: parseInt(statusCode),
            headers: responseHeaders,
            body: body.toString('utf8'),
            raw: body
          })
        })

        // 错误处理
        stream.on('error', (err) => {
          logger.error(`❌ HTTP/2 stream error: ${err.message}`)
          reject(err)
        })

        stream.on('timeout', () => {
          stream.close(http2.constants.NGHTTP2_CANCEL)
          reject(new Error('HTTP/2 request timeout'))
        })

        // 设置超时
        if (options.timeout) {
          stream.setTimeout(options.timeout)
        }

        // 写入请求体（如果有）
        if (options.body) {
          const bodyData =
            typeof options.body === 'string' ? options.body : JSON.stringify(options.body)
          stream.end(bodyData)
        } else {
          stream.end()
        }
      })
    } catch (error) {
      logger.error(`❌ HTTP/2 request failed: ${error.message}`)
      throw error
    }
  }

  /**
   * 发送HTTP/2流式请求
   * @param {string} url - 请求URL
   * @param {object} options - 请求选项
   * @returns {http2.ClientHttp2Stream} HTTP/2流
   */
  async stream(url, options = {}) {
    const parsedUrl = new URL(url)
    const { hostname } = parsedUrl
    const pathname = parsedUrl.pathname + parsedUrl.search

    // 获取或创建会话
    const session = await this.getSession(hostname, {
      port: parsedUrl.port || 443,
      agent: options.agent,
      timeout: options.timeout
    })

    // 构建HTTP/2请求头
    const headers = {
      ':method': options.method || 'GET',
      ':path': pathname,
      ':scheme': 'https',
      ':authority': hostname,
      ...this.normalizeHeaders(options.headers || {})
    }

    logger.debug(`🌊 HTTP/2 stream request: ${headers[':method']} ${url}`)

    // 创建流
    const stream = session.request(headers)

    // 写入请求体（如果有）
    if (options.body) {
      const bodyData =
        typeof options.body === 'string' ? options.body : JSON.stringify(options.body)
      stream.end(bodyData)
    }

    return stream
  }

  /**
   * 标准化HTTP头部（转换为小写）
   * @param {object} headers - 原始头部
   * @returns {object} 标准化的头部
   */
  normalizeHeaders(headers) {
    const normalized = {}
    for (const [key, value] of Object.entries(headers)) {
      // 跳过HTTP/2伪头部
      if (!key.startsWith(':')) {
        // HTTP/2要求头部名称小写
        normalized[key.toLowerCase()] = value
      }
    }
    return normalized
  }

  /**
   * 关闭所有会话
   */
  closeAll() {
    logger.info('🔚 Closing all HTTP/2 sessions')
    for (const sessionInfo of this.sessions.values()) {
      try {
        sessionInfo.session.close()
      } catch (e) {
        // 忽略错误
      }
    }
    this.sessions.clear()
  }
}

// 导出单例
module.exports = new Http2Client()
