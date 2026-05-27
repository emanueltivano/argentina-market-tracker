import { spawn } from 'node:child_process'

function runScript(scriptName) {
  return new Promise((resolve, reject) => {
    console.log(`[run-e2e-suite] starting ${scriptName}`)

    const child = spawn(`npm run ${scriptName}`, {
      stdio: 'inherit',
      shell: true,
      env: process.env,
    })

    child.once('error', reject)
    child.once('exit', (code) => {
      const exitCode = code ?? 1

      console.log(
        `[run-e2e-suite] finished ${scriptName} with exit code ${exitCode}`
      )
      resolve(exitCode)
    })
  })
}

async function main() {
  const scriptNames = ['test:e2e:ssr:run', 'test:e2e:app:run']
  const exitCodes = []

  for (const scriptName of scriptNames) {
    exitCodes.push(await runScript(scriptName))
  }

  const hasFailures = exitCodes.some((code) => code !== 0)
  process.exit(hasFailures ? 1 : 0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
