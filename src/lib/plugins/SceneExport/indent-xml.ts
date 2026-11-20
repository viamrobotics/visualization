/** Every line of `xml` one tab deeper, to nest it inside a parent element. */
export const indentXml = (xml: string): string =>
	xml
		.split('\n')
		.map((line) => `\t${line}`)
		.join('\n')
