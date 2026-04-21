export async function* filterAsyncIterable<T>(
  source: AsyncIterable<T>,
  predicate: (value: T) => boolean | Promise<boolean>,
): AsyncGenerator<T> {
  for await (const value of source) {
    if (await predicate(value)) {
      yield value;
    }
  }
}