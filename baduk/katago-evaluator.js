(() => {
  "use strict";

  let worker = null;
  let nextRequestId = 1;
  const pending = new Map();

  function getWorker() {
    if (worker) return worker;
    if (typeof Worker === "undefined") throw new Error("This browser does not support Web Workers.");
    worker = new Worker("./katago-worker.js");
    worker.onmessage = event => {
      const { id, result, error } = event.data || {};
      const request = pending.get(id);
      if (!request) return;
      pending.delete(id);
      if (error) request.reject(new Error(error));
      else request.resolve(result);
    };
    worker.onerror = event => {
      const error = new Error(event.message || "KataGo worker failed.");
      for (const request of pending.values()) request.reject(error);
      pending.clear();
      worker.terminate();
      worker = null;
    };
    return worker;
  }

  function evaluate(board, size, rules, history, toMove) {
    const id = nextRequestId++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      try {
        getWorker().postMessage({
          id,
          payload: { board, size, rules, history, toMove }
        });
      } catch (error) {
        pending.delete(id);
        reject(error);
      }
    });
  }

  window.SsalmukKataGo = { evaluate };
})();
