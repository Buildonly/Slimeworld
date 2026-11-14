import { describe, expect, it } from "vitest";
import { pitchFor } from "./settings";
import { assignVoices, cheapestModel } from "./voices";

const voice = (id: string, name: string, descriptive: string, age = "young") => ({ voice_id: id, name, labels: { descriptive, age } });

describe("slime voices", () => {
  it("gives every personality its own voice from the live list", () => {
    const v = assignVoices([voice("a", "Ann - Sassy", "sassy"), voice("b", "Bo - Fierce Warrior", "rough"), voice("c", "Cy", "calm"), voice("d", "Di - Laid-Back", "casual"), voice("e", "Ed - Husky Trickster", "husky"), voice("f", "Fa", "professional")])!;
    expect(Object.keys(v).sort()).toEqual(["brave", "greedy", "lazy", "social", "thrifty"]);
    expect(new Set(Object.values(v).map((x) => x.id)).size).toBe(5);
    expect(v.social.id).toBe("a");
    expect(v.greedy.id).toBe("e");
    expect(v.social.name).toBe("Ann");
  });
  it("needs enough voices and skips malformed ones", () => {
    expect(assignVoices([voice("a", "A", "x"), { bad: true }])).toBeNull();
  });
  it("picks the cheapest speech model", () => {
    expect(cheapestModel([{ model_id: "big", can_do_text_to_speech: true, model_rates: { character_cost_multiplier: 1 } }, { model_id: "sts", can_do_text_to_speech: false, model_rates: { character_cost_multiplier: 0.1 } }, { model_id: "fast", can_do_text_to_speech: true, model_rates: { character_cost_multiplier: 0.5 } }])).toBe("fast");
  });
  it("sounds higher when young and settles as it grows", () => {
    expect(pitchFor(0.8)).toBeGreaterThan(pitchFor(1.1));
    expect(pitchFor(1.4)).toBeGreaterThanOrEqual(1.1);
    expect(pitchFor(5)).toBe(pitchFor(1.4));
  });
});
