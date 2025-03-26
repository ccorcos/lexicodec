import { jsonCodec } from "./codec"

type Person = {
	id: string
	name?: string
	email?: { address?: string; label?: string }[]
}

const firstNames = [
	"James",
	"Mary",
	"John",
	"Patricia",
	"Robert",
	"Jennifer",
	"Michael",
	"Linda",
	"William",
	"Elizabeth",
	"David",
	"Susan",
	"Richard",
	"Jessica",
	"Joseph",
	"Sarah",
	"Thomas",
	"Karen",
	"Charles",
	"Nancy",
]

const lastNames = [
	"Smith",
	"Johnson",
	"Williams",
	"Jones",
	"Brown",
	"Davis",
	"Miller",
	"Wilson",
	"Moore",
	"Taylor",
	"Anderson",
	"Thomas",
	"Jackson",
	"White",
	"Harris",
	"Martin",
	"Thompson",
	"Garcia",
	"Martinez",
	"Robinson",
]

const emailTypes = ["personal", "work", "other", "backup"]

const domains = [
	"gmail.com",
	"yahoo.com",
	"outlook.com",
	"example.com",
	"company.com",
]

// Deterministic person generation.
function generatePerson(i: number): Person {
	const person: Person = { id: `person-${i.toString().padStart(4, "0")}` }

	if (i % 10 < 7)
		person.name = `${firstNames[i % 20]} ${lastNames[(i + 5) % 20]}`

	const emailCount = i % 5 // 0, 1, 2, 3, or 4 emails
	if (emailCount > 0) {
		person.email = []

		for (let j = 0; j < emailCount; j++) {
			const hasAddress = (i + j) % 4 !== 3 // 75% chance of having an address
			const hasLabel = (i + j) % 3 !== 2 // 67% chance of having a label

			const email: { address?: string; label?: string } = {}

			if (hasAddress) {
				const domainIndex = (i + j) % domains.length
				email.address = `${person.id.toLowerCase()}-${j}@${
					domains[domainIndex]
				}`
			}

			if (hasLabel) {
				const labelIndex = (i + j) % emailTypes.length
				email.label = emailTypes[labelIndex]
			}

			person.email.push(email)
		}
	}

	return person
}

function generatePeople(count: number): Person[] {
	const people: Person[] = []
	for (let i = 0; i < count; i++) people.push(generatePerson(i))
	return people
}

// const people = generatePeople(100_000)
const people = generatePeople(10)

function codec() {
	for (const person of people) {
		const encoded = jsonCodec.encode(person)
		const decoded = jsonCodec.decode(encoded)
	}
	console.log("done codec")
}

function json() {
	for (const person of people) {
		const encoded = JSON.stringify(person)
		const decoded = JSON.parse(encoded)
	}
	console.log("done json")
}

// Run main if this is executed directly
if (require.main === module) {
	const arg = process.argv[2]

	if (arg === "json") json()
	else if (arg === "codec") codec()
	else throw new Error("Unknown arg")
}
