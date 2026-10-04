const clamp01 = (value) =>
  Math.max(0, Math.min(1, Number.isFinite(Number(value)) ? Number(value) : 0));

const band = (value, cuts) => {
  for (let i = 0; i < cuts.length; i++) if (value < cuts[i]) return i;
  return cuts.length;
};

export function presentationSignals(state) {
  const wetland =
      state?.watershed?.nodes?.find?.((node) => node.id === "wetland") ||
      state?.watershed?.nodes?.[2] ||
      {},
    rain = clamp01(state?.frontier?.weather?.rain),
    wetness = clamp01(wetland.wetness),
    sediment = clamp01(wetland.sediment),
    contamination = clamp01(wetland.contamination),
    flow = clamp01(wetland.flow),
    waterQuality = clamp01((1 - contamination) * (1 - sediment * 0.5)),
    wetGround = clamp01(rain * 0.72 + wetness * 0.22),
    windStrength = clamp01(0.18 + rain * 0.72 + flow * 0.08);

  return {
    rain,
    wetness,
    sediment,
    contamination,
    flow,
    waterQuality,
    wetGround,
    windStrength,
    windX: 0.72 + rain * 0.18,
    windZ: 0.38 - rain * 0.12,
    waterRoughness: Math.max(
      0.12,
      Math.min(0.52, 0.18 + rain * 0.14 + sediment * 0.2),
    ),
    rippleStrength: Math.max(
      0.18,
      Math.min(1, 0.32 + rain * 0.48 + flow * 0.34),
    ),
  };
}

export function observationSnapshot(state) {
  const signals = presentationSignals(state);
  return {
    wetness: band(signals.wetness, [0.22, 0.58]),
    clarity: band(
      Math.max(signals.contamination * 1.15, signals.sediment),
      [0.16, 0.45],
    ),
    settlement: state?.settlement?.response || "watch",
    frogs: band(clamp01(state?.ecosystem?.labFrogs), [0.08, 0.35]),
  };
}

export function worldTransition(previous, next) {
  if (!previous || !next) return null;
  if (previous.settlement !== next.settlement) {
    return {
      kind: "settlement",
      message: {
        withdraw: "The water house goes quiet; the caretaker has pulled back.",
        "check-water":
          "The caretaker leaves the doorway and checks the failing water.",
        watch: "The caretaker returns to the doorway and watches the bank.",
        welcome:
          "The water house has changed its mind about you. A bowl appears by the door.",
      }[next.settlement],
    };
  }
  if (previous.wetness !== next.wetness) {
    return {
      kind: "wetland",
      message:
        next.wetness > previous.wetness
          ? next.wetness === 2
            ? "Water reaches farther into the reed shallows."
            : "The reedbed darkens as water returns."
          : next.wetness === 0
            ? "The shallows pull back, exposing pale mud."
            : "The wetland is beginning to recede.",
    };
  }
  if (previous.clarity !== next.clarity) {
    return {
      kind: "clarity",
      message:
        next.clarity > previous.clarity
          ? "The current turns visibly heavier with suspended earth."
          : "The current clears enough to show the bottom again.",
    };
  }
  if (previous.frogs !== next.frogs) {
    return {
      kind: "frogs",
      message:
        next.frogs > previous.frogs
          ? "A few reed frogs have begun calling from the basin."
          : "The frog calls thin out as the basin changes.",
    };
  }
  return null;
}

const abundance = (value) => {
  const v = clamp01(value);
  return v < 0.2
    ? "scarce"
    : v < 0.5
      ? "present"
      : v < 0.78
        ? "common"
        : "abundant";
};

export function ecologySummary(state, wildlife = null) {
  const ecosystem = state?.ecosystem || {},
    reeds = abundance(ecosystem.reeds),
    prey = abundance(ecosystem.prey),
    predators = abundance(ecosystem.predators),
    frogs = abundance(ecosystem.labFrogs),
    herd = wildlife?.parched
      ? " Nearby grazers are pacing for drinkable water."
      : wildlife?.drinkers?.length
        ? " Nearby grazers are drinking at the shore."
        : "";
  return `Life now: reeds ${reeds}; grazers ${prey}; predators ${predators}; basin frogs ${frogs}.${herd}`;
}
