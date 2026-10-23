"use strict";

(() => {
  const EMPTY = 0;
  const BLACK = 1;
  const WHITE = -1;

  let board = [];
  let boardSize = 19;
  let side = BLACK;
  let history = [];
  let seen = new Set();

  function key(position) {
    return position.join(",");
  }

  function neighbors(index, size = boardSize) {
    const x = index % size;
    const y = Math.floor(index / size);
    const result = [];
    if (x > 0) result.push(index - 1);
    if (x + 1 < size) result.push(index + 1);
    if (y > 0) result.push(index - size);
    if (y + 1 < size) result.push(index + size);
    return result;
  }

  function group(position, start, size = boardSize) {
    const color = position[start];
    if (color === EMPTY) return { stones: [], liberties: new Set() };
    const stones = [];
    const liberties = new Set();
    const visited = new Set([start]);
    const stack = [start];
    while (stack.length) {
      const current = stack.pop();
      stones.push(current);
      for (const next of neighbors(current, size)) {
        if (position[next] === EMPTY) liberties.add(next);
        else if (position[next] === color && !visited.has(next)) {
          visited.add(next);
          stack.push(next);
        }
      }
    }
    return { stones, liberties };
  }

  function play(position, index, color, size = boardSize) {
    if (index < 0 || index >= position.length || position[index] !== EMPTY) return null;
    const next = position.slice();
    next[index] = color;
    const captured = [];
    const examined = new Set();
    for (const adjacent of neighbors(index, size)) {
      if (next[adjacent] !== -color || examined.has(adjacent)) continue;
      const enemy = group(next, adjacent, size);
      for (const stone of enemy.stones) examined.add(stone);
      if (!enemy.liberties.size) {
        for (const stone of enemy.stones) {
          next[stone] = EMPTY;
          captured.push(stone);
        }
      }
    }
    const own = group(next, index, size);
    if (!own.liberties.size) return null;
    return { board: next, captured, own };
  }

  function reset(size = 19) {
    boardSize = [9, 13, 19].includes(size) ? size : 19;
    board = Array(boardSize * boardSize).fill(EMPTY);
    side = BLACK;
    history = [];
    seen = new Set([key(board)]);
    return true;
  }

  function place(x, y, color, size) {
    if (size !== boardSize || color !== side || x < 0 || y < 0 || x >= size || y >= size) return false;
    const index = y * size + x;
    const result = play(board, index, color, size);
    if (!result || seen.has(key(result.board))) return false;
    board = result.board;
    side = -side;
    history.push({ color, index, pass: false });
    seen.add(key(board));
    return true;
  }

  function pass() {
    history.push({ color: side, index: -1, pass: true });
    side = -side;
    return true;
  }

  function localShapeScore(position, index, color, result, size) {
    const x = index % size, y = Math.floor(index / size);
    let score = 0;
    const ownGroups = new Set();
    const enemyGroups = new Set();
    for (const n of neighbors(index, size)) {
      if (position[n] === color) {
        const g = group(position, n, size);
        const id = g.stones[0];
        if (!ownGroups.has(id)) {
          ownGroups.add(id);
          score += g.liberties.size === 1 ? 3.8 : g.liberties.size === 2 ? 1.2 : 0.35;
          if (g.liberties.size === 1) score += 2.5;
        }
      } else if (position[n] === -color) {
        const g = group(position, n, size);
        const id = g.stones[0];
        if (!enemyGroups.has(id)) {
          enemyGroups.add(id);
          if (g.liberties.size === 1) score += 10 + g.stones.length * 2.5;
          else if (g.liberties.size === 2) score += 2.2;
        }
      } else {
        score += 0.25;
      }
    }
    score += result.captured.length * 12;
    const liberties = result.own.liberties.size;
    score += liberties === 1 ? -13 : liberties === 2 ? -2.5 : Math.min(liberties, 6) * 0.55;
    const center = (size - 1) / 2;
    const distance = Math.abs(x - center) + Math.abs(y - center);
    score += (size - distance) * 0.13;
    return score;
  }

  function influenceScore(position, index, color, size) {
    const x = index % size, y = Math.floor(index / size);
    let nearestOwn = size * 2, nearestEnemy = size * 2, nearby = 0;
    for (let i = 0; i < position.length; i++) {
      if (!position[i]) continue;
      const distance = Math.abs(x - i % size) + Math.abs(y - Math.floor(i / size));
      if (distance <= 4) nearby++;
      if (position[i] === color) nearestOwn = Math.min(nearestOwn, distance);
      else nearestEnemy = Math.min(nearestEnemy, distance);
    }
    if (nearestOwn === size * 2 && nearestEnemy === size * 2) return 1.5;
    let score = 0;
    if (nearestOwn <= 4) score += (5 - nearestOwn) * 0.9;
    if (nearestEnemy <= 3) score += (4 - nearestEnemy) * 0.65;
    if (nearby === 0) score += 0.5;
    return score;
  }

  function scoreMove(position, index, color, size, difficulty) {
    const result = play(position, index, color, size);
    if (!result) return -Infinity;
    let score = localShapeScore(position, index, color, result, size)
      + influenceScore(position, index, color, size);

    // Avoid moves that let an adjacent friendly group remain in atari.
    const checked = new Set();
    for (const n of neighbors(index, size)) {
      if (result.board[n] !== color || checked.has(n)) continue;
      const g = group(result.board, n, size);
      for (const stone of g.stones) checked.add(stone);
      if (g.liberties.size === 1) score -= g.stones.length * 2.8;
    }

    // One-ply tactical check: reward moves that prevent an immediate capture
    // and discount moves that can be captured straight away.
    const opponent = -color;
    let immediateCaptureThreat = 0;
    for (const n of neighbors(index, size)) {
      if (result.board[n] !== opponent) continue;
      const enemyGroup = group(result.board, n, size);
      if (enemyGroup.liberties.size === 1) immediateCaptureThreat += enemyGroup.stones.length;
    }
    score += immediateCaptureThreat * 0.8;

    if (difficulty === "beginner") score += Math.random() * 5;
    else if (difficulty === "intermediate") score += Math.random() * 1.8;
    else if (difficulty === "advanced") score += Math.random() * 0.55;
    else score += Math.random() * 0.12;
    return score;
  }

  async function chooseMove(size, difficulty, legalMoves) {
    if (size !== boardSize || side === EMPTY) return null;
    if (!legalMoves.length) return null;
    const ranked = [];
    for (const index of legalMoves) {
      if (index < 0 || index >= board.length || board[index] !== EMPTY) continue;
      const result = play(board, index, side, size);
      if (!result || seen.has(key(result.board))) continue;
      ranked.push({ index, score: scoreMove(board, index, side, size, difficulty) });
    }
    if (!ranked.length) return null;
    ranked.sort((a, b) => b.score - a.score);
    const poolSize = difficulty === "beginner" ? 14
      : difficulty === "intermediate" ? 6
      : difficulty === "advanced" ? 3 : 1;
    const pool = ranked.slice(0, Math.min(poolSize, ranked.length));
    const chosen = pool[Math.floor(Math.random() * pool.length)].index;
    return { x: chosen % size, y: Math.floor(chosen / size) };
  }

  window.ssalmukReset = reset;
  window.ssalmukPlace = place;
  window.ssalmukPass = pass;
  window.ssalmukChooseMove = chooseMove;
  window.ssalmukLoad = () => Promise.resolve(true);
})();
