import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { normalizeServerUrl } from './serverUrl'

type SensitiveUrlCase = {
  allowPathname: boolean
  expected?: string
  nodeEnv: string
  value: string
  variableName: 'API_URL' | 'RATE_LIMIT_REDIS_REST_URL'
}

function normalizeSensitiveUrl(testCase: SensitiveUrlCase) {
  return normalizeServerUrl(testCase.value, {
    allowPathname: testCase.allowPathname,
    httpPolicy: 'sensitive',
    nodeEnv: testCase.nodeEnv,
    variableName: testCase.variableName,
  })
}

describe('sensitive server URL validation', () => {
  it.each<SensitiveUrlCase>([
    {
      variableName: 'API_URL',
      value: 'https://api.example.com',
      nodeEnv: 'production',
      allowPathname: true,
      expected: 'https://api.example.com',
    },
    {
      variableName: 'API_URL',
      value: 'https://api.example.com/v2/',
      nodeEnv: 'production',
      allowPathname: true,
      expected: 'https://api.example.com/v2',
    },
    {
      variableName: 'RATE_LIMIT_REDIS_REST_URL',
      value: 'https://redis.example.com',
      nodeEnv: 'production',
      allowPathname: false,
      expected: 'https://redis.example.com',
    },
    ...(['development', 'test'] as const).flatMap((nodeEnv) => [
      {
        variableName: 'API_URL' as const,
        value: 'http://localhost:3000',
        nodeEnv,
        allowPathname: true,
        expected: 'http://localhost:3000',
      },
      {
        variableName: 'API_URL' as const,
        value: 'http://127.0.0.1:3000',
        nodeEnv,
        allowPathname: true,
        expected: 'http://127.0.0.1:3000',
      },
      {
        variableName: 'RATE_LIMIT_REDIS_REST_URL' as const,
        value: 'http://[::1]:3000',
        nodeEnv,
        allowPathname: false,
        expected: 'http://[::1]:3000',
      },
    ]),
  ])('accepts $variableName=$value in $nodeEnv', (testCase) => {
    expect(normalizeSensitiveUrl(testCase)).toBe(testCase.expected)
  })

  it.each<SensitiveUrlCase>([
    {
      variableName: 'API_URL',
      value: 'http://api.example.com',
      nodeEnv: 'production',
      allowPathname: true,
    },
    {
      variableName: 'API_URL',
      value: 'http://api.example.com',
      nodeEnv: 'test',
      allowPathname: true,
    },
    {
      variableName: 'API_URL',
      value: 'http://localhost:3000',
      nodeEnv: 'production',
      allowPathname: true,
    },
    {
      variableName: 'RATE_LIMIT_REDIS_REST_URL',
      value: 'http://redis.example.com',
      nodeEnv: 'production',
      allowPathname: false,
    },
    ...(['API_URL', 'RATE_LIMIT_REDIS_REST_URL'] as const).flatMap(
      (variableName) =>
        [
          'ftp://example.com',
          '/relative',
          'https://user@example.com',
          'https://user:secret@example.com',
          'https://example.com/#fragment',
          'https://example.com/?token=secret',
          '',
          'not a url',
        ].map((value) => ({
          variableName,
          value,
          nodeEnv: 'production',
          allowPathname: variableName === 'API_URL',
        })),
    ),
    {
      variableName: 'RATE_LIMIT_REDIS_REST_URL',
      value: 'https://redis.example.com/rest',
      nodeEnv: 'production',
      allowPathname: false,
    },
  ])('rejects $variableName=$value in $nodeEnv', (testCase) => {
    let error: unknown

    try {
      normalizeSensitiveUrl(testCase)
    } catch (caught) {
      error = caught
    }

    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toContain(testCase.variableName)
    expect((error as Error).message).not.toContain('secret')
  })
})
