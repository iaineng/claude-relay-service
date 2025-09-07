/**
 * 随机请求头生成器
 * 用于封号模式下生成随机化的请求头，避免被检测
 */

class RandomHeaderGenerator {
  constructor() {
    // User-Agent 生成器映射
    this.userAgentGenerators = {
      claudeCli: this.generateClaudeCLI.bind(this),
      browser: this.generateBrowserUA.bind(this),
      node: this.generateNodeUA.bind(this),
      mobile: this.generateMobileUA.bind(this),
      other: this.generateOtherUA.bind(this)
    }
  }

  /**
   * 生成完整的随机请求头集合
   */
  generate() {
    // 随机选择 User-Agent 类型
    const types = Object.keys(this.userAgentGenerators)
    const selectedType = types[Math.floor(Math.random() * types.length)]
    const userAgent = this.userAgentGenerators[selectedType]()

    // 生成对应的运行时信息
    const runtimeInfo = this.generateRuntimeInfo(selectedType)

    return {
      userAgent,
      userAgentType: selectedType,
      packageVersion: this.generatePackageVersion(),
      os: this.generateOS(),
      arch: this.generateArch(),
      runtime: runtimeInfo.runtime,
      runtimeVersion: runtimeInfo.version
    }
  }

  /**
   * 生成 Claude CLI 格式的 User-Agent
   */
  generateClaudeCLI() {
    const majorVersion = Math.floor(Math.random() * 2) // 0-1
    const minorVersion = Math.floor(Math.random() * 100) // 0-99
    const patchVersion = Math.floor(Math.random() * 1000) // 0-999
    const version = `${majorVersion}.${minorVersion}.${patchVersion}`

    const suffixes = ['(external, cli)', '(internal, cli)', '(cli)']
    const suffix = suffixes[Math.floor(Math.random() * suffixes.length)]

    return `claude-cli/${version} ${suffix}`
  }

  /**
   * 生成浏览器 User-Agent
   */
  generateBrowserUA() {
    const browsers = [
      // Chrome
      () => {
        const chromeVersion = 100 + Math.floor(Math.random() * 30)
        const osList = [
          'Windows NT 10.0; Win64; x64',
          'Macintosh; Intel Mac OS X 10_15_7',
          'X11; Linux x86_64',
          'Windows NT 11.0; Win64; x64',
          'Macintosh; Intel Mac OS X 14_0'
        ]
        const os = osList[Math.floor(Math.random() * osList.length)]
        return `Mozilla/5.0 (${os}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion}.0.${Math.floor(Math.random() * 9999)}.${Math.floor(Math.random() * 999)} Safari/537.36`
      },
      // Firefox
      () => {
        const firefoxVersion = 100 + Math.floor(Math.random() * 25)
        const osList = [
          'Windows NT 10.0; Win64; x64',
          'Macintosh; Intel Mac OS X 14.0',
          'X11; Linux x86_64',
          'X11; Ubuntu; Linux x86_64'
        ]
        const os = osList[Math.floor(Math.random() * osList.length)]
        return `Mozilla/5.0 (${os}; rv:${firefoxVersion}.0) Gecko/20100101 Firefox/${firefoxVersion}.0`
      },
      // Safari
      () => {
        const safariVersion = 15 + Math.floor(Math.random() * 3)
        const webkitVersion = 605 + Math.floor(Math.random() * 10)
        return `Mozilla/5.0 (Macintosh; Intel Mac OS X 14_${Math.floor(Math.random() * 5)}) AppleWebKit/${webkitVersion}.1.15 (KHTML, like Gecko) Version/${safariVersion}.${Math.floor(Math.random() * 6)} Safari/${webkitVersion}.1.15`
      },
      // Edge
      () => {
        const edgeVersion = 100 + Math.floor(Math.random() * 30)
        const os = 'Windows NT 10.0; Win64; x64'
        return `Mozilla/5.0 (${os}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${edgeVersion}.0.0.0 Safari/537.36 Edg/${edgeVersion}.0.${Math.floor(Math.random() * 2000)}.${Math.floor(Math.random() * 100)}`
      }
    ]

    const generator = browsers[Math.floor(Math.random() * browsers.length)]
    return generator()
  }

  /**
   * 生成 Node.js 客户端 User-Agent
   */
  generateNodeUA() {
    const nodeClients = [
      () =>
        `node-fetch/${2 + Math.floor(Math.random() * 2)}.${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 10)}`,
      () =>
        `axios/${0 + Math.floor(Math.random() * 2)}.${Math.floor(Math.random() * 30)}.${Math.floor(Math.random() * 10)}`,
      () =>
        `undici/${5 + Math.floor(Math.random() * 2)}.${Math.floor(Math.random() * 30)}.${Math.floor(Math.random() * 10)}`,
      () =>
        `Node.js/v${16 + Math.floor(Math.random() * 7)}.${Math.floor(Math.random() * 20)}.${Math.floor(Math.random() * 10)}`,
      () =>
        `got/${11 + Math.floor(Math.random() * 3)}.${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 10)}`,
      () =>
        `superagent/${7 + Math.floor(Math.random() * 3)}.${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 10)}`
    ]

    const generator = nodeClients[Math.floor(Math.random() * nodeClients.length)]
    return generator()
  }

  /**
   * 生成移动端 User-Agent
   */
  generateMobileUA() {
    const mobileClients = [
      // Android OkHttp
      () =>
        `okhttp/${3 + Math.floor(Math.random() * 2)}.${Math.floor(Math.random() * 15)}.${Math.floor(Math.random() * 10)}`,
      // Android Dalvik
      () => {
        const androidVersion = 11 + Math.floor(Math.random() * 4)
        const pixelModel = 5 + Math.floor(Math.random() * 3)
        return `Dalvik/2.1.0 (Linux; U; Android ${androidVersion}; Pixel ${pixelModel} Build/UPB2.${Math.floor(Math.random() * 999999)}.${Math.floor(Math.random() * 999)})`
      },
      // iOS Claude App
      () =>
        `Claude/1.0 CFNetwork/${1400 + Math.floor(Math.random() * 100)}.0.${Math.floor(Math.random() * 10)} Darwin/${22 + Math.floor(Math.random() * 3)}.${Math.floor(Math.random() * 10)}.0`,
      // iOS Safari
      () => {
        const iosVersion = 15 + Math.floor(Math.random() * 3)
        const webkitVersion = 605 + Math.floor(Math.random() * 10)
        return `Mozilla/5.0 (iPhone; CPU iPhone OS ${iosVersion}_${Math.floor(Math.random() * 6)} like Mac OS X) AppleWebKit/${webkitVersion}.1.15 (KHTML, like Gecko) Version/${iosVersion}.0 Mobile/15E148 Safari/604.1`
      }
    ]

    const generator = mobileClients[Math.floor(Math.random() * mobileClients.length)]
    return generator()
  }

  /**
   * 生成其他类型的 User-Agent
   */
  generateOtherUA() {
    const otherClients = [
      () =>
        `python-requests/${2 + Math.floor(Math.random() * 2)}.${Math.floor(Math.random() * 32)}.${Math.floor(Math.random() * 10)}`,
      () =>
        `curl/${7 + Math.floor(Math.random() * 2)}.${Math.floor(Math.random() * 90)}.${Math.floor(Math.random() * 10)}`,
      () =>
        `Postman Runtime/${7 + Math.floor(Math.random() * 2)}.${Math.floor(Math.random() * 40)}.${Math.floor(Math.random() * 10)}`,
      () =>
        `insomnia/${2023 + Math.floor(Math.random() * 3)}.${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 10)}`,
      () =>
        `HTTPie/${3 + Math.floor(Math.random() * 2)}.${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 10)}`,
      () =>
        `RestSharp/${106 + Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 20)}.${Math.floor(Math.random() * 10)}`,
      () => `Java/${11 + Math.floor(Math.random() * 11)}.0.${Math.floor(Math.random() * 20)}`,
      () => `Go-http-client/${1 + Math.floor(Math.random() * 2)}.${Math.floor(Math.random() * 2)}`
    ]

    const generator = otherClients[Math.floor(Math.random() * otherClients.length)]
    return generator()
  }

  /**
   * 根据 User-Agent 类型生成对应的运行时信息
   */
  generateRuntimeInfo(userAgentType) {
    switch (userAgentType) {
      case 'claudeCli':
      case 'node':
        return this.generateNodeRuntime()
      case 'browser':
        return this.generateBrowserRuntime()
      case 'mobile':
        return this.generateMobileRuntime()
      case 'other':
        return this.generateOtherRuntime()
      default:
        return { runtime: 'Unknown', version: 'Unknown' }
    }
  }

  /**
   * 生成 Node.js 运行时信息
   */
  generateNodeRuntime() {
    const majorVersion = 16 + Math.floor(Math.random() * 8) // v16 到 v23
    const minorVersion = Math.floor(Math.random() * 20)
    const patchVersion = Math.floor(Math.random() * 20)
    return {
      runtime: 'node',
      version: `v${majorVersion}.${minorVersion}.${patchVersion}`
    }
  }

  /**
   * 生成浏览器运行时信息
   */
  generateBrowserRuntime() {
    const browsers = [
      {
        runtime: 'browser:chrome',
        version: () =>
          `${100 + Math.floor(Math.random() * 30)}.0.${Math.floor(Math.random() * 9999)}.${Math.floor(Math.random() * 999)}`
      },
      {
        runtime: 'browser:firefox',
        version: () => `${100 + Math.floor(Math.random() * 25)}.0`
      },
      {
        runtime: 'browser:safari',
        version: () => `${15 + Math.floor(Math.random() * 3)}.${Math.floor(Math.random() * 6)}`
      },
      {
        runtime: 'browser:edge',
        version: () =>
          `${100 + Math.floor(Math.random() * 30)}.0.${Math.floor(Math.random() * 2000)}.${Math.floor(Math.random() * 100)}`
      }
    ]

    const browser = browsers[Math.floor(Math.random() * browsers.length)]
    return {
      runtime: browser.runtime,
      version: browser.version()
    }
  }

  /**
   * 生成移动端运行时信息
   */
  generateMobileRuntime() {
    const runtimes = [
      {
        runtime: 'android',
        version: () => `${11 + Math.floor(Math.random() * 4)}.0.0`
      },
      {
        runtime: 'ios',
        version: () => `${15 + Math.floor(Math.random() * 3)}.${Math.floor(Math.random() * 6)}`
      },
      {
        runtime: 'java',
        version: () => `${11 + Math.floor(Math.random() * 11)}.0.${Math.floor(Math.random() * 20)}`
      }
    ]

    const runtime = runtimes[Math.floor(Math.random() * runtimes.length)]
    return {
      runtime: runtime.runtime,
      version: runtime.version()
    }
  }

  /**
   * 生成其他运行时信息
   */
  generateOtherRuntime() {
    const runtimes = [
      {
        runtime: 'python',
        version: () => `${3}.${8 + Math.floor(Math.random() * 5)}.${Math.floor(Math.random() * 20)}`
      },
      {
        runtime: 'java',
        version: () => `${11 + Math.floor(Math.random() * 11)}.0.${Math.floor(Math.random() * 20)}`
      },
      {
        runtime: 'go',
        version: () =>
          `${1}.${19 + Math.floor(Math.random() * 4)}.${Math.floor(Math.random() * 10)}`
      },
      {
        runtime: 'dotnet',
        version: () => `${6 + Math.floor(Math.random() * 3)}.0.${Math.floor(Math.random() * 30)}`
      },
      {
        runtime: 'ruby',
        version: () => `${3}.${0 + Math.floor(Math.random() * 3)}.${Math.floor(Math.random() * 10)}`
      },
      {
        runtime: 'Unknown',
        version: () => 'Unknown'
      }
    ]

    const runtime = runtimes[Math.floor(Math.random() * runtimes.length)]
    return {
      runtime: runtime.runtime,
      version: runtime.version()
    }
  }

  /**
   * 生成操作系统信息
   */
  generateOS() {
    const osList = [
      'MacOS',
      'Windows',
      'Linux',
      'Unknown',
      'Darwin',
      'Win32',
      'Android',
      'iOS',
      'FreeBSD',
      'OpenBSD',
      'Ubuntu',
      'Debian',
      'CentOS',
      'RedHat',
      'Fedora',
      'SUSE'
    ]

    return osList[Math.floor(Math.random() * osList.length)]
  }

  /**
   * 生成架构信息
   */
  generateArch() {
    const archList = [
      'x64',
      'arm64',
      'x86',
      'Unknown',
      'aarch64',
      'armv7l',
      'ppc64',
      's390x',
      'mips',
      'mips64',
      'riscv64',
      'x86_64',
      'i386',
      'i686'
    ]

    return archList[Math.floor(Math.random() * archList.length)]
  }

  /**
   * 生成包版本号
   */
  generatePackageVersion() {
    const major = Math.floor(Math.random() * 2) // 0-1
    const minor = Math.floor(Math.random() * 100) // 0-99
    const patch = Math.floor(Math.random() * 100) // 0-99
    return `${major}.${minor}.${patch}`
  }
}

// 导出单例实例
module.exports = new RandomHeaderGenerator()
