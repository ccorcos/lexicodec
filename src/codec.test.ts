import { strict as assert } from "assert"
import { describe, it } from "mocha"
import {
	ArrayEncoding,
	BooleanEncoding,
	Codec,
	Encoding,
	NullEncoding,
	NumberEncoding,
	ObjectEncoding,
	StringEncoding,
	jsonCodec,
} from "./codec"
import { compare } from "./compare"

function toString(value: any) {
	if (value === null) {
		return "null"
	} else {
		return JSON.stringify(value)
	}
}

describe("jsonCodec", () => {
	it("Encodes and decodes properly", () => {
		for (let i = 0; i < sortedValues.length; i++) {
			const value = sortedValues[i]
			const encoded = jsonCodec.encode(value)
			const decoded = jsonCodec.decode(encoded)
			assert.deepStrictEqual(
				decoded,
				value,
				[toString(value), toString(encoded), toString(decoded)].join(" -> ")
			)
		}
	})

	it("Encodes in lexicographical order", () => {
		for (let i = 0; i < sortedValues.length; i++) {
			for (let j = 0; j < sortedValues.length; j++) {
				const a = jsonCodec.encode(sortedValues[i])
				const b = jsonCodec.encode(sortedValues[j])
				assert.deepStrictEqual(
					compare(a, b),
					compare(i, j),
					`compare(${[
						toString(sortedValues[i]),
						toString(sortedValues[j]),
					].join(", ")}) === compare(${[toString(a), toString(b)].join(", ")})`
				)

				assert.deepStrictEqual(
					jsonCodec.compare(sortedValues[i], sortedValues[j]),
					compare(i, j),
					`jsonCodec.compare(${[
						toString(sortedValues[i]),
						toString(sortedValues[j]),
					].join(", ")}) === compare(${[toString(a), toString(b)].join(", ")})`
				)
			}

			assert.deepStrictEqual(
				jsonCodec.compare(jsonCodec.MIN, sortedValues[i]),
				-1
			)

			assert.deepStrictEqual(
				jsonCodec.compare(jsonCodec.MAX, sortedValues[i]),
				1
			)
		}
	})

	it("Encodes and decodes tuples properly", () => {
		const test = (tuple: any[]) => {
			const encoded = jsonCodec.encode(tuple)
			const decoded = jsonCodec.decode(encoded)
			assert.deepStrictEqual(
				decoded,
				tuple,
				[toString(tuple), toString(encoded), toString(decoded)].join(" -> ")
			)
		}

		test([])
		for (let i = 0; i < sortedValues.length; i++) {
			const a = sortedValues[i]
			test([a])
			for (let j = 0; j < sortedValues.length; j++) {
				const b = sortedValues[j]
				test([a, b])
			}
		}

		for (let i = 0; i < sortedValues.length - 2; i++) {
			const opts = sortedValues.slice(i, i + 3)
			for (const a of opts) {
				for (const b of opts) {
					for (const c of opts) {
						test([a, b, c])
					}
				}
			}
		}
	})

	it("Encodes tuples in lexicographical order", () => {
		const test = (aTuple: any[], bTuple: any[], result: number) => {
			const a = jsonCodec.encode(aTuple)
			const b = jsonCodec.encode(bTuple)
			assert.deepStrictEqual(
				compare(a, b),
				result,
				`compare(${[toString(aTuple), toString(bTuple)].join(
					", "
				)}) === compare(${[toString(a), toString(b)].join(", ")})`
			)

			assert.deepStrictEqual(
				jsonCodec.compare(aTuple, bTuple),
				result,
				`jsonCodec.compare(${[toString(aTuple), toString(bTuple)].join(
					", "
				)}) === compare(${[toString(a), toString(b)].join(", ")})`
			)

			assert.deepStrictEqual(jsonCodec.compare(jsonCodec.MIN, aTuple), -1)
			assert.deepStrictEqual(jsonCodec.compare(jsonCodec.MIN, bTuple), -1)
			assert.deepStrictEqual(jsonCodec.compare(jsonCodec.MAX, aTuple), 1)
			assert.deepStrictEqual(jsonCodec.compare(jsonCodec.MAX, bTuple), 1)
		}

		for (let i = 0; i < sortedValues.length; i++) {
			for (let j = 0; j < sortedValues.length; j++) {
				const a = sortedValues[i]
				const b = sortedValues[j]
				test([a, a], [a, b], compare(i, j))
				test([a, b], [b, a], compare(i, j))
				test([b, a], [b, b], compare(i, j))
				if (i !== j) {
					test([a], [a, a], -1)
					test([a], [a, b], -1)
					test([a], [b, a], compare(i, j))
					test([a], [b, b], compare(i, j))
					test([b], [a, a], compare(j, i))
					test([b], [a, b], compare(j, i))
					test([b], [b, a], -1)
					test([b], [b, b], -1)
				}
			}
		}

		const sample = () => {
			const x = sortedValues.length
			const i = random(x - 1)
			const j = random(x - 1)
			const k = random(x - 1)
			const tuple = [sortedValues[i], sortedValues[j], sortedValues[k]]
			const rank = i * x * x + j * x + k
			return { tuple, rank }
		}

		// (40*40*40)^2 = 4 billion variations for these sorted 3-length tuples.
		for (let iter = 0; iter < 100_000; iter++) {
			const a = sample()
			const b = sample()
			test(a.tuple, b.tuple, compare(a.rank, b.rank))
		}
	})
})

describe("README", () => {
	it("jsonCodec", () => {
		console.log(`
jsonCodec.encode(null) // => ${JSON.stringify(jsonCodec.encode(null))}
jsonCodec.encode(true) // => ${JSON.stringify(jsonCodec.encode(true))}
jsonCodec.encode("hello world") // => ${JSON.stringify(
			jsonCodec.encode("hello world")
		)}
jsonCodec.encode(10) // => ${JSON.stringify(jsonCodec.encode(10))}
jsonCodec.encode(["chet", "corcos"]) // => ${JSON.stringify(
			jsonCodec.encode(["chet", "corcos"])
		)}
jsonCodec.encode({date: "2020-03-10"}) // => ${JSON.stringify(
			jsonCodec.encode({
				date: "2020-03-10",
			})
		)}
`)
	})

	it("DateEncoding", () => {
		const DateEncoding: Encoding<Date> = {
			match: (value: unknown) =>
				typeof value === "object" &&
				Object.getPrototypeOf(value) === Date.prototype,
			encode: (value) => value.toISOString(),
			decode: (value) => new Date(value),
			compare: (a, b) => (a > b ? 1 : b > a ? -1 : 0),
		}

		const codec = new Codec({
			b: NullEncoding,
			c: ObjectEncoding,
			d: ArrayEncoding,
			e: NumberEncoding,
			f: StringEncoding,
			g: BooleanEncoding,
			h: DateEncoding,
		})

		console.log(`
codec.encode(new Date()) // => ${JSON.stringify(codec.encode(new Date()))}
codec.encode(["created", new Date()]) // => ${JSON.stringify(
			codec.encode(["created", new Date()])
		)}
`)
	})
})

function random(max: number) {
	return Math.floor(Math.random() * (max + 1))
}

const sortedValues = [
	null,
	{},
	{ a: 1 },
	{ a: 2 },
	{ a: 2, b: 1 },
	{ a: 2, c: 2 },
	{ b: 1 },
	[],
	[1],
	[1, [2]],
	[1, 2],
	[1, 3],
	[2],
	-Number.MAX_VALUE,
	Number.MIN_SAFE_INTEGER,
	-999999,
	-1,
	-Number.MIN_VALUE,
	0,
	Number.MIN_VALUE,
	1,
	999999,
	Number.MAX_SAFE_INTEGER,
	Number.MAX_VALUE,
	"",
	"\x00",
	"\x00\x00",
	"\x00\x01",
	"\x00\x02",
	"\x00A",
	"\x01",
	"\x01\x00",
	"\x01\x01",
	"\x01\x02",
	"\x01A",
	"\x02",
	"\x02\x00",
	"\x02\x01",
	"\x02\x02",
	"\x02A",
	"A",
	"A\x00",
	"A\x01",
	"A\x02",
	"AA",
	"AAB",
	"AB",
	"B",
	false,
	true,
]
