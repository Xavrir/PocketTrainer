import assert from "node:assert/strict";
import test from "node:test";

import { CONTRACTS_VERSION } from "../dist/index.js";

test("contracts expose an explicit compatibility version", () => {
  assert.equal(CONTRACTS_VERSION, "0.1.0");
});
