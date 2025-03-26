# Lexicographical Codec

Lexicographcial encodings are very useful for indexing information in an ordered key-value store such as LevelDb, FoundationDb, or DynamoDb.

## Why

Existing ordered key-value storage options will only accept bytes as keys and it's non-trivial to convert a tuple into a byte-string that maintains a consistent order.

For numbers, you can't just stringify them because `2` < `11` but `"2"` > `"11"`. So this package uses [`elen`](https://www.npmjs.com/package/elen) for encoding signed float64 numbers into lexicogrpahically ordered strings.

For arrays / tuples, if you join the array components together then you won't maintain component-wise order because `["jon", "smith"] < ["jonathan", "smith"]` but `jonsmith > jonathansmith`. So this package joins elements using a null byte `\x00`, escapes null bytes with `\x00 => \x01\x00`, and escapes the escape bytes with `\x01 => \x01\x01`. Thus, `["jon", "smith"] => "jon\x00smith"` and `["jonathan", "smith"] => "jonathan\x00smith"` which will maintain component-wise lexicographical order.

Lastly, we use a single byte prefix to encode the type of value we are encoding.

## Getting Started

```sh
npm install lexicodec
```

```ts
export const jsonCodec = new Codec({
	// null < object < array < number < string < boolean
	b: NullEncoding,
	c: ObjectEncoding,
	d: ArrayEncoding,
	e: NumberEncoding,
	f: StringEncoding,
	g: BooleanEncoding,
})

jsonCodec.encode(null) // => "b"
jsonCodec.encode(true) // => "gtrue"
jsonCodec.encode("hello world") // => "fhello world"
jsonCodec.encode(10) // => "e>;;41026;;;2161125899906842624"
jsonCodec.encode(["chet", "corcos"]) // => "dfchet\u0000fcorcos\u0000"
jsonCodec.encode({date: "2020-03-10"}) // => "cfdate\u0000f2020-03-10\u0000"
```

Objects are encoded as entries with ordered keys and they aren't all that useful except for duck typing. However, instead of duck typing, you can create your own custom encodings as well.

```ts
const DateEncoding: Encoding<Date> = {
	match: (value: unknown) =>
		typeof value === "object" &&
		Object.getPrototypeOf(value) === Date.prototype,
	encode: (value) => value.toISOString(),
	decode: (value) => new Date(value),
	compare: (a, b) => (a > b ? 1 : b > a ? -1 : 0),
}

const FunctionEncoding: Encoding<(...args: any[]) => any> = {
	match: (value: unknown) => typeof value === "function",
	encode: (value) => value.toString(),
	decode: (value) => new Function("return " + value)(),
	compare: (a, b, cmp) => cmp(a.toString(), b.toString()),
}

const codec = new Codec({
	b: NullEncoding,
	c: ObjectEncoding,
	d: ArrayEncoding,
	e: NumberEncoding,
	f: StringEncoding,
	g: BooleanEncoding,
	h: DateEncoding
	i: FunctionEncoding
})

codec.encode(new Date()) // => "h2023-11-29T18:44:54.942Z"
codec.encode(["created", new Date()]) // => "dfcreated\u0000h2023-11-29T18:44:54.943Z\u0000"

codec.encode((a, b) => a + b) // => "i(a, b) => a + b"
```

Encodings also have a `compare` property so that you can compare values without having to serializing them. That way you can create in-memory abstractions that mimic the serialized behavior, useful for caching, etc.

```ts
codec.compare(["jon", "smith"], ["jonathan", "smith"]) // => -1
```

## Performance

534ms just for bootup time...

```
❯❯❯ hyperfine --warmup 3 'npx tsx src/benchmark.ts json' 'npx tsx src/benchmark.ts codec'
Benchmark 1: npx tsx src/benchmark.ts json
  Time (mean ± σ):     774.1 ms ±   9.8 ms    [User: 902.0 ms, System: 193.9 ms]
  Range (min … max):   762.3 ms … 795.0 ms    10 runs

Benchmark 2: npx tsx src/benchmark.ts codec
  Time (mean ± σ):      1.824 s ±  0.019 s    [User: 1.991 s, System: 0.208 s]
  Range (min … max):    1.806 s …  1.869 s    10 runs


const FunctionEncoding: Encoding<(...args: any[]) => any> = {
	match: (value: unknown) => typeof value === "function",
	encode: (value) => value.toString(),
	decode: (value) => new Function("return " + value)(),
	compare: (a, b, cmp) => cmp(a.toString(), b.toString()),
}Summary

  npx tsx src/benchmark.ts json ran
    2.36 ± 0.04 times faster than npx tsx src/benchmark.ts codec
```

That means native JSON is 1.281 / .240 = 5.33x faster.

