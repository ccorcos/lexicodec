export function compare<K extends string | number | boolean, Date>(
	a: K,
	b: K
): -1 | 0 | 1 {
	if (a > b) {
		return 1
	}
	if (a < b) {
		return -1
	}
	return 0
}
