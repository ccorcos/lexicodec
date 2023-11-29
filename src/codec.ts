// This codec is should create a component-wise lexicographically sortable array.

import * as elen from "elen"
import { compare } from "./compare"

export type Encoding<T> = {
	/** prefix is just one byte currently. */
	match: (value: unknown) => boolean
	prefix: string
	encode: (value: T, encode: (value: any) => string) => string
	decode: (value: string, decode: (value: string) => any) => T
}

// Prefixes are based on legacy implementation.
// null < object < array < number < string < boolean

export const NullEncoding: Encoding<null> = {
	match: (value) => value === null,
	prefix: "b",
	encode: (value) => "",
	decode: (value) => null,
}

export const BooleanEncoding: Encoding<boolean> = {
	match: (value: unknown) => value === true || value === false,
	prefix: "g",
	encode: (value) => JSON.stringify(value),
	decode: (value) => JSON.parse(value),
}

export const StringEncoding: Encoding<string> = {
	match: (value: unknown) => typeof value === "string",
	prefix: "f",
	encode: (value) => value,
	decode: (value) => value,
}

export const NumberEncoding: Encoding<number> = {
	match: (value: unknown) => typeof value === "number",
	prefix: "e",
	encode: (value) => elen.encode(value),
	decode: (value) => elen.decode(value),
}

export const ArrayEncoding: Encoding<any[]> = {
	match: (value: unknown) => Array.isArray(value),
	prefix: "d",
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
}

export const ObjectEncoding: Encoding<object> = {
	match: (value: unknown) =>
		typeof value === "object" &&
		value !== null &&
		Object.getPrototypeOf(value) === Object.prototype,
	prefix: "c",
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
}

export class Codec {
	constructor(public encodings: Encoding<any>[]) {}

	encode = (value: any): string => {
		for (const encoding of this.encodings) {
			if (encoding.match(value))
				return encoding.prefix + encoding.encode(value, this.encode)
		}
		throw new Error(`Missing encoding for value: ${value}`)
	}

	decode = (value: string): any => {
		const prefix = value[0]
		const rest = value.slice(1)
		for (const encoding of this.encodings) {
			if (encoding.prefix === prefix) return encoding.decode(rest, this.decode)
		}
		throw new Error(`Missing encoding for value: ${value}`)
	}
}

export const jsonCodec = new Codec([
	NullEncoding,
	BooleanEncoding,
	StringEncoding,
	NumberEncoding,
	ArrayEncoding,
	ObjectEncoding,
])
