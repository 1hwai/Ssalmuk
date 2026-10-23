(() => {
  "use strict";

  const SIZE = 15;
  const EMPTY = 0;
  const BLACK = 1;
  const WHITE = 2;
  const DIRECTIONS = [[1, 0], [0, 1], [1, 1], [1, -1]];
  const home = document.querySelector("#home");
  const play = document.querySelector("#play");
  const boardElement = document.querySelector("#board");
  const statusTitle = document.querySelector("#status-title");
  const statusDetail = document.querySelector("#status-detail");
  const turnStone = document.querySelector("#turn-stone");
  const moveCount = document.querySelector("#move-count");
  const hint = document.querySelector("#game-hint");
  const undoButton = document.querySelector("#undo-button");
  let board = [];
  let moves = [];
  let mode = "ai";
  let turn = BLACK;
  let finished = false;
  let thinking = false;
  let aiTimer = null;

  function freshBoard() {
    return Array.from({ length: SIZE }, () => Array(SIZE).fill(EMPTY));
  }

  function startGame(nextMode) {
    clearTimeout(aiTimer);
    mode = nextMode;
    board = freshBoard();
    moves = [];
    turn = BLACK;
    finished = false;
    thinking = false;
    home.hidden = true;
    play.hidden = false;
    hint.textContent = mode === "ai" ? "검은 돌이 먼저 둬. AI는 흰 돌이야." : "검은 돌이 먼저 둬. 화면을 번갈아 보며 두면 돼.";
    render();
  }

  function showHome() {
    clearTimeout(aiTimer);
    home.hidden = false;
    play.hidden = true;
  }

  function resetGame() {
    startGame(mode);
  }

  function render() {
    boardElement.replaceChildren();
    const fragment = document.createDocumentFragment();
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "cell";
        cell.setAttribute("role", "gridcell");
        cell.setAttribute("aria-label", `${y + 1}행 ${x + 1}열${board[y][x] === BLACK ? ", 검은 돌" : board[y][x] === WHITE ? ", 흰 돌" : ""}`);
        if (board[y][x] === BLACK) cell.classList.add("black");
        if (board[y][x] === WHITE) cell.classList.add("white");
        const last = moves[moves.length - 1];
        if (last && last.x === x && last.y === y) cell.classList.add("last-move");
        cell.disabled = finished || thinking || board[y][x] !== EMPTY || (mode === "ai" && turn === WHITE);
        cell.addEventListener("click", () => placeStone(x, y));
        fragment.append(cell);
      }
    }
    boardElement.append(fragment);
    moveCount.textContent = `${moves.length}수`;
    turnStone.className = `turn-stone ${turn === BLACK ? "black-stone" : "white-stone"}`;
    undoButton.disabled = moves.length === 0 || thinking;
    if (finished) return;
    if (thinking) {
      statusTitle.textContent = "AI가 생각 중…";
      statusDetail.textContent = "잠깐만 기다려 줘.";
    } else {
      statusTitle.textContent = turn === BLACK ? "흑 차례 · 검은 돌" : "백 차례 · 흰 돌";
      statusDetail.textContent = mode === "ai" && turn === WHITE ? "AI가 두는 중이야." : "원하는 교차점을 눌러 착수해.";
    }
  }

  function placeStone(x, y) {
    if (finished || thinking || board[y][x] !== EMPTY || (mode === "ai" && turn === WHITE)) return;
    board[y][x] = turn;
    moves.push({ x, y, color: turn });
    if (hasWon(x, y, turn)) {
      finished = true;
      render();
      statusTitle.textContent = turn === BLACK ? "흑 승리!" : "백 승리!";
      statusDetail.textContent = mode === "ai" && turn === BLACK ? "AI를 이겼어. 한 판 더?" : "멋진 한 판이었어!";
      hint.textContent = "새 게임을 누르면 다시 시작할 수 있어.";
      return;
    }
    if (moves.length === SIZE * SIZE) {
      finished = true;
      render();
      statusTitle.textContent = "무승부";
      statusDetail.textContent = "판이 꽉 찼어. 한 판 더 할까?";
      return;
    }
    turn = turn === BLACK ? WHITE : BLACK;
    if (mode === "ai" && turn === WHITE) {
      thinking = true;
      render();
      aiTimer = setTimeout(makeAiMove, 260);
    } else {
      render();
    }
  }

  function hasWon(x, y, color) {
    for (const [dx, dy] of DIRECTIONS) {
      let count = 1;
      for (const sign of [-1, 1]) {
        let nx = x + dx * sign;
        let ny = y + dy * sign;
        while (inside(nx, ny) && board[ny][nx] === color) {
          count++;
          nx += dx * sign;
          ny += dy * sign;
        }
      }
      if (count >= 5) return true;
    }
    return false;
  }

  function inside(x, y) {
    return x >= 0 && x < SIZE && y >= 0 && y < SIZE;
  }

  function makeAiMove() {
    if (finished || mode !== "ai") return;
    const move = chooseAiMove();
    thinking = false;
    if (move) {
      board[move.y][move.x] = WHITE;
      moves.push({ ...move, color: WHITE });
      if (hasWon(move.x, move.y, WHITE)) {
        finished = true;
        render();
        statusTitle.textContent = "백 승리!";
        statusDetail.textContent = "AI가 이겼어. 복수전 갈까?";
        hint.textContent = "새 게임을 눌러 다시 도전해 봐.";
        return;
      }
      turn = BLACK;
    }
    render();
  }

  function chooseAiMove() {
    if (moves.length === 0) return { x: 7, y: 7 };
    const candidates = new Set();
    for (const move of moves) {
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const x = move.x + dx;
          const y = move.y + dy;
          if (inside(x, y) && board[y][x] === EMPTY) candidates.add(y * SIZE + x);
        }
      }
    }
    let best = null;
    let bestScore = -Infinity;
    for (const index of candidates) {
      const x = index % SIZE;
      const y = Math.floor(index / SIZE);
      const attack = scorePoint(x, y, WHITE);
      const defend = scorePoint(x, y, BLACK);
      const centerBonus = 7 - (Math.abs(7 - x) + Math.abs(7 - y)) * 0.15;
      const score = Math.max(attack * 1.08, defend) + attack * 0.18 + centerBonus + Math.random() * 0.2;
      if (score > bestScore) {
        bestScore = score;
        best = { x, y };
      }
    }
    return best;
  }

  function scorePoint(x, y, color) {
    let total = 0;
    for (const [dx, dy] of DIRECTIONS) {
      let count = 1;
      let open = 0;
      for (const sign of [-1, 1]) {
        let nx = x + dx * sign;
        let ny = y + dy * sign;
        while (inside(nx, ny) && board[ny][nx] === color) {
          count++;
          nx += dx * sign;
          ny += dy * sign;
        }
        if (inside(nx, ny) && board[ny][nx] === EMPTY) open++;
      }
      if (count >= 5) total += 1000000;
      else if (count === 4 && open === 2) total += 120000;
      else if (count === 4 && open === 1) total += 18000;
      else if (count === 3 && open === 2) total += 4500;
      else if (count === 3 && open === 1) total += 650;
      else if (count === 2 && open === 2) total += 240;
      else if (count === 2 && open === 1) total += 45;
      else if (count === 1 && open === 2) total += 8;
    }
    return total;
  }

  function undoMove() {
    if (moves.length === 0 || thinking) return;
    clearTimeout(aiTimer);
    if (mode === "ai") {
      // In solo mode, take back the latest player move and the AI reply.
      if (moves[moves.length - 1]?.color === WHITE) {
        const aiMove = moves.pop();
        board[aiMove.y][aiMove.x] = EMPTY;
      }
      if (moves.length) {
        const playerMove = moves.pop();
        board[playerMove.y][playerMove.x] = EMPTY;
      }
      turn = BLACK;
    } else {
      const last = moves.pop();
      board[last.y][last.x] = EMPTY;
      turn = last.color;
    }
    finished = false;
    thinking = false;
    render();
    hint.textContent = "한 수 되돌렸어.";
  }

  document.querySelectorAll("[data-mode]").forEach(button => {
    button.addEventListener("click", () => startGame(button.dataset.mode));
  });
  document.querySelector("#back-button").addEventListener("click", showHome);
  document.querySelector("#restart-button").addEventListener("click", resetGame);
  document.querySelector("#new-button").addEventListener("click", resetGame);
  undoButton.addEventListener("click", undoMove);
})();