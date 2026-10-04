const clamp01 = (value) =>
  Math.max(0, Math.min(1, Number.isFinite(Number(value)) ? Number(value) : 0));

const band = (value, cuts) => {
  for (let i = 0; i < cuts.length; i++) if (value < cuts[i]) return i;
  return cuts.length;
};

export function presentationSignals(state, out = {}) {
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

  out.rain = rain;
  out.wetness = wetness;
  out.sediment = sediment;
  out.contamination = contamination;
  out.flow = flow;
  out.waterQuality = waterQuality;
  out.wetGround = wetGround;
  out.windStrength = windStrength;
  out.windX = 0.72 + rain * 0.18;
  out.windZ = 0.38 - rain * 0.12;
  out.waterRoughness = Math.max(
    0.12,
    Math.min(0.52, 0.18 + rain * 0.14 + sediment * 0.2),
  );
  out.rippleStrength = Math.max(
    0.18,
    Math.min(1, 0.32 + rain * 0.48 + flow * 0.34),
  );
  return out;
}

const supportedConspecifics = ["freshwater", "marsh", "urban"];

const conspecificBand = (state) =>
  band(
    Math.max(
      0,
      ...supportedConspecifics.map((id) =>
        clamp01(state?.squirtleEcology?.abundance?.[id]),
      ),
    ),
    [0.08, 0.28, 0.55],
  );

const shuckerActive = (state) =>
  (state?.squirtleEcology?.shuckerTicks ?? 0) > 0 &&
  clamp01(state?.squirtleEcology?.shuckerPressure) >= 0.35;

const ecotypeName = Object.freeze({
  freshwater: "freshwater",
  marsh: "marsh",
  urban: "urban",
  saltwater: "saltwater",
  deepwater: "deepwater",
});

const naturalList = (items) =>
  items.length <= 1
    ? items[0] || ""
    : items.length === 2
      ? `${items[0]} and ${items[1]}`
      : `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;

export function conspecificMemorySummary(state) {
  const ecology = state?.squirtleEcology,
    records = Array.isArray(state?.memory?.squirtles)
      ? state.memory.squirtles
      : [],
    visibleEcotypes = supportedConspecifics.filter(
      (id) =>
        clamp01(ecology?.abundance?.[id]) >= 0.12 &&
        clamp01(ecology?.suitability?.[id]) >= 0.08,
    ),
    rememberedTypes = [
      ...new Set(records.map((record) => ecotypeName[record.ecotype]).filter(Boolean)),
    ],
    unknown = records.filter((record) => record.state === "unknown").length,
    signs = visibleEcotypes.length
      ? `Squirtle signs persist around ${naturalList(
          visibleEcotypes.map((id) => `${ecotypeName[id]} water`),
        )}.`
      : "Squirtle signs are scarce in the reaches you know.",
    remembered = records.length
      ? ` You remember ${records.length} individual${records.length === 1 ? "" : "s"}${rememberedTypes.length ? ` across ${naturalList(rememberedTypes)} habitat${rememberedTypes.length === 1 ? "" : "s"}` : ""}.`
      : " No individual Squirtle has become familiar yet.",
    missing = unknown
      ? ` ${unknown} remembered individual${unknown === 1 ? " is" : "s are"} currently missing from the usual reach.`
      : "",
    threat = shuckerActive(state)
      ? " Current routes are disturbed by Shucker pressure."
      : "";
  return `${signs}${remembered}${missing}${threat}`;
}

export function observationSnapshot(state) {
  const signals = presentationSignals(state),
    records = Array.isArray(state?.memory?.squirtles)
      ? state.memory.squirtles
      : [];
  return {
    wetness: band(signals.wetness, [0.22, 0.58]),
    clarity: band(
      Math.max(signals.contamination * 1.15, signals.sediment),
      [0.16, 0.45],
    ),
    settlement: state?.settlement?.response || "watch",
    legal: state?.settlement?.legalResponse || "watch",
    frogs: band(clamp01(state?.ecosystem?.labFrogs), [0.08, 0.35]),
    conspecifics: conspecificBand(state),
    rememberedSquirtles: records.length,
    shucker: shuckerActive(state) ? 1 : 0,
  };
}

export function worldTransition(previous, next) {
  if (!previous || !next) return null;
  if (previous.shucker !== next.shucker) {
    return {
      kind: "shucker",
      message: next.shucker
        ? "The known Squirtle routes go quiet. Fresh shell-scrapes break toward cover; Shucker pressure is in the reach."
        : "Webbed tracks begin crossing the reach again. The immediate Shucker pressure has passed.",
    };
  }
  if (previous.legal !== next.legal && ["report", "protect"].includes(next.legal)) {
    return {
      kind: "legal",
      message:
        next.legal === "report"
          ? "The water house stops merely watching. The caretaker withdraws and sends word beyond the reeds."
          : "The caretaker watches the road now, not you. The water house has become a place of cover.",
    };
  }
  if (previous.rememberedSquirtles !== next.rememberedSquirtles) {
    return {
      kind: "conspecific-memory",
      message:
        next.rememberedSquirtles > previous.rememberedSquirtles
          ? "This is no longer only a route through other Squirtles' country. One individual has become familiar enough to remember."
          : "A remembered Squirtle is no longer part of the memory you carry.",
    };
  }
  if (previous.conspecifics !== next.conspecifics) {
    return {
      kind: "conspecifics",
      message:
        next.conspecifics > previous.conspecifics
          ? next.conspecifics >= 2
            ? "Repeated webbed tracks cross the same wet routes. Stillwater is not solitary."
            : "Fresh webbed tracks begin crossing the wet reaches."
          : next.conspecifics === 0
            ? "The webbed tracks thin until the reach feels solitary again."
            : "Same-species traffic has thinned through the wet reaches.",
    };
  }
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
        : "",
    conspecifics = conspecificMemorySummary(state);
  return `Life now: reeds ${reeds}; grazers ${prey}; predators ${predators}; basin frogs ${frogs}.${herd} ${conspecifics}`;
}
