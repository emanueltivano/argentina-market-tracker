import { spawn } from 'node:child_process'

const SERVER_URL = 'http://127.0.0.1:3100'
const SERVER_PORT = '3100'
const SERVER_START_TIMEOUT_MS = 120_000
const SERVER_STOP_TIMEOUT_MS = 10_000

function spawnCommand(command, args, options = {}) {
  return spawn(command, args, {
    stdio: 'inherit',
    shell: false,
    ...options,
  })
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForServer(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url)

      if (response.ok || response.status === 404) {
        return
      }
    } catch {
      // Server not ready yet.
    }

    await delay(500)
  }

  throw new Error(`Timed out waiting for ${url}`)
}

async function terminateServer(serverProcess) {
  if (serverProcess.exitCode !== null) {
    return
  }

  serverProcess.kill()

  await Promise.race([
    new Promise((resolve) => serverProcess.once('exit', resolve)),
    delay(SERVER_STOP_TIMEOUT_MS),
  ])

  if (serverProcess.exitCode !== null) {
    return
  }

  if (process.platform === 'win32') {
    const killer = spawn('taskkill', ['/pid', String(serverProcess.pid), '/t', '/f'], {
      stdio: 'ignore',
      shell: false,
    })

    await new Promise((resolve) => {
      killer.once('exit', resolve)
      killer.once('error', resolve)
    })

    return
  }

  serverProcess.kill('SIGKILL')
  await new Promise((resolve) => serverProcess.once('exit', resolve))
}

async function main() {
  const nextBin = './node_modules/next/dist/bin/next'
  const playwrightCli = './node_modules/@playwright/test/cli.js'
  const serverProcess = spawnCommand(
    process.execPath,
    [nextBin, 'start', '-p', SERVER_PORT],
    {
      env: {
        ...process.env,
        DISABLE_SERVER_DASHBOARD_PREFETCH: '1',
      },
    }
  )

  let exitCode = 1

  const forwardSignal = (signal) => {
    if (serverProcess.exitCode === null) {
      serverProcess.kill(signal)
    }
  }

  process.on('SIGINT', forwardSignal)
  process.on('SIGTERM', forwardSignal)

  try {
    await waitForServer(SERVER_URL, SERVER_START_TIMEOUT_MS)

    exitCode = await new Promise((resolve, reject) => {
      const playwrightProcess = spawnCommand(
        process.execPath,
        [playwrightCli, 'test'],
        {
          env: {
            ...process.env,
            PLAYWRIGHT_TEST_BASE_URL: SERVER_URL,
          },
        }
      )

      playwrightProcess.once('exit', (code) => resolve(code ?? 1))
      playwrightProcess.once('error', reject)
    })
  } finally {
    process.off('SIGINT', forwardSignal)
    process.off('SIGTERM', forwardSignal)
    await terminateServer(serverProcess)
  }

  process.exit(exitCode)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
