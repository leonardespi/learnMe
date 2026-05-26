import { invoke as _invoke } from '@tauri-apps/api/core'

// any-justified: Tauri IPC args are runtime-typed by design
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type InvokeArgs = Record<string, any>

export function invoke<T>(cmd: string, args?: InvokeArgs): Promise<T> {
  if (import.meta.env.DEV) {
    console.info(`[IPC →] ${cmd}`, args ?? '')
    return _invoke<T>(cmd, args).then(
      (result) => {
        console.info(`[IPC ✓] ${cmd}`, result)
        return result
      },
      (err: unknown) => {
        console.error(`[IPC ❌] ${cmd}`, err)
        throw err
      },
    )
  }
  return _invoke<T>(cmd, args)
}
