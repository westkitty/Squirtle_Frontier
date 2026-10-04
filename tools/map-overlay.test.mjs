import test from "node:test";
import assert from "node:assert/strict";
import {
  drinkTrackMarkers,
  followedReachTraces,
  rememberedLandmarkMarkers,
  surveyedCells,
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


test("surveyed cells encode revisit intensity without changing map footprint", () => {
  const cells = surveyedCells({
    cells: {
      "0,0": 1,
      "1,0": 32,
    },
  });
  assert.equal(cells.length, 2);
  assert.equal(cells[0].x, 70);
  assert.equal(cells[0].y, 70);
  assert.ok(cells[1].opacity > cells[0].opacity);
  assert.ok(cells.every((cell) => cell.opacity >= 0.32 && cell.opacity <= 0.92));
});

test("drink observations become bounded survey markers from existing memory", () => {
  const markers = drinkTrackMarkers({
    drinks: {
      "-1,2": 1,
      "3,-4": 64,
    },
  });
  assert.equal(markers.length, 2);
  assert.ok(markers[1].radius > markers[0].radius);
  assert.ok(markers[1].opacity > markers[0].opacity);
  assert.ok(
    markers.every(
      (marker) =>
        marker.x >= 2.5 &&
        marker.x <= 142.5 &&
        marker.y >= 2.5 &&
        marker.y <= 142.5,
    ),
  );
});

test("followed reach traces expose their downstream mouth without revealing unwalked reaches", () => {
  const traces = followedReachTraces({ reaches: ["spring-gully"] }, 18);
  assert.equal(traces.length, 1);
  assert.deepEqual(traces[0].mouth, traces[0].points.at(-1));
  assert.ok(traces[0].mouth.x >= 2 && traces[0].mouth.x <= 143);
  assert.ok(traces[0].mouth.y >= 2 && traces[0].mouth.y <= 143);
});
