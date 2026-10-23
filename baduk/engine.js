"use strict";

(() => {
  const EMPTY = 0;
  const BLACK = 1;
  const WHITE = -1;
  const STRIDE = 21;
  const KOMI = 6.5;
  const MODEL_URLS = {
    beginner: "https://maksimkorzh.github.io/go/model/kyu/model.json",
    dan: "https://maksimkorzh.github.io/go/model/dan/model.json"
  };

  let board = new Int8Array(STRIDE * STRIDE);
  let side = BLACK;
  let koPoint = -1;
  let history = [];
  let seen = new Set();
  let kyuModel = null;
  let danModel = null;
  let loadPromise = null;

  function point(x, y, boardSize) {
    const offset = Math.floor((19 - boardSize) / 2);
    return (y + offset + 1) * STRIDE + x + offset + 1;
  }

  function adjacent(index) {
    return [index - 1, index + 1, index - STRIDE, index + STRIDE];
  }

  function positionKey(position) {
    return Array.from(position).join(",");
  }

  function group(position, start) {
    const color = position[start];
    if (!color) return { stones: [], liberties: new Set() };
    const stones = [];
    const liberties = new Set();
    const visited = new Set([start]);
    const stack = [start];
    while (stack.length) {
      const current = stack.pop();
      stones.push(current);
      for (const next of adjacent(current)) {
        if (next < 0 || next >= position.length) continue;
        if (position[next] === EMPTY) liberties.add(next);
        else if (position[next] === color && !visited.has(next)) {
          visited.add(next);
          stack.push(next);
        }
      }
    }
    return { stones, liberties };
  }

  function playOn(position, index, color) {
    if (index < 0 || index >= position.length || position[index] !== EMPTY) return null;
    const next = position.slice();
    next[index] = color;
    const captured = [];
    const checked = new Set();
    for (const neighbor of adjacent(index)) {
      if (neighbor < 0 || neighbor >= next.length || next[neighbor] !== -color || checked.has(neighbor)) continue;
      const enemy = group(next, neighbor);
      for (const stone of enemy.stones) checked.add(stone);
      if (!enemy.liberties.size) {
        for (const stone of enemy.stones) {
          next[stone] = EMPTY;
          captured.push(stone);
        }
      }
    }
    const own = group(next, index);
    if (!own.liberties.size) return null;
    return { board: next, captured, own };
  }

  function remember(color, index, pass = false) {
    history.push({ color, index, pass });
    seen.add(positionKey(board));
  }

  async function loadModels() {
    if (loadPromise) return loadPromise;
    loadPromise = (async () => {
      if (!window.tf) throw new Error("TensorFlow.js did not load.");
      try {
        await tf.setBackend("webgl");
        await tf.ready();
      } catch (_) {
        await tf.setBackend("cpu");
        await tf.ready();
      }
      [kyuModel, danModel] = await Promise.all([
        tf.loadGraphModel(MODEL_URLS.beginner),
        tf.loadGraphModel(MODEL_URLS.dan)
      ]);
      return true;
    })().catch(error => {
      loadPromise = null;
      throw error;
    });
    return loadPromise;
  }

  function reset() {
    board = new Int8Array(STRIDE * STRIDE);
    side = BLACK;
    koPoint = -1;
    history = [];
    seen = new Set([positionKey(board)]);
    return true;
  }

  function place(x, y, color, boardSize) {
    const engineColor = color === 1 ? BLACK : WHITE;
    if (side !== engineColor) return false;
    const index = point(x, y, boardSize);
    if (index === koPoint) return false;
    const result = playOn(board, index, engineColor);
    if (!result) return false;
    const oldKey = positionKey(board);
    const newKey = positionKey(result.board);
    if (seen.has(newKey)) return false;
    board = result.board;
    koPoint = result.captured.length === 1 && result.own.stones.length === 1 &&
      result.own.liberties.size === 1 ? result.captured[0] : -1;
    side = -side;
    history.push({ color: engineColor, index, pass: false, previousKey: oldKey });
    seen.add(newKey);
    return true;
  }

  function pass() {
    history.push({ color: side, index: -1, pass: true });
    side = -side;
    koPoint = -1;
    return true;
  }

  function libertyCount(position, index) {
    return group(position, index).liberties.size;
  }

  function encodeInput() {
    const binary = new Float32Array(361 * 22);
    const globals = new Float32Array(19);
    const opponent = -side;
    for (let y = 0; y < 19; y++) {
      for (let x = 0; x < 19; x++) {
        const local = y * 19 + x;
        const offset = local * 22;
        const index = (y + 1) * STRIDE + x + 1;
        binary[offset] = 1;
        if (board[index] === side) binary[offset + 1] = 1;
        if (board[index] === opponent) binary[offset + 2] = 1;
        if (board[index]) {
          const liberties = libertyCount(board, index);
          if (liberties === 1) binary[offset + 3] = 1;
          else if (liberties === 2) binary[offset + 4] = 1;
          else if (liberties === 3) binary[offset + 5] = 1;
        }
        if (index === koPoint) binary[offset + 6] = 1;
      }
    }

    const recent = history.slice(-5).reverse();
    for (let i = 0; i < recent.length; i++) {
      const move = recent[i];
      const plane = 9 + i;
      if (move.pass) {
        globals[i] = 1;
        continue;
      }
      const x = move.index % STRIDE - 1;
      const y = Math.floor(move.index / STRIDE) - 1;
      if (x >= 0 && x < 19 && y >= 0 && y < 19) binary[(y * 19 + x) * 22 + plane] = 1;
    }
    globals[5] = (side === WHITE ? KOMI + 1 : -KOMI) / 20;
    return { binary, globals };
  }

  async function chooseMove(boardSize, difficulty, legalMoves) {
    await loadModels();
    const { binary, globals } = encodeInput();
    const binaryTensor = tf.tensor(binary, [1, 361, 22], "float32");
    const globalTensor = tf.tensor(globals, [1, 19], "float32");
    let outputs = [];
    let sliced = null;
    try {
      const advanced = difficulty === "advanced" || difficulty === "expert";
      const model = advanced ? danModel : kyuModel;
      outputs = await model.executeAsync({
        "swa_model/bin_inputs": binaryTensor,
        "swa_model/global_inputs": globalTensor
      });
      const policyTensor = advanced ? outputs[1] : outputs[3];
      sliced = policyTensor.slice([0, 0, 0], [1, 1, 361]);
      const policy = (await sliced.array())[0][0];
      const offset = Math.floor((19 - boardSize) / 2);
      const candidates = [];
      for (const moveIndex of legalMoves) {
        const x = moveIndex % boardSize;
        const y = Math.floor(moveIndex / boardSize);
        const internal = point(x, y, boardSize);
        if (board[internal] !== EMPTY) continue;
        const px = x + offset;
        const py = y + offset;
        const probability = policy[py * 19 + px];
        if (Number.isFinite(probability)) candidates.push({ x, y, probability });
      }
      if (!candidates.length) return null;
      candidates.sort((a, b) => b.probability - a.probability);
      const topCount = difficulty === "beginner" ? 12
        : difficulty === "intermediate" ? 5
        : difficulty === "advanced" ? 2 : 1;
      const pool = candidates.slice(0, Math.min(topCount, candidates.length));
      return pool[Math.floor(Math.random() * pool.length)];
    } finally {
      if (sliced) sliced.dispose();
      for (const output of outputs) if (output && typeof output.dispose === "function") output.dispose();
      binaryTensor.dispose();
      globalTensor.dispose();
    }
  }

  window.kataReset = reset;
  window.kataPlace = place;
  window.kataPass = pass;
  window.kataChooseMove = chooseMove;
  window.kataLoad = loadModels;
})();
