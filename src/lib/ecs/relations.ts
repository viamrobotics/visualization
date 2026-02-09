import { relation } from "koota";

export const HoverLink = relation({
	store: { indexMapping: () => "index" },
})