# Lexicographical Encoding

Lexicographcial encodings are very useful for indexing information in an ordered key-value store such as LevelDb, FoundationDb, or DynamoDb.

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
}

const codec = new Codec({
	b: NullEncoding,
	c: ObjectEncoding,
	d: ArrayEncoding,
	e: NumberEncoding,
	f: StringEncoding,
	g: BooleanEncoding,
	h: DateEncoding
})

codec.encode(new Date()) // => "h2023-11-29T18:44:54.942Z"
codec.encode(["created", new Date()]) // => "dfcreated\u0000h2023-11-29T18:44:54.943Z\u0000"
```