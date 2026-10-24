(() => {
  "use strict";

  const SCRIPT_URL = "./katago/kataeval.js";
  const MODEL_URL = "./katago/model.bin.gz";
  const KOMI = { korean: 6.5, japanese: 6.5, chinese: 7.5 };
  const instances = new Map();
  let scriptPromise = null;

  function loadScript() {
    if (scriptPromise) return scriptPromise;
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = SCRIPT_URL;
      script.onload = () => {
        if (typeof window.createKata !== "function") {
          reject(new Error("KataGo WASM loader did not expose createKata."));
          return;
        }
        resolve(window.createKata);
      };
      script.onerror = () => reject(new Error("KataGo WASM loader failed to load."));
      document.head.append(script);
    }).catch(error => {
      scriptPromise = null;
      throw error;
    });
    return scriptPromise;
  }

  async function getEngine(size) {
    if (instances.has(size)) return instances.get(size);
    const promise = (async () => {
      const createKata = await loadScript();
      const module = await createKata({
        locateFile: file => "./katago/" + file
      });
      const response = await fetch(MODEL_URL);
      if (!response.ok) throw new Error("KataGo model download failed (" + response.status + ").");
      module.FS.writeFile("/model.bin.gz", new Uint8Array(await response.arrayBuffer()));
      const loaded = await module.ccall("kgeLoad", "number", ["string", "number"], ["/model.bin.gz", size], { async: true });
      if (!loaded) throw new Error("KataGo model load failed: " + module.ccall("kgeError", "string", [], []));
      return module;
    })().catch(error => {
      instances.delete(size);
      throw error;
    });
    instances.set(size, promise);
    return promise;
  }

  function readWinRates(values) {
    // kgeEvalSeq writes probabilities (not logits) to valueOut[0..2].
    // Split the no-result probability evenly so Black + White totals 100%.
    const whiteWin = values[0];
    const whiteLoss = values[1];
    const noResult = values[2];
    if (![whiteWin, whiteLoss, noResult].every(Number.isFinite) ||
        whiteWin < 0 || whiteLoss < 0 || noResult < 0) {
      throw new Error("KataGo returned invalid win probabilities.");
    }
    const total = whiteWin + whiteLoss + noResult;
    if (total <= 0) throw new Error("KataGo returned an empty win-probability distribution.");
    return {
      black: (whiteLoss + noResult * 0.5) / total,
      white: (whiteWin + noResult * 0.5) / total
    };
  }

  async function evaluate(board, size, rules, history, toMove) {
    if (!Array.isArray(board) || board.length !== size * size) {
      throw new Error("Invalid board supplied to KataGo evaluator.");
    }
    if (!Array.isArray(history)) throw new Error("Invalid move history supplied to KataGo evaluator.");
    const module = await getEngine(size);
    const hw = size * size;
    const moves = history.map(action => action.pass ? -1 : action.y * size + action.x);
    const colors = history.map(action => action.color === 1 ? 1 : 2);
    const movesPtr = module._malloc(Math.max(1, moves.length) * 4);
    const colorsPtr = module._malloc(Math.max(1, colors.length) * 4);
    const boardPtr = module._malloc(hw * 4);
    const policyPtr = module._malloc((hw + 1) * 4);
    const valuePtr = module._malloc(5 * 4);
    const ownerPtr = module._malloc(hw * 4);
    try {
      if (moves.length) {
        module.HEAP32.set(Int32Array.from(moves), movesPtr >> 2);
        module.HEAP32.set(Int32Array.from(colors), colorsPtr >> 2);
      }
      const pla = toMove === 1 ? 1 : 2;
      const ok = await module.ccall("kgeEvalSeq", "number",
        ["number", "number", "number", "number", "number", "number", "number", "number", "number"],
        [movesPtr, colorsPtr, moves.length, pla, KOMI[rules] ?? 6.5, boardPtr, policyPtr, valuePtr, ownerPtr],
        { async: true });
      if (!ok) throw new Error("KataGo evaluation failed: " + module.ccall("kgeError", "string", [], ""));
      const values = module.HEAPF32.slice(valuePtr >> 2, (valuePtr >> 2) + 5);
      const rates = readWinRates(Array.from(values.slice(0, 3)));
      const ownership = module.HEAPF32.slice(ownerPtr >> 2, (ownerPtr >> 2) + hw);
      // valueOut[4] is whiteLead (already accounts for komi); the app displays Black minus White.
      const whiteLead = values[4];
      if (!Number.isFinite(whiteLead) || !Number.isFinite(rates.black) || !Number.isFinite(rates.white)) {
        throw new Error("KataGo returned non-finite position values.");
      }
      return {
        blackLead: -whiteLead,
        whiteLead,
        blackWinRate: rates.black,
        whiteWinRate: rates.white,
        ownership,
        modelVersion: module.ccall("kgeModelVersion", "number", [], [])
      };
    } finally {
      module._free(movesPtr);
      module._free(colorsPtr);
      module._free(boardPtr);
      module._free(policyPtr);
      module._free(valuePtr);
      module._free(ownerPtr);
    }
  }

  window.SsalmukKataGo = { evaluate };
})();
