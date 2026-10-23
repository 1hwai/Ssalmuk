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
    if (location.protocol === "file:") {
      return Promise.reject(new Error("The neural iframe requires http://localhost, not file://."));
    }
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
    const requestedState = state;
    state.engineLoading = true;
    state.aiThinking = true;
    render();
    try {
      const engine = await ensureNeuralEngine();
      if (state !== requestedState || state.mode !== "ai") return;
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
      if (state !== requestedState) return;
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
      const requestedState = state;
      ensureNeuralEngine().then(engine => {
        if (state !== requestedState || state.mode !== "ai") return;
        engine.kataReset();
        state.neuralHistory = [];
        state.engineLoading = false;
        state.aiThinking = false;
        render();
        maybeStartAI();
      }).catch(() => {
        if (state !== requestedState || state.mode !== "ai") return;
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
    boardElement.setAttribute("aria-label", state.size + " 곱하기 " + state.size + " 바둑판");
    drawBoard();

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

  function drawBoard() {
    if(!state)return;
    const rect=boardElement.getBoundingClientRect();if(!rect.width)return;
    const dpr=window.devicePixelRatio||1,px=Math.round(rect.width*dpr);
    if(boardElement.width!==px||boardElement.height!==px){boardElement.width=px;boardElement.height=px;}
    const ctx=boardElement.getContext("2d");ctx.setTransform(dpr,0,0,dpr,0,0);
    const w=rect.width,n=state.size,cell=w/n,edge=cell/2;
    ctx.clearRect(0,0,w,w);ctx.fillStyle="#d9b575";ctx.fillRect(0,0,w,w);
    ctx.strokeStyle="#594327";ctx.lineWidth=Math.max(.65,w/850);ctx.beginPath();
    for(let i=0;i<n;i++){const p=edge+i*cell;ctx.moveTo(edge,p);ctx.lineTo(w-edge,p);ctx.moveTo(p,edge);ctx.lineTo(p,w-edge);}ctx.stroke();
    ctx.fillStyle="#594327";
    for(const y of STAR_POINTS[n])for(const x of STAR_POINTS[n]){
      if(n===9&&!((x===4&&y===4)||((x===2||x===6)&&(y===2||y===6))))continue;
      ctx.beginPath();ctx.arc(edge+x*cell,edge+y*cell,Math.max(1.4,cell*.075),0,Math.PI*2);ctx.fill();
    }
    for(let i=0;i<state.board.length;i++){
      const color=state.board[i];if(color===EMPTY)continue;
      const x=i%n,y=Math.floor(i/n),cx=edge+x*cell,cy=edge+y*cell,r=cell*.44;
      const g=ctx.createRadialGradient(cx-r*.32,cy-r*.36,r*.04,cx,cy,r);
      if(color===BLACK){g.addColorStop(0,"#646464");g.addColorStop(.36,"#252525");g.addColorStop(1,"#030303");}
      else{g.addColorStop(0,"#fff");g.addColorStop(.6,"#faf9f3");g.addColorStop(1,"#d5d0c5");}
      ctx.fillStyle=g;ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fill();
      if(color===WHITE){ctx.strokeStyle="#9b9589";ctx.lineWidth=.7;ctx.stroke();}
    }
    if(state.lastMove>=0&&state.board[state.lastMove]!==EMPTY){
      const x=state.lastMove%n,y=Math.floor(state.lastMove/n);
      ctx.strokeStyle="#c44c36";ctx.lineWidth=Math.max(1.3,cell*.055);ctx.beginPath();ctx.arc(edge+x*cell,edge+y*cell,cell*.19,0,Math.PI*2);ctx.stroke();
    }
  }
  function boardPointFromEvent(event) {
    const rect=boardElement.getBoundingClientRect(),cell=rect.width/state.size;
    const x=Math.round((event.clientX-rect.left)/cell-.5),y=Math.round((event.clientY-rect.top)/cell-.5);
    return x<0||x>=state.size||y<0||y>=state.size?-1:y*state.size+x;
  }

  function pointLabel(index) {
    const columns = "ABCDEFGHJKLMNOPQRST";
    return columns[index % state.size] + (state.size - Math.floor(index / state.size)) + (state.board[index] === EMPTY ? ", 빈 교차점" : state.board[index] === BLACK ? ", 흑돌" : ", 백돌");
  }

  function maybeStartAI() {
    if (!state || !isAiTurn() || state.aiThinking || state.engineLoading || state.engineError) return;
    state.aiThinking = true;
    render();
    const requestedState = state;
    aiTimer = setTimeout(async () => {
      aiTimer = null;
      if (state !== requestedState || state.finished || !isAiTurn()) return;
      try {
        const engine = await ensureNeuralEngine();
        if (state !== requestedState || state.finished || !isAiTurn()) return;
        const legalMoves = [];
        for (let index = 0; index < state.board.length; index++) {
          if (state.board[index] !== EMPTY) continue;
          const result = simulateMove(state.board, index, state.turn, state.size);
          if (result && !state.seen.has(boardKey(result.board))) legalMoves.push(index);
        }
        if (!legalMoves.length) {
          state.aiThinking = false;
          passTurnFromAI();
          return;
        }
        const move = await engine.kataChooseMove(state.size, state.difficulty, legalMoves);
        if (state !== requestedState || state.finished || !isAiTurn()) return;
        state.aiThinking = false;
        if (!move) passTurnFromAI();
        else if (!tryPlay(move.y * state.size + move.x, state.turn, true)) passTurnFromAI();
      } catch (error) {
        if (state !== requestedState) return;
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
    if (!state || !state.past.length || state.aiThinking || state.engineLoading) return;
    if (aiTimer) {
      clearTimeout(aiTimer);
      aiTimer = null;
    }
    const remainingPast = state.past.slice();
    let previous = remainingPast.pop();
    if (state.mode === "ai" && state.turn === state.humanColor && remainingPast.length) {
      previous = remainingPast.pop();
    }
    state = {
      ...previous,
      board: previous.board.slice(),
      seen: new Set(previous.seen),
      neuralHistory: previous.neuralHistory.slice(),
      past: remainingPast,
      aiThinking: false,
      engineLoading: false,
      engineError: false
    };
    resultPanel.hidden = true;
    gameHint.textContent = "착수를 취소했습니다.";
    if (state.mode === "ai") rebuildNeuralEngine();
    else {
      render();
      maybeStartAI();
    }
  }

  function restartGame() {
    if (!state) return;
    startGame();
  }

  document.querySelectorAll('input[name="mode"]').forEach(input => {
    input.addEventListener("change", () => {
      const aiMode = document.querySelector('input[name="mode"]:checked').value === "ai";
      $("color-field").hidden = !aiMode;
      $("difficulty-field").hidden = !aiMode;
      if (!aiMode) document.querySelector('input[name="player-color"][value="1"]').checked = true;
    });
  });
  boardElement.addEventListener("pointerdown", event => {
    if (!state || event.button !== 0) return;
    const index = boardPointFromEvent(event);
    if (index >= 0) tryPlay(index);
  });
  window.addEventListener("resize", () => { if (state && !gameScreen.hidden) drawBoard(); });

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
})();