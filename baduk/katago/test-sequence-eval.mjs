import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const createKata = require("./kataeval.js");
const module = await createKata();

const fail = message => {
  console.error("FAIL:", message);
  process.exitCode = 1;
};

try {
  module.ccall("kgeSetForceCpu", null, ["number"], [1]);
  module.FS.writeFile("/ssalmuk-model.bin.gz", new Uint8Array(readFileSync(new URL("./model.bin.gz", import.meta.url))));
  const loaded = await module.ccall("kgeLoad", "number", ["string", "number"],
    ["/ssalmuk-model.bin.gz", 19], { async: true });
  if (!loaded) throw new Error("kgeLoad: " + module.ccall("kgeError", "string", [], []));

  const size = 19;
  const hw = size * size;
  const movesPtr = module._malloc(4);
  const colorsPtr = module._malloc(4);
  const boardPtr = module._malloc(hw * 4);
  const policyPtr = module._malloc((hw + 1) * 4);
  const valuePtr = module._malloc(5 * 4);
  const ownerPtr = module._malloc(hw * 4);
  try {
    // One legal Black move at the center; White is next to play.
    module.HEAP32[movesPtr >> 2] = 180;
    module.HEAP32[colorsPtr >> 2] = 1;
    const ok = await module.ccall("kgeEvalSeq", "number",
      ["number", "number", "number", "number", "number", "number", "number", "number", "number"],
      [movesPtr, colorsPtr, 1, 2, 6.5, boardPtr, policyPtr, valuePtr, ownerPtr],
      { async: true });
    if (!ok) throw new Error("kgeEvalSeq: " + module.ccall("kgeError", "string", [], []));
    if (module.HEAP32[(boardPtr >> 2) + 180] !== 1) {
      throw new Error("KataGo replay did not preserve the test move.");
    }
    const values = Array.from(module.HEAPF32.slice(valuePtr >> 2, (valuePtr >> 2) + 5));
    if (!values.every(Number.isFinite)) throw new Error("KataGo returned non-finite evaluation values.");
    if (values[0] < -20 || values[0] > 20 || values[1] < -20 || values[1] > 20 ||
        values[2] < -20 || values[2] > 20) {
      throw new Error("KataGo win/loss outputs are outside a plausible logit range.");
    }
    const maxLogit = Math.max(values[0], values[1], values[2]);
    const weights = values.slice(0, 3).map(value => Math.exp(value - maxLogit));
    const total = weights.reduce((sum, value) => sum + value, 0);
    const blackWinRate = (weights[1] + weights[2] * 0.5) / total;
    const whiteWinRate = (weights[0] + weights[2] * 0.5) / total;
    if (![blackWinRate, whiteWinRate].every(Number.isFinite) ||
        Math.abs(blackWinRate + whiteWinRate - 1) > 1e-6 ||
        blackWinRate < 0 || blackWinRate > 1 || whiteWinRate < 0 || whiteWinRate > 1) {
      throw new Error("KataGo win-rate conversion failed.");
    }

    const bestPtr = module._malloc(4);
    const searchRatePtr = module._malloc(4);
    const pvPtr = module._malloc(8 * 4);
    const pvLenPtr = module._malloc(4);
    const visitsPtr = module._malloc(4);
    let searchedWhiteWinRate;
    let visits;
    try {
      const searched = await module.ccall("kgeSearch", "number", Array(13).fill("number"),
        [movesPtr, colorsPtr, 1, 2, 6.5, 16, 300, bestPtr, searchRatePtr, pvPtr, 8, pvLenPtr, visitsPtr],
        { async: true });
      if (!searched) throw new Error("kgeSearch: " + module.ccall("kgeError", "string", [], []));
      searchedWhiteWinRate = module.HEAPF32[searchRatePtr >> 2];
      visits = module.HEAP32[visitsPtr >> 2];
      if (!Number.isFinite(searchedWhiteWinRate) ||
          searchedWhiteWinRate < 0 || searchedWhiteWinRate > 1 || visits < 1) {
        throw new Error("KataGo PUCT search returned invalid win rate or visit count.");
      }
    } finally {
      module._free(bestPtr);
      module._free(searchRatePtr);
      module._free(pvPtr);
      module._free(pvLenPtr);
      module._free(visitsPtr);
    }

    console.log("PASS: KataGo WASM v" + module.ccall("kgeModelVersion", "number", [], []) +
      " replayed one move; NN Black " + (blackWinRate * 100).toFixed(1) +
      "% / White " + (whiteWinRate * 100).toFixed(1) + "%; PUCT White " +
      (searchedWhiteWinRate * 100).toFixed(1) + "% across " + visits +
      " visits; score values finite.");
  } finally {
    module._free(movesPtr);
    module._free(colorsPtr);
    module._free(boardPtr);
    module._free(policyPtr);
    module._free(valuePtr);
    module._free(ownerPtr);
  }
} catch (error) {
  fail(error.stack || error.message || String(error));
}
