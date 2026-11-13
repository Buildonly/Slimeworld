/** Awning colours and signs for each shop. */
export const SHOP_COLOURS: Record<string, string> = {
  bakery: "#ef6b6b",
  pantry: "#f5a742",
  icehut: "#5cc7e8",
  toys: "#b98af0",
  school: "#5a8cf0",
  smithy: "#8d9a6a",
};
export const SHOP_EMOJI: Record<string, string> = { bakery: "🥐", pantry: "🍯", icehut: "🧊", toys: "🧸", school: "📚", smithy: "⚒️" };
export const shopColour = (id: string) => SHOP_COLOURS[id] ?? "#ef6b6b";
