import test from "node:test";
import assert from "node:assert/strict";
import {
  followedReachTraces,
  rememberedLandmarkMarkers,
} from "../src/map-overlay.js";

test("survey overlays reveal only places the player has actually remembered", () => {
  const markers = rememberedLandmarkMarkers({
    places: ["bank", "wetland"],
  });
  assert.deepEqual(
    markers.map((marker) => marker.id),
    ["bank", "wetland"],
  );
  assert.ok(markers.every((marker) => marker.x >= 2 && marker.x <= 143));
  assert.ok(markers.every((marker) => marker.y >= 2 && marker.y <= 143));
});

test("followed waterways become bounded lightweight survey traces", () => {
  const traces = followedReachTraces({ reaches: ["north-run"] }, 24);
  assert.equal(traces.length, 1);
  assert.equal(traces[0].id, "north-run");
  assert.ok(traces[0].points.length >= 2 && traces[0].points.length <= 25);
  assert.ok(
    traces[0].points.every(
      (point) =>
        point.x >= 2 && point.x <= 143 && point.y >= 2 && point.y <= 143,
    ),
  );
});
