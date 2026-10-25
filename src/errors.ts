/** Errors with a message meant for the person running the CLI. */
export class WrappedError extends Error {}

export class MissingDatabaseError extends WrappedError {
  constructor(dbPath: string) {
    super(`No Messages database at ${dbPath}. This needs a Mac that is signed in to Messages.`)
  }
}

export class NoFullDiskAccessError extends WrappedError {
  constructor() {
    super(
      [
        'macOS blocked access to your Messages database.',
        'Open System Settings → Privacy & Security → Full Disk Access,',
        'turn it on for your terminal app (Terminal, iTerm, Warp or VS Code), then restart that app.',
      ].join('\n'),
    )
  }
}

export class ChatNotFoundError extends WrappedError {
  constructor(query: string, suggestions: string[]) {
    super(
      [
        `No single chat matches "${query}". Closest matches:`,
        ...suggestions.map((s) => `  ${s}`),
        'Run it again with the chat id from the first column.',
      ].join('\n'),
    )
  }
}

export class EmptyPeriodError extends WrappedError {
  constructor(title: string) {
    super(`"${title}" has no messages in that period. Try a different --year.`)
  }
}

export function errorCode(err: unknown): string | undefined {
  if (typeof err === 'object' && err !== null && 'code' in err) return String(err.code)
  return undefined
}
