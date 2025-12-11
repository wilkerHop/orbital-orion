/**
 * Result monad for type-safe error handling without exceptions.
 * Follows functional programming principles for explicit error paths.
 */

export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export const ok = <T>(value: T): Result<T, never> => ({
  ok: true,
  value,
});

export const err = <E>(error: E): Result<never, E> => ({
  ok: false,
  error,
});

export const isOk = <T, E>(result: Result<T, E>): result is { readonly ok: true; readonly value: T } =>
  result.ok;

export const isErr = <T, E>(result: Result<T, E>): result is { readonly ok: false; readonly error: E } =>
  !result.ok;

export const map = <T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U
): Result<U, E> =>
  result.ok ? ok(fn(result.value)) : result;

export const mapErr = <T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => F
): Result<T, F> =>
  result.ok ? result : err(fn(result.error));

export const flatMap = <T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>
): Result<U, E> =>
  result.ok ? fn(result.value) : result;

export const unwrapOr = <T, E>(result: Result<T, E>, defaultValue: T): T =>
  result.ok ? result.value : defaultValue;

export const match = <T, E, U>(
  result: Result<T, E>,
  handlers: {
    readonly onOk: (value: T) => U;
    readonly onErr: (error: E) => U;
  }
): U =>
  result.ok ? handlers.onOk(result.value) : handlers.onErr(result.error);

export const fromNullable = <T, E>(
  value: T | null | undefined,
  error: E
): Result<T, E> =>
  value != null ? ok(value) : err(error);

export const tryCatch = <T, E>(
  fn: () => T,
  onError: (e: unknown) => E
): Result<T, E> => {
  try {
    return ok(fn());
  } catch (e) {
    return err(onError(e));
  }
};

export const combine = <T, E>(results: readonly Result<T, E>[]): Result<readonly T[], E> => {
  const values: T[] = [];
  for (const result of results) {
    if (!result.ok) {
      return result;
    }
    values.push(result.value);
  }
  return ok(values);
};
