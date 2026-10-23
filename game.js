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
  const difficultyControl = document.querySelector("#difficulty-control");
  const difficultySelect = document.querySelector("#difficulty-select");
  const colorDialog = document.querySelector("#color-dialog");
  const startAiButton = document.querySelector("#start-ai-button");
  const cancelSetupButton = document.querySelector("#cancel-setup-button");
  let board = [];
  let moves = [];
  let mode = "ai";
  let difficulty = "intermediate";
  let humanColor = BLACK;
  let aiColor = WHITE;
  let turn = BLACK;
  let finished = false;
  let thinking = false;
  let aiTimer = null;

  function freshBoard() {
    return Array.from({ length: SIZE }, () => Array(SIZE).fill(EMPTY));
  }

  function startGame(nextMode, selectedHumanColor = BLACK) {
    clearTimeout(aiTimer);
    mode = nextMode;
    difficultyControl.hidden = mode !== "ai";
    difficulty = difficultySelect.value;
    humanColor = selectedHumanColor;
    aiColor = humanColor === BLACK ? WHITE : BLACK;
    board = freshBoard();
    moves = [];
    turn = BLACK;
    finished = false;
    thinking = false;
    home.hidden = true;
    play.hidden = false;
    hint.textContent = mode === "ai" ? "선공 설정 완료." : "흑 선공.";
    render();
    if (mode === "ai" && turn === aiColor) scheduleAiMove();
  }

  function scheduleAiMove() {
    thinking = true;
    render();
    aiTimer = setTimeout(makeAiMove, 260);
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
        cell.disabled = finished || thinking || board[y][x] !== EMPTY || (mode === "ai" && turn === aiColor);
        cell.addEventListener("click", () => placeStone(x, y));
        fragment.append(cell);
      }
    }
    boardElement.append(fragment);
    moveCount.textContent = `${moves.length}수`;
    turnStone.className = `turn-stone ${turn === BLACK ? "black-stone" : "white-stone"}`;
    undoButton.disabled = thinking || (mode === "ai"
      ? !moves.some(move => move.color === humanColor)
      : moves.length === 0);
    if (finished) return;
    if (thinking) {
      statusTitle.textContent = `AI 차례 · ${turn === BLACK ? "흑" : "백"}`;
      statusDetail.textContent = "AI 연산 중";
    } else {
      statusTitle.textContent = turn === BLACK ? "흑 차례" : "백 차례";
      statusDetail.textContent = mode === "ai" && turn === aiColor ? "AI 착수 대기." : "교차점을 선택하여 착수하십시오.";
    }
  }

  function placeStone(x, y) {
    if (finished || thinking || board[y][x] !== EMPTY || (mode === "ai" && turn === aiColor)) return;
    board[y][x] = turn;
    moves.push({ x, y, color: turn });
    if (hasWon(x, y, turn)) {
      finished = true;
      render();
      statusTitle.textContent = turn === BLACK ? "흑 승리!" : "백 승리!";
      statusDetail.textContent = mode === "ai" && turn === humanColor ? "AI 대전 승리." : "대국 종료.";
      hint.textContent = "새 게임으로 재대국할 수 있습니다.";
      return;
    }
    if (moves.length === SIZE * SIZE) {
      finished = true;
      render();
      statusTitle.textContent = "무승부";
      statusDetail.textContent = "무승부. 새 게임으로 재대국할 수 있습니다.";
      return;
    }
    turn = turn === BLACK ? WHITE : BLACK;
    if (mode === "ai" && turn === aiColor) {
      scheduleAiMove();
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
      board[move.y][move.x] = aiColor;
      moves.push({ ...move, color: aiColor });
      if (hasWon(move.x, move.y, aiColor)) {
        finished = true;
        render();
        statusTitle.textContent = `${aiColor === BLACK ? "흑" : "백"} 승리`;
        statusDetail.textContent = "AI 대전 패배.";
        hint.textContent = "새 게임으로 재대국할 수 있습니다.";
        return;
      }
      turn = humanColor;
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
    const ranked = [];
    for (const index of candidates) {
      const x = index % SIZE;
      const y = Math.floor(index / SIZE);
      const attack = scorePoint(x, y, aiColor);
      const defend = scorePoint(x, y, humanColor);
      const centerBonus = 7 - (Math.abs(7 - x) + Math.abs(7 - y)) * 0.15;
      ranked.push({ x, y, attack, defend, centerBonus });
    }

    if (difficulty === "advanced" || difficulty === "expert") {
      const winningMove = ranked.find(move => move.attack >= 1000000);
      if (winningMove) return { x: winningMove.x, y: winningMove.y };
      const blockingMove = ranked.find(move => move.defend >= 1000000);
      if (blockingMove) return { x: blockingMove.x, y: blockingMove.y };
    }

    let best = null;
    let bestScore = -Infinity;
    for (const move of ranked) {
      let score;
      if (difficulty === "beginner") {
        score = move.attack * 0.72 + move.defend * 0.62 + move.centerBonus + Math.random() * 90;
      } else if (difficulty === "advanced") {
        score = move.attack * 1.12 + move.defend * 1.04 + move.centerBonus + Math.random() * 0.35;
      } else if (difficulty === "expert") {
        score = move.attack * 1.18 + move.defend * 1.16 + move.centerBonus + Math.random() * 0.05;
      } else {
        score = Math.max(move.attack * 1.08, move.defend) + move.attack * 0.18 + move.centerBonus + Math.random() * 0.2;
      }
      if (score > bestScore) {
        bestScore = score;
        best = { x: move.x, y: move.y };
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
      if (!moves.some(move => move.color === humanColor)) return;
      if (humanColor === BLACK) {
        const aiMove = moves.pop();
        board[aiMove.y][aiMove.x] = EMPTY;
        const playerMove = moves.pop();
        board[playerMove.y][playerMove.x] = EMPTY;
        turn = BLACK;
      } else {
        const playerMove = moves.pop();
        board[playerMove.y][playerMove.x] = EMPTY;
        turn = WHITE;
      }
    } else {
      const last = moves.pop();
      board[last.y][last.x] = EMPTY;
      turn = last.color;
    }
    finished = false;
    thinking = false;
    hint.textContent = "착수 취소.";
    if (mode === "ai" && aiColor === BLACK) {
      scheduleAiMove();
    } else {
      render();
    }
  }

  document.querySelectorAll("[data-mode]").forEach(button => {
    button.addEventListener("click", () => {
      if (button.dataset.mode === "ai") colorDialog.showModal();
      else startGame("local");
    });
  });
  startAiButton.addEventListener("click", () => {
    const selected = document.querySelector('input[name="player-color"]:checked');
    colorDialog.close();
    startGame("ai", selected ? Number(selected.value) : BLACK);
  });
  cancelSetupButton.addEventListener("click", () => colorDialog.close());
  document.querySelector("#back-button").addEventListener("click", showHome);
  document.querySelector("#restart-button").addEventListener("click", resetGame);
  document.querySelector("#new-button").addEventListener("click", resetGame);
  undoButton.addEventListener("click", undoMove);
  difficultySelect.addEventListener("change", () => {
    if (mode !== "ai") return;
    const selectedLabel = difficultySelect.selectedOptions[0].textContent;
    resetGame();
    hint.textContent = `${selectedLabel} 난이도 적용.`;
  });
})();