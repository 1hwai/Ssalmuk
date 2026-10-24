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
      script.onerror = () => reject(new Error("KataGo WASM files are missing. Build and deploy baduk/katago first."));
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

  async function evaluate(board, size, rules) {
    if (!Array.isArray(board) || board.length !== size * size) {
      throw new Error("Invalid board supplied to KataGo evaluator.");
    }
    const module = await getEngine(size);
    const hw = size * size;
    const stonesPtr = module._malloc(hw * 4);
    const policyPtr = module._malloc((hw + 1) * 4);
    const valuePtr = module._malloc(5 * 4);
    const ownerPtr = module._malloc(hw * 4);
    try {
      const stones = new Int32Array(hw);
      for (let i = 0; i < hw; i++) stones[i] = board[i] === 1 ? 1 : board[i] === -1 ? 2 : 0;
      module.HEAP32.set(stones, stonesPtr >> 2);
      const ok = await module.ccall("kgeEval", "number",
        ["number", "number", "number", "number", "number", "number"],
        [stonesPtr, 1, KOMI[rules] ?? 6.5, policyPtr, valuePtr, ownerPtr], { async: true });
      if (!ok) throw new Error("KataGo evaluation failed: " + module.ccall("kgeError", "string", [], []));
      const values = module.HEAPF32.slice(valuePtr >> 2, (valuePtr >> 2) + 5);
      const ownership = module.HEAPF32.slice(ownerPtr >> 2, (ownerPtr >> 2) + hw);
      // kgeEval value outputs 3 and 4 are whiteScoreMean and whiteLead.
      return { whiteScore: values[3], whiteLead: values[4], ownership, modelVersion: module.ccall("kgeModelVersion", "number", [], []) };
    } finally {
      module._free(stonesPtr);
      module._free(policyPtr);
      module._free(valuePtr);
      module._free(ownerPtr);
    }
  }

  window.SsalmukKataGo = { evaluate };
})();
