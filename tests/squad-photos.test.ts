import { describe, expect, it } from "vitest";
import {
  matchPlayer,
  nameTokens,
  normalizeName,
  pickWidth,
} from "@/lib/squad-photos";

const roster = (...names: string[]) =>
  names.map((name, i) => ({ id: `p${i}`, name }));

describe("normalizeName", () => {
  it("strips diacritics, punctuation, and casing", () => {
    expect(normalizeName("Vinícius Júnior")).toBe("VINICIUS JUNIOR");
    expect(normalizeName("N'Golo Kanté")).toBe("N GOLO KANTE");
    expect(normalizeName("  Kevin  De Bruyne ")).toBe("KEVIN DE BRUYNE");
  });
});

describe("nameTokens", () => {
  it("returns an empty array for blank input", () => {
    expect(nameTokens("   ")).toEqual([]);
    expect(nameTokens("!!!")).toEqual([]);
  });
});

describe("pickWidth", () => {
  it("picks the variant closest to the preferred width despite commas in urls", () => {
    const srcset = [
      "https://digitalhub.fifa.com/transform/a,aspectratio:1x1/x?width:160 160w",
      "https://digitalhub.fifa.com/transform/a,aspectratio:1x1/x?width:320 320w",
      "https://digitalhub.fifa.com/transform/a,aspectratio:1x1/x?width:640 640w",
    ].join(", ");
    expect(pickWidth(srcset, 320)).toContain("width:320");
    expect(pickWidth(srcset, 1000)).toContain("width:640");
  });

  it("returns null when no width descriptors are present", () => {
    expect(pickWidth("https://example.com/x.jpg", 320)).toBeNull();
  });
});

describe("matchPlayer", () => {
  it("matches exactly on normalized full name regardless of case/diacritics", () => {
    const m = matchPlayer("Lionel MESSI", roster("Lionel Messi", "Ángel Di María"));
    expect(m?.name).toBe("Lionel Messi");
  });

  it("matches when token order differs", () => {
    const m = matchPlayer("MARTINEZ Lautaro", roster("Lautaro Martínez"));
    expect(m?.name).toBe("Lautaro Martínez");
  });

  it("matches FIFA's short name against a fuller legal name (subset)", () => {
    const m = matchPlayer("Achraf HAKIMI", roster("Achraf Hakimi Mouh", "Yassine Bounou"));
    expect(m?.name).toBe("Achraf Hakimi Mouh");
  });

  it("matches a fuller FIFA name against a short DB name (reverse subset)", () => {
    const m = matchPlayer("Cristiano Ronaldo DOS SANTOS", roster("Cristiano Ronaldo"));
    expect(m?.name).toBe("Cristiano Ronaldo");
  });

  it("disambiguates shared surnames by first initial", () => {
    const squad = roster("Emiliano Martínez", "Lautaro Martínez");
    expect(matchPlayer("Lautaro MARTINEZ", squad)?.name).toBe("Lautaro Martínez");
    expect(matchPlayer("Emiliano MARTINEZ", squad)?.name).toBe("Emiliano Martínez");
  });

  it("refuses to match when the first initial disagrees with every candidate", () => {
    expect(matchPlayer("Pablo MARTINEZ", roster("Emiliano Martínez", "Lautaro Martínez"))).toBeNull();
  });

  it("matches a unique surname even without a first name", () => {
    expect(matchPlayer("MODRIC", roster("Luka Modrić", "Ivan Perišić"))?.name).toBe("Luka Modrić");
  });

  it("refuses an ambiguous surname-only match", () => {
    expect(matchPlayer("MARTINEZ", roster("Emiliano Martínez", "Lautaro Martínez"))).toBeNull();
  });

  it("returns null for an unknown player", () => {
    expect(matchPlayer("Erling HAALAND", roster("Lionel Messi", "Neymar"))).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(matchPlayer("", roster("Lionel Messi"))).toBeNull();
  });
});
