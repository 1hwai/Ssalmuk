(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const setupScreen = $("setup-screen");
  const gameScreen = $("game-screen");
  const boardElement = $("board");
  const statusTitle = $("status-title");
  const statusDetail = $("status-detail");
  const turnStone = $("turn-stone");
  const moveCount = $("move-count");
  const gameHint = $("game-hint");
  const resultPanel = $("result-panel");
  const undoButton = $("undo-button");
  const passButton = $("pass-button");
  const newButton = $("new-button");

  const EMPTY = 0;
  const BLACK = 1;
  const WHITE = -1;
  const KOMI = 6.5;
  const STAR_POINTS = {
    9: [2, 4, 6],
    13: [3, 6, 9],
    19: [3, 9, 15]
  };

  let state = null;
  let aiTimer = null;

  function freshState(size, mode, humanColor) {
    const board = Array(size * size).fill(EMPTY);
    return {
      size, mode, humanColor, board, turn: BLACK,
      consecutivePasses: 0, moveCount: 0, lastMove: -1,
      finished: false, aiThinking: false, seen: new Set([boardKey(board)]),
      past: []
    };
  }

  function boardKey(board) {
    return board.join(",");
  }

  function neighbors(index, size) {
    const x = index % size;
    const y = Math.floor(index / size);
    const out = [];
    if (x > 0) out.push(index - 1);
    if (x + 1 < size) out.push(index + 1);
    if (y > 0) out.push(index - size);
    if (y + 1 < size) out.push(index + size);
    return out;
  }

  function groupAt(board, start, size) {
    const color = board[start];
    if (color === EMPTY) return { stones: [], liberties: new Set() };
    const stones = [];
    const liberties = new Set();
    const visited = new Set([start]);
    const stack = [start];
    while (stack.length) {
      const current = stack.pop();
      stones.push(current);
      for (const next of neighbors(current, size)) {
        if (board[next] === EMPTY) liberties.add(next);
        else if (board[next] === color && !visited.has(next)) {
          visited.add(next);
          stack.push(next);
        }
      }
    }
    return { stones, liberties };
  }

  function simulateMove(board, index, color, size) {
    if (board[index] !== EMPTY) return null;
    const next = board.slice();
    next[index] = color;
    const captured = [];
    const examined = new Set();
    for (const adjacent of neighbors(index, size)) {
      if (next[adjacent] !== -color || examined.has(adjacent)) continue;
      const group = groupAt(next, adjacent, size);
      for (const stone of group.stones) examined.add(stone);
      if (group.liberties.size === 0) {
        for (const stone of group.stones) {
          next[stone] = EMPTY;
          captured.push(stone);
        }
      }
    }
    const ownGroup = groupAt(next, index, size);
    if (ownGroup.liberties.size === 0) return null;
    return { board: next, captured, ownGroup };
  }

  function snapshot() {
    return {
      size: state.size, mode: state.mode, humanColor: state.humanColor,
      board: state.board.slice(), turn: state.turn,
      consecutivePasses: state.consecutivePasses, moveCount: state.moveCount,
      lastMove: state.lastMove, finished: state.finished,
      aiThinking: false, seen: new Set(state.seen), past: state.past.slice()
    };
  }

  function saveUndoPoint() {
    state.past.push(snapshot());
  }

  function isAiTurn() {
    return state.mode === "ai" && state.turn !== state.humanColor && !state.finished;
  }

  function tryPlay(index, color = state.turn, fromAI = false) {
    if (!state || state.finished || state.aiThinking && !fromAI || color !== state.turn) return false;
    const move = simulateMove(state.board, index, color, state.size);
    if (!move) {
      if (!fromAI) gameHint.textContent = "해당 지점에는 착수할 수 없습니다. 자충수 또는 점유된 교차점입니다.";
      return false;
    }
    const key = boardKey(move.board);
    if (state.seen.has(key)) {
      if (!fromAI) gameHint.textContent = "패 규칙에 따라 이전과 같은 국면을 만들 수 없습니다.";
      return false;
    }

    saveUndoPoint();
    state.board = move.board;
    state.turn = -color;
    state.consecutivePasses = 0;
    state.moveCount += 1;
    state.lastMove = index;
    state.seen.add(key);
    state.aiThinking = false;
    render();
    maybeStartAI();
    return true;
  }

  function passTurn() {
    if (!state || state.finished || state.aiThinking) return;
    saveUndoPoint();
    state.moveCount += 1;
    state.lastMove = -1;
    state.consecutivePasses += 1;
    state.turn = -state.turn;
    if (state.consecutivePasses >= 2) {
      state.finished = true;
      showScore();
    }
    render();
    maybeStartAI();
  }

  function startGame() {
    if (aiTimer) clearTimeout(aiTimer);
    const mode = document.querySelector('input[name="mode"]:checked').value;
    const size = Number(document.querySelector('input[name="board-size"]:checked').value);
    const humanColor = Number(document.querySelector('input[name="player-color"]:checked').value);
    state = freshState(size, mode, humanColor);
    setupScreen.hidden = true;
    gameScreen.hidden = false;
    resultPanel.hidden = true;
    $("game-title").textContent = size + " × " + size + " 바둑";
    gameHint.textContent = mode === "ai"
      ? (humanColor === BLACK ? "사용자는 흑돌입니다. 흑돌이 먼저 둡니다." : "사용자는 백돌입니다. AI가 흑돌로 선공합니다.")
      : "흑돌이 먼저 둡니다. 두 차례 연속 패스하면 대국이 종료됩니다.";
    render();
    maybeStartAI();
  }

  function render() {
    if (!state) return;
    boardElement.style.setProperty("--n", state.size);
    boardElement.setAttribute("aria-label", state.size + " 곱하기 " + state.size + " 바둑판");
    boardElement.replaceChildren();
    const stars = new Set();
    const points = STAR_POINTS[state.size];
    for (const y of points) for (const x of points) {
      if (state.size === 9 && !((x === 4 && y === 4) || ((x === 2 || x === 6) && (y === 2 || y === 6)))) continue;
      stars.add(y * state.size + x);
    }
    for (let i = 0; i < state.board.length; i++) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "intersection";
      button.setAttribute("role", "gridcell");
      button.setAttribute("aria-label", pointLabel(i));
      button.disabled = state.finished || state.aiThinking || isAiTurn() || state.board[i] !== EMPTY;
      if (stars.has(i)) {
        const star = document.createElement("span");
        star.className = "star";
        star.setAttribute("aria-hidden", "true");
        button.append(star);
      }
      if (state.board[i] !== EMPTY) {
        const stone = document.createElement("span");
        stone.className = "stone " + (state.board[i] === BLACK ? "black" : "white");
        stone.setAttribute("aria-hidden", "true");
        button.append(stone);
      }
      if (state.lastMove === i && state.board[i] !== EMPTY) {
        const last = document.createElement("span");
        last.className = "last-move";
        last.setAttribute("aria-hidden", "true");
        button.append(last);
      }
      button.addEventListener("click", () => tryPlay(i));
      boardElement.append(button);
    }

    turnStone.className = "turn-stone " + (state.turn === BLACK ? "black" : "white");
    statusTitle.textContent = state.finished ? "대국 종료" : (state.turn === BLACK ? "흑 차례" : "백 차례");
    if (state.finished) statusDetail.textContent = "계가 결과를 확인하십시오.";
    else if (state.aiThinking) statusDetail.textContent = "AI가 다음 수를 계산하고 있습니다.";
    else if (state.mode === "ai" && state.turn !== state.humanColor) statusDetail.textContent = "AI 대국 중";
    else statusDetail.textContent = "교차점을 선택하여 착수하십시오.";
    moveCount.textContent = state.moveCount + "수";
    undoButton.disabled = state.past.length === 0 || state.aiThinking;
    passButton.disabled = state.finished || state.aiThinking || isAiTurn();
    if (!state.finished) resultPanel.hidden = true;
  }

  function pointLabel(index) {
    const columns = "ABCDEFGHJKLMNOPQRST";
    return columns[index % state.size] + (state.size - Math.floor(index / state.size)) + (state.board[index] === EMPTY ? ", 빈 교차점" : state.board[index] === BLACK ? ", 흑돌" : ", 백돌");
  }

  function maybeStartAI() {
    if (!isAiTurn() || state.aiThinking) return;
    state.aiThinking = true;
    render();
    aiTimer = setTimeout(() => {
      aiTimer = null;
      if (!state || state.finished || !isAiTurn()) return;
      const move = chooseAIMove();
      state.aiThinking = false;
      if (move < 0) passTurnFromAI();
      else if (!tryPlay(move, state.turn, true)) passTurnFromAI();
    }, 140);
  }

  function passTurnFromAI() {
    if (!state || state.finished || !isAiTurn()) return;
    state.aiThinking = false;
    saveUndoPoint();
    state.moveCount += 1;
    state.lastMove = -1;
    state.consecutivePasses += 1;
    state.turn = -state.turn;
    if (state.consecutivePasses >= 2) {
      state.finished = true;
      showScore();
    }
    render();
    maybeStartAI();
  }

  function chooseAIMove() {
    let best = -Infinity;
    let choices = [];
    const size = state.size;
    for (let i = 0; i < state.board.length; i++) {
      if (state.board[i] !== EMPTY) continue;
      const result = simulateMove(state.board, i, state.turn, size);
      if (!result) continue;
      const key = boardKey(result.board);
      if (state.seen.has(key)) continue;
      const score = evaluateMove(i, result, state.turn);
      if (score > best) {
        best = score;
        choices = [i];
      } else if (score >= best - 1.6) {
        choices.push(i);
      }
    }
    if (!choices.length) return -1;
    return choices[Math.floor(Math.random() * choices.length)];
  }

  function evaluateMove(index, result, color) {
    const size = state.size;
    const board = state.board;
    const next = result.board;
    const adjacent = neighbors(index, size);
    let score = result.captured.length * 16;
    score += Math.min(result.ownGroup.liberties.size, 8) * 1.25;
    if (result.ownGroup.liberties.size === 1) score -= 24;
    else if (result.ownGroup.liberties.size === 2) score -= 5;

    for (const n of adjacent) {
      if (board[n] === color) {
        const group = groupAt(board, n, size);
        if (group.liberties.size === 1) score += 12 + group.stones.length * 2;
        else score += 2.5;
      } else if (board[n] === -color) {
        const group = groupAt(board, n, size);
        if (group.liberties.size === 1) score += 13 + group.stones.length * 2;
        else if (group.liberties.size === 2) score += 3;
      } else {
        score += 0.8;
      }
    }

    let nearby = 0;
    const x = index % size;
    const y = Math.floor(index / size);
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
      const distance = Math.abs(dx) + Math.abs(dy);
      const stone = board[ny * size + nx];
      if (stone === color) nearby += distance === 1 ? 2.4 : distance === 2 ? 1.2 : 0.4;
      if (stone === -color) nearby += distance === 1 ? 1.7 : distance === 2 ? 0.7 : 0.2;
    }
    score += Math.min(nearby, 10);
    const edgeDistance = Math.min(x, y, size - 1 - x, size - 1 - y);
    if (edgeDistance === 0) score -= 3;
    else if (edgeDistance === 1) score += 0.3;
    else if (edgeDistance === 2) score += 1.8;
    else if (edgeDistance === 3) score += 1.2;

    const ownEmptyNeighbors = adjacent.filter(n => next[n] === EMPTY).length;
    const friendlyNeighbors = adjacent.filter(n => next[n] === color).length;
    if (result.captured.length === 0 && friendlyNeighbors === adjacent.length && ownEmptyNeighbors === 0) score -= 15;
    score += Math.random() * 0.8;
    return score;
  }

  function scoreBoard() {
    const board = state.board;
    const size = state.size;
    let black = 0, white = KOMI;
    for (const stone of board) {
      if (stone === BLACK) black++;
      else if (stone === WHITE) white++;
    }
    const visited = new Set();
    for (let i = 0; i < board.length; i++) {
      if (board[i] !== EMPTY || visited.has(i)) continue;
      const region = [];
      const borders = new Set();
      const stack = [i];
      visited.add(i);
      while (stack.length) {
        const current = stack.pop();
        region.push(current);
        for (const n of neighbors(current, size)) {
          if (board[n] === EMPTY && !visited.has(n)) {
            visited.add(n);
            stack.push(n);
          } else if (board[n] !== EMPTY) {
            borders.add(board[n]);
          }
        }
      }
      if (borders.size === 1) {
        if (borders.has(BLACK)) black += region.length;
        else white += region.length;
      }
    }
    return { black, white };
  }

  function showScore() {
    const score = scoreBoard();
    const winner = score.black > score.white ? "흑 승리" : score.white > score.black ? "백 승리" : "무승부";
    resultPanel.replaceChildren();
    const title = document.createElement("strong");
    title.textContent = winner + " · 흑 " + score.black + "집 / 백 " + score.white + "집";
    const detail = document.createElement("p");
    detail.textContent = "백 덤 " + KOMI + "집 포함. 단순 집 계산 결과이며, 사활 및 사석은 별도로 판정하지 않았습니다.";
    resultPanel.append(title, detail);
    resultPanel.hidden = false;
    gameHint.textContent = "대국이 종료되었습니다. 새 대국을 시작할 수 있습니다.";
  }

  function undo() {
    if (!state || !state.past.length || state.aiThinking) return;
    if (aiTimer) {
      clearTimeout(aiTimer);
      aiTimer = null;
    }
    let previous = state.past.pop();
    if (state.mode === "ai") {
      if (state.turn === state.humanColor && state.past.length) previous = state.past.pop();
      else if (state.turn !== state.humanColor && state.past.length) previous = state.past.pop();
    }
    state = {
      ...previous,
      board: previous.board.slice(),
      seen: new Set(previous.seen),
      past: previous.past.slice(),
      aiThinking: false
    };
    resultPanel.hidden = true;
    gameHint.textContent = "착수를 취소했습니다.";
    render();
    maybeStartAI();
  }

  function restartGame() {
    if (!state) return;
    startGame();
  }

  document.querySelectorAll('input[name="mode"]').forEach(input => {
    input.addEventListener("change", () => {
      $("color-field").hidden = input.value === "local" && input.checked;
      if (input.value === "local" && input.checked) {
        document.querySelector('input[name="player-color"][value="1"]').checked = true;
      }
    });
  });
  $("start-button").addEventListener("click", startGame);
  $("menu-button").addEventListener("click", () => {
    if (aiTimer) clearTimeout(aiTimer);
    aiTimer = null;
    state = null;
    gameScreen.hidden = true;
    setupScreen.hidden = false;
  });
  $("restart-button").addEventListener("click", restartGame);
  newButton.addEventListener("click", restartGame);
  undoButton.addEventListener("click", undo);
  passButton.addEventListener("click", passTurn);
  document.querySelector('input[name="mode"][value="local"]').addEventListener("change", () => {
    $("color-field").hidden = true;
  });
  document.querySelector('input[name="mode"][value="ai"]').addEventListener("change", () => {
    $("color-field").hidden = false;
  });
})();