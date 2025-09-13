import { test, expect } from 'bun:test'
import { generateKey, encrypt, decrypt } from './encrypt'

test('it works', async () => {
  const key = await generateKey()

  console.log(key)
  expect(key).toBeTruthy()

  const plainText = 'Mr Watson I need you'
  console.log(plainText)

  const encrypted = await encrypt(plainText, key)

  expect(plainText === encrypted).toBe(false)
  console.log(encrypted)

  const decrypted = await decrypt(encrypted, key)
  expect(plainText === decrypted).toBe(true)
  console.log(decrypted)
})
