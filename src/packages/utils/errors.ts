export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number = 400
  ) {
    super(message)
    this.name = "AppError"
  }
}

export type ActionResult<T = void> =
  | { data: T; error: null }
  | { data: null; error: string }

export function success<T>(data: T): ActionResult<T> {
  return { data, error: null }
}

export function failure(error: string): ActionResult<never> {
  return { data: null, error }
}
