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
  const engineFrame = $("kata-engine");
  let engineLoadPromise = null;

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

  function freshState(size, mode, humanColor, difficulty) {
    const board = Array(size * size).fill(EMPTY);
    return {
      size, mode, humanColor, difficulty, board, turn: BLACK,
      consecutivePasses: 0, moveCount: 0, lastMove: -1,
      finished: false, aiThinking: false, engineLoading: false, engineError: false,
      seen: new Set([boardKey(board)]), neuralHistory: [], past: []
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
      difficulty: state.difficulty, board: state.board.slice(), turn: state.turn,
      consecutivePasses: state.consecutivePasses, moveCount: state.moveCount,
      lastMove: state.lastMove, finished: state.finished,
      aiThinking: false, engineLoading: false, engineError: false,
      seen: new Set(state.seen), neuralHistory: state.neuralHistory.slice()
    };
  }

  function saveUndoPoint() {
    state.past.push(snapshot());
  }

  function isAiTurn() {
    return state.mode === "ai" && state.turn !== state.humanColor && !state.finished;
  }

  function ensureNeuralEngine() {
    if (engineLoadPromise) return engineLoadPromise;
    if (!engineFrame.getAttribute("src")) engineFrame.src = "./engine.html";
    engineLoadPromise = new Promise((resolve, reject) => {
      const started = Date.now();
      function poll() {
        const engine = engineFrame.contentWindow;
        if (engine && typeof engine.kataChooseMove === "function" && typeof engine.kataReset === "function" && engine.danModel && engine.kyuModel) {
          resolve(engine);
          return;
        }
        if (Date.now() - started > 180000) {
          engineLoadPromise = null;
          reject(new Error("KataNet model loading timed out."));
          return;
        }
        setTimeout(poll, 200);
      }
      poll();
    });
    return engineLoadPromise;
  }

  async function rebuildNeuralEngine() {
    if (!state || state.mode !== "ai") return;
    state.engineLoading = true;
    state.aiThinking = true;
    render();
    try {
      const engine = await ensureNeuralEngine();
      if (!state || state.mode !== "ai") return;
      engine.kataReset();
      for (const action of state.neuralHistory) {
        if (action.pass) engine.kataPass();
        else if (!engine.kataPlace(action.x, action.y, action.color, state.size)) {
          throw new Error("Could not restore neural engine move history.");
        }
      }
      state.engineLoading = false;
      state.aiThinking = false;
      state.engineError = false;
      render();
      maybeStartAI();
    } catch (error) {
      if (!state) return;
      state.engineLoading = false;
      state.aiThinking = false;
      state.engineError = true;
      render();
      gameHint.textContent = "AI 대국 상태를 복원하지 못했습니다. 새 대국을 시작하십시오.";
    }
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

    if (state.mode === "ai") {
      const engine = engineFrame.contentWindow;
      const x = index % state.size;
      const y = Math.floor(index / state.size);
      if (!engine || typeof engine.kataPlace !== "function" || !engine.kataPlace(x, y, color, state.size)) {
        if (!fromAI) gameHint.textContent = "AI 엔진과 대국 상태가 일치하지 않습니다. 새 대국을 시작하십시오.";
        return false;
      }
    }

    saveUndoPoint();
    state.neuralHistory.push({ x: index % state.size, y: Math.floor(index / state.size), color });
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
    if (state.mode === "ai") {
      const engine = engineFrame.contentWindow;
      if (!engine || typeof engine.kataPass !== "function") return;
      engine.kataPass();
    }
    saveUndoPoint();
    state.neuralHistory.push({ pass: true, color: state.turn });
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
    const difficulty = $("ai-difficulty").value;
    state = freshState(size, mode, humanColor, difficulty);
    setupScreen.hidden = true;
    gameScreen.hidden = false;
    resultPanel.hidden = true;
    $("game-title").textContent = size + " × " + size + " 바둑";
    gameHint.textContent = mode === "ai"
      ? (humanColor === BLACK ? "사용자는 흑돌입니다. 흑돌이 먼저 둡니다." : "사용자는 백돌입니다. AI가 흑돌로 선공합니다.")
      : "흑돌이 먼저 둡니다. 두 차례 연속 패스하면 대국이 종료됩니다.";
    if (mode === "ai") {
      state.engineLoading = true;
      state.aiThinking = true;
      render();
      ensureNeuralEngine().then(engine => {
        if (!state || state.mode !== "ai") return;
        engine.kataReset();
        state.neuralHistory = [];
        state.engineLoading = false;
        state.aiThinking = false;
        render();
        maybeStartAI();
      }).catch(() => {
        if (!state || state.mode !== "ai") return;
        state.engineLoading = false;
        state.aiThinking = false;
        state.engineError = true;
        render();
        gameHint.textContent = "AI 모델을 불러오지 못했습니다. 네트워크 연결을 확인한 뒤 새 대국을 시작하십시오.";
      });
    } else {
      render();
    }
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
      button.disabled = state.finished || state.aiThinking || state.engineLoading || state.engineError || isAiTurn() || state.board[i] !== EMPTY;
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
    else if (state.engineError) statusDetail.textContent = "AI 엔진을 사용할 수 없습니다.";
    else if (state.engineLoading) statusDetail.textContent = "신경망 AI 모델을 불러오는 중입니다.";
    else if (state.aiThinking) statusDetail.textContent = "신경망 AI가 다음 수를 계산하고 있습니다.";
    else if (state.mode === "ai" && state.turn !== state.humanColor) statusDetail.textContent = "AI 대국 중";
    else statusDetail.textContent = "교차점을 선택하여 착수하십시오.";
    moveCount.textContent = state.moveCount + "수";
    undoButton.disabled = state.past.length === 0 || state.aiThinking || state.engineLoading || (state.mode === "ai" && !state.neuralHistory.some(action => !action.pass && action.color === state.humanColor));
    passButton.disabled = state.finished || state.aiThinking || state.engineLoading || state.engineError || isAiTurn();
    if (!state.finished) resultPanel.hidden = true;
  }

  function pointLabel(index) {
    const columns = "ABCDEFGHJKLMNOPQRST";
    return columns[index % state.size] + (state.size - Math.floor(index / state.size)) + (state.board[index] === EMPTY ? ", 빈 교차점" : state.board[index] === BLACK ? ", 흑돌" : ", 백돌");
  }

  function maybeStartAI() {
    if (!state || !isAiTurn() || state.aiThinking || state.engineLoading || state.engineError) return;
    state.aiThinking = true;
    render();
    aiTimer = setTimeout(async () => {
      aiTimer = null;
      if (!state || state.finished || !isAiTurn()) return;
      try {
        const engine = await ensureNeuralEngine();
        if (!state || state.finished || !isAiTurn()) return;
        const move = await engine.kataChooseMove(state.size, state.difficulty);
        if (!state || state.finished || !isAiTurn()) return;
        state.aiThinking = false;
        if (!move) passTurnFromAI();
        else if (!tryPlay(move.y * state.size + move.x, state.turn, true)) passTurnFromAI();
      } catch (error) {
        if (!state) return;
        state.aiThinking = false;
        state.engineError = true;
        render();
        gameHint.textContent = "신경망 AI 계산에 실패했습니다. 새 대국을 시작하십시오.";
      }
    }, 80);
  }

  function passTurnFromAI() {
    if (!state || state.finished || !isAiTurn()) return;
    const engine = engineFrame.contentWindow;
    if (!engine || typeof engine.kataPass !== "function") {
      state.engineError = true;
      render();
      return;
    }
    engine.kataPass();
    saveUndoPoint();
    state.neuralHistory.push({ pass: true, color: state.turn });
    state.aiThinking = false;
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
      past: state.past.slice(),
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