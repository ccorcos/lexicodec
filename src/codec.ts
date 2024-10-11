// This codec is should create a component-wise lexicographically sortable array.

import * as elen from "elen"
import { compare } from "./compare"

export type Encoding<T> = {
	/** Should this value use this encoding? */
	match: (value: unknown) => boolean
	encode: (value: T, encode: (value: any) => string) => string
	decode: (value: string, decode: (value: string) => any) => T
	/** This is for in-memory comparison without serializing. */
	compare: (a: T, b: T, compare: (a: any, b: any) => -1 | 0 | 1) => -1 | 0 | 1
}

export const NullEncoding: Encoding<null> = {
	match: (value) => value === null,
	encode: () => "",
	decode: () => null,
	compare: () => 0,
}

export const BooleanEncoding: Encoding<boolean> = {
	match: (value: unknown) => value === true || value === false,
	encode: (value) => JSON.stringify(value),
	decode: (value) => JSON.parse(value),
	compare: compare,
}

export const StringEncoding: Encoding<string> = {
	match: (value: unknown) => typeof value === "string",
	encode: (value) => value,
	decode: (value) => value,
	compare: compare,
}

export const NumberEncoding: Encoding<number> = {
	match: (value: unknown) => typeof value === "number",
	encode: (value) => elen.encode(value),
	decode: (value) => elen.decode(value),
	compare: compare,
}

// Databases like LMDB avoid escaping null bytes by requiring all values
// don't contain null bytes. But this means you can't have nested tuples.
export const ArrayEncoding: Encoding<any[]> = {
	match: (value: unknown) => Array.isArray(value),
	encode: (array, encode) =>
		array
			.map((value, i) => {
				const encoded = encode(value)
				return (
					encoded
						// B -> BB or \ -> \\
						.replace(/\x01/g, "\x01\x01")
						// A -> BA or x -> \x
						.replace(/\x00/g, "\x01\x00") + "\x00"
				)
			})
			.join(""),
	decode: (value, decode) => {
		if (value === "") {
			return []
		}
		// Capture all of the escaped BB and BA pairs and wait
		// til we find an exposed A.
		const re = /(\x01(\x01|\x00)|\x00)/g
		const array: any[] = []
		let start = 0
		while (true) {
			const match = re.exec(value)
			if (match === null) {
				return array
			}
			if (match[0][0] === "\x01") {
				// If we match a \x01\x01 or \x01\x00 then keep going.
				continue
			}
			const end = match.index
			const escaped = value.slice(start, end)
			const unescaped = escaped
				// BB -> B
				.replace(/\x01\x01/g, "\x01")
				// BA -> A
				.replace(/\x01\x00/g, "\x00")
			const decoded = decode(unescaped)
			array.push(decoded)
			// Skip over the \x00.
			start = end + 1
		}
	},
	compare: (a, b, cmp) => {
		const len = Math.min(a.length, b.length)

		for (let i = 0; i < len; i++) {
			const dir = cmp(a[i], b[i])
			if (dir !== 0) return dir
		}

		return compare(a.length, b.length)
	},
}

function flatten<T>(array: T[][]): T[] {
	const result: T[] = []
	for (const inner of array) {
		for (const item of inner) {
			result.push(item)
		}
	}
	return result
}

function chunk<T>(array: T[], size: number): T[][] {
	const result: T[][] = []

	for (let i = 0; i < array.length; i += size) {
		const chunk = array.slice(i, i + size)
		result.push(chunk)
	}

	return result
}

export const ObjectEncoding: Encoding<object> = {
	match: (value: unknown) =>
		typeof value === "object" &&
		value !== null &&
		Object.getPrototypeOf(value) === Object.prototype,
	encode: (value, encode) => {
		const entries = Object.entries(value).sort(([k1], [k2]) => compare(k1, k2))
		const items = flatten(entries)
		return ArrayEncoding.encode(items, encode)
	},
	decode: (value, decode) => {
		const items = ArrayEncoding.decode(value, decode)
		const entries = chunk(items, 2) as Array<[string, any]>
		const obj = {}
		for (const [key, value] of entries) {
			obj[key] = value
		}
		return obj
	},
	compare: (a, b, cmp) => {
		const ae = Object.entries(a).sort(([k1], [k2]) => compare(k1, k2))
		const be = Object.entries(b).sort(([k1], [k2]) => compare(k1, k2))
		const len = Math.min(ae.length, be.length)

		for (let i = 0; i < len; i++) {
			const [ak, av] = ae[i]
			const [bk, bv] = be[i]
			const dir = compare(ak, bk)
			if (dir !== 0) return dir
			const dir2 = cmp(av, bv)
			if (dir2 !== 0) return dir2
		}

		return compare(ae.length, be.length)
	},
}

export const ObjectLegacyEncoding: Encoding<object> = {
	match: (value: unknown) =>
		typeof value === "object" &&
		value !== null &&
		Object.getPrototypeOf(value) === Object.prototype,
	encode: (value, encode) => {
		const entries = Object.entries(value).sort(([k1], [k2]) => compare(k1, k2))
		return ArrayEncoding.encode(entries, encode)
	},
	decode: (value, decode) => {
		const entries: Array<[string, any]> = ArrayEncoding.decode(value, decode)
		const obj = {}
		for (const [key, value] of entries) {
			obj[key] = value
		}
		return obj
	},
	compare: ObjectEncoding.compare,
}

// MIN and MAX are useful for array prefix queries and stuff like that.
export const MIN = Symbol("min")
export const MAX = Symbol("max")

export const MinEncoding: Encoding<null> = {
	match: (value) => value === MIN,
	encode: () => "",
	decode: () => null,
	compare: () => 0,
}

export const MaxEncoding: Encoding<null> = {
	match: (value) => value === MAX,
	encode: () => "",
	decode: () => null,
	compare: () => 0,
}

export class Codec {
	constructor(public encodings: { [prefixByte: string]: Encoding<any> }) {
		for (const prefixByte in encodings)
			if (prefixByte.length !== 1)
				throw new Error(`Encoding prefix is not 1 byte: ${prefixByte}`)
	}

	encode = (value: any): string => {
		for (const [prefixByte, encoding] of Object.entries(this.encodings))
			if (encoding.match(value))
				return prefixByte + encoding.encode(value, this.encode)

		throw new Error(`Missing encoding for value: ${value}`)
	}

	decode = (value: string): any => {
		const prefix = value[0]
		const rest = value.slice(1)
		for (const [prefixByte, encoding] of Object.entries(this.encodings))
			if (prefixByte === prefix) return encoding.decode(rest, this.decode)

		throw new Error(`Missing encoding for value: ${value}`)
	}

	compare = (a: any, b: any): -1 | 0 | 1 => {
		if (a === b) return 0
		let ae: [string, Encoding<any>] | undefined
		let be: [string, Encoding<any>] | undefined
		for (const [prefix, encoding] of Object.entries(this.encodings)) {
			if (!ae && encoding.match(a)) ae = [prefix, encoding]
			if (!be && encoding.match(b)) be = [prefix, encoding]
			if (ae && be) break
		}
		if (!ae) throw new Error(`Missing encoding for value: ${a}`)
		if (!be) throw new Error(`Missing encoding for value: ${b}`)

		// Type prefix comparison.
		if (ae[0] !== be[0]) return compare(ae[0], be[0])
		// Value comparison.
		return ae[1].compare(a, b, this.compare)
	}
}

export const jsonCodec = new Codec({
	// Prefixes are based on legacy implementation.
	// MIN < null < object < array < number < string < boolean < MAX
	"\x00": MinEncoding,
	b: NullEncoding,
	c: ObjectEncoding,
	d: ArrayEncoding,
	e: NumberEncoding,
	f: StringEncoding,
	g: BooleanEncoding,
	"\xff": MaxEncoding,
})
