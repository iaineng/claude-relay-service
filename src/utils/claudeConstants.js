/**
 * Claude API 请求常量配置
 * 集中管理所有Claude相关的固定值
 */

module.exports = {
  // 固定的User-Agent
  USER_AGENT: 'claude-cli/1.0.110 (external, cli)',

  // API版本
  API_VERSION: '2023-06-01',

  // 固定的请求头配置（非流式请求）
  FIXED_HEADERS: {
    'Content-Type': 'application/json',
    'anthropic-version': '2023-06-01',
    accept: 'application/json',
    'x-stainless-retry-count': '0',
    'x-stainless-timeout': '600',
    'x-stainless-lang': 'js',
    'x-stainless-package-version': '0.60.0',
    'x-stainless-os': 'MacOS',
    'x-stainless-arch': 'arm64',
    'x-stainless-runtime': 'node',
    'x-stainless-runtime-version': 'v20.18.1',
    'anthropic-dangerous-direct-browser-access': 'true',
    'x-app': 'cli',
    'accept-language': '*',
    'sec-fetch-mode': 'cors',
    'accept-encoding': 'gzip, deflate'
  },

  // 流式请求专用的额外header
  STREAM_HEADER: {
    'x-stainless-helper-method': 'stream'
  }
}
