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
  const KOMI = { korean: 6.5, japanese: 6.5, chinese: 7.5 };
  const CHARACTERS = {
    black1: {
      id: "black1", name: "우현", color: BLACK, gender: "남성", emotion: "냉철",
      dialogues: {
        start: [
          "왔나. 말은 됐고, 한 판 두지.",
          "기대는 안 한다. 보여 줘 봐.",
          "서두를 것 없어. 끝까지 가면 알겠지."
        ],
        normal: [
          "그 수를 고른 이유가 있겠지.",
          "흐름이 조금씩 보이는군.",
          "한 수로 끝날 판은 아니야.",
          "계속해. 아직 판단하긴 이르다.",
          "흠. 생각보다 조용하게 두는군."
        ],
        favorable: [
          "이제야 판이 제 모양을 찾는군.",
          "무리하지 마라. 이 정도면 충분해.",
          "도망갈 곳이 줄어들고 있어.",
          "여기서 흔들리면 그대로 끝이다."
        ],
        unfavorable: [
          "…계산이 어긋났군.",
          "좋아. 그럼 처음부터 다시 읽지.",
          "아직 끝난 건 아니다. 착각하지 마.",
          "불리하다고 물러설 생각은 없어."
        ],
        opponentGoodMove: [
          "제법이군. 그 수는 놓치기 쉽지.",
          "그건 인정하지. 좋은 수다.",
          "방금 수는 기억해 두지."
        ],
        opponentMistake: [
          "그 자리는 비워 두는 편이 나았을 텐데.",
          "놓쳤군. 다음엔 같은 실수 하지 마.",
          "기회는 오래 기다려 주지 않아."
        ],
        result: [
          "끝났군. 결과는 결과다.",
          "이번 판은 네가 가져갔어. 다음은 다르겠지.",
          "내가 졌다고 해서 네 계산이 전부 옳았던 건 아니야."
        ]
      }
    },
    black2: {
      id: "black2", name: "이현", color: BLACK, gender: "여성", emotion: "냉철",
      dialogues: {
        start: [
          "규칙은 간단해요. 수에는 책임이 따르죠.",
          "준비됐어요? 그럼 시작하죠.",
          "기세보다 판단을 믿는 편이 좋을 거예요."
        ],
        normal: [
          "그 수, 끝까지 책임질 수 있겠어요?",
          "지금은 모양을 정리하는 게 먼저예요.",
          "괜찮은 선택이네요. 다만 아직은요.",
          "한 번 더 생각했어도 좋았겠어요.",
          "판이 복잡해질수록 원칙을 지켜야 해요."
        ],
        favorable: [
          "좋아요. 이제 주도권을 놓치지 말아요.",
          "급하게 끝낼 필요는 없겠네요.",
          "빈틈이 보이기 시작했어요.",
          "여기서 흔들리지 않으면 충분해요."
        ],
        unfavorable: [
          "인정할 건 인정하죠. 지금은 불리해요.",
          "실수 하나로 무너지진 않아요. 수습하죠.",
          "상황이 나빠졌네요. 그래도 방법은 있어요.",
          "감정적으로 둘 때가 아니에요."
        ],
        opponentGoodMove: [
          "좋은 수예요. 의도도 분명하고요.",
          "그 수는 예상보다 정확했네요.",
          "그 판단은 높이 살 만해요."
        ],
        opponentMistake: [
          "그곳은 지킬 필요가 없었어요.",
          "방금 수는 조금 성급했네요.",
          "실수는 누구나 해요. 다만 대가는 치러야죠."
        ],
        result: [
          "승패는 받아들이죠. 복기는 꼭 하세요.",
          "이번엔 제가 졌네요. 이유는 찾아보겠어요.",
          "이겼다고 방심하지 말아요. 다음 판은 달라질 수 있어요."
        ]
      }
    },
    white1: {
      id: "white1", name: "백강", color: WHITE, gender: "남성", emotion: "냉철",
      dialogues: {
        start: [
          "아, 벌써 시작이야? 커피 한 잔만 마시고 하면 안 되나.",
          "좋아, 좋아. 오늘은 어디까지 버티나 볼까?",
          "너무 긴장하지 마. 바둑판이 널 잡아먹진 않거든."
        ],
        normal: [
          "오, 그런 식으로 나온다 이거지?",
          "잠깐만. 지금 내가 뭘 하려던 거였더라… 아, 맞다.",
          "흐음. 꽤 귀찮은 곳을 찔렀네.",
          "그 수 괜찮은데? 칭찬은 여기까지.",
          "이럴 때일수록 대충 두면 안 되겠지. 아마도."
        ],
        favorable: [
          "어라, 나 오늘 좀 잘하는데?",
          "이 정도면 슬슬 간식 먹을 여유가 생기겠는데.",
          "좋아, 좋아. 이제부터가 진짜 귀찮은 부분이야.",
          "이겼다고 좋아하긴 일러. 아직 판은 안 끝났거든."
        ],
        unfavorable: [
          "아이고, 이건 좀 아픈데. 잠이 확 깨네.",
          "잠깐 장난칠 때가 아니란 거지? 알았어.",
          "좋아. 이제부터는 진지하게 간다.",
          "하하… 웃을 상황은 아닌가 보네."
        ],
        opponentGoodMove: [
          "오, 방금 건 진짜 좋았다. 인정!",
          "야, 그 수는 좀 멋있었는데?",
          "아하. 그래서 아까부터 그걸 노렸구나."
        ],
        opponentMistake: [
          "어라? 거기 비워도 괜찮겠어?",
          "고맙긴 한데, 너무 대놓고 주면 내가 민망하잖아.",
          "방금 수는 나중에 복기할 때 이불 걷어찰지도."
        ],
        result: [
          "끝! 이제 밥 먹으러 가도 되는 거지?",
          "졌네. 음, 복기는 내일의 나한테 맡기자.",
          "이겼다! …근데 왜 이렇게 피곤하지?"
        ]
      }
    },
    white2: {
      id: "white2", name: "백서아", color: WHITE, gender: "여성", emotion: "냉철",
      dialogues: {
        start: [
          "어서 와요. 오늘은 어떤 이야기를 들려줄 건가요?",
          "서두르지 말아요. 좋은 수는 기다려 주기도 하니까요.",
          "후후, 조금 기대되네요. 시작해 볼까요?"
        ],
        normal: [
          "그곳을 선택했군요. 재미있어요.",
          "꼭 말로 설명하지 않아도, 수에 마음이 드러나곤 하죠.",
          "음, 그렇게 이어지는군요. 계속 봐요.",
          "정답은 하나가 아닐지도 몰라요. 물론 틀린 수는 있지만요.",
          "지금은 조용하네요. 폭풍 전의 고요함일까요?"
        ],
        favorable: [
          "조금씩 제 쪽으로 기울고 있네요. 느껴지나요?",
          "이대로라면 꽤 아름다운 마무리가 되겠어요.",
          "서두르지 않을게요. 좋은 흐름은 천천히 즐겨야죠.",
          "후후, 이제야 제 의도를 알아봐 주는 것 같네요."
        ],
        unfavorable: [
          "어머, 생각보다 날카롭네요.",
          "이런 흐름도 나쁘지 않아요. 배울 게 많으니까요.",
          "조금 어려워졌네요. 그래도 재미는 더해졌어요.",
          "괜찮아요. 당황한 표정은 판 위에 남지 않으니까."
        ],
        opponentGoodMove: [
          "정말 좋은 수네요. 잠깐 설렜어요.",
          "그렇게 들어올 줄은 몰랐어요. 기분 좋은 놀라움이네요.",
          "잘했어요. 빈말이 아니라 진심으로요."
        ],
        opponentMistake: [
          "그곳은 조금 외로워 보이네요. 지켜 주지 않아도 될까요?",
          "아, 그 수는 아깝네요. 다른 선택도 있었을 텐데.",
          "실수도 한 판의 일부예요. 너무 마음에 담아 두진 말아요."
        ],
        result: [
          "즐거웠어요. 승패와 별개로 좋은 시간이었네요.",
          "제가 졌군요. 오늘은 당신에게 배운 걸로 할게요.",
          "이겼네요. 하지만 다음엔 어떤 이야기가 펼쳐질지 모르죠."
        ]
      }
    }
  };
  const STAR_POINTS = {
    9: [2, 4, 6],
    13: [3, 6, 9],
    19: [3, 9, 15]
  };

  let state = null;
  let aiTimer = null;

  function freshState(size, mode, humanColor, difficulty, rules, characterId) {
    const board = Array(size * size).fill(EMPTY);
    return {
      size, mode, humanColor, difficulty, rules, characterId, board, turn: BLACK,
      captures: { black: 0, white: 0 }, consecutivePasses: 0, moveCount: 0, lastMove: -1,
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
      difficulty: state.difficulty, rules: state.rules, characterId: state.characterId,
      dialogueLine: state.dialogueLine,
      board: state.board.slice(), turn: state.turn,
      captures: { ...state.captures }, consecutivePasses: state.consecutivePasses, moveCount: state.moveCount,
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
        if (engine && typeof engine.kataChooseMove === "function" && typeof engine.kataReset === "function" && typeof engine.kataLoad === "function") {
          engine.kataLoad().then(() => resolve(engine)).catch(error => {
            engineLoadPromise = null;
            reject(error);
          });
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
    state.captures[color === BLACK ? "black" : "white"] += move.captured.length;
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
    const rules = $("scoring-rules").value;
    const characterId = mode === "ai" ? $("ai-character").value : null;
    state = freshState(size, mode, humanColor, difficulty, rules, characterId);
    if (mode === "ai" && CHARACTERS[characterId]) {
      state.dialogueLine = pickDialogue(CHARACTERS[characterId], "start");
    }
    setupScreen.hidden = true;
    gameScreen.hidden = false;
    resultPanel.hidden = true;
    $("game-title").textContent = size + " × " + size + " 바둑";
    $("opponent-profile").hidden = mode !== "ai";
    renderOpponentProfile();
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
        gameHint.textContent = location.protocol === "file:" ? "AI 대국은 file://에서 실행할 수 없습니다. 터미널에서 python3 -m http.server 8000을 실행한 뒤 http://localhost:8000/baduk/으로 접속하십시오." : "AI 모델을 불러오지 못했습니다. 네트워크 연결을 확인한 뒤 새 대국을 시작하십시오.";
      });
    } else {
      render();
    }
  }

  function pickDialogue(character, category) {
    const lines = character.dialogues[category] || [];
    if (!lines.length) return "";
    return lines[Math.floor(Math.random() * lines.length)];
  }

  function renderOpponentProfile() {
    const profile = $("opponent-profile");
    if (!state || state.mode !== "ai" || !state.characterId) {
      profile.hidden = true;
      return;
    }
    const character = CHARACTERS[state.characterId];
    if (!character) {
      profile.hidden = true;
      return;
    }
    profile.hidden = false;
    $("opponent-name").textContent = character.name;
    $("opponent-description").textContent = (character.color === BLACK ? "흑돌" : "백돌") + " · " + character.gender;
    $("opponent-emotion").textContent = character.emotion;
    $("opponent-line").textContent = state.dialogueLine || pickDialogue(character, "start");
  }

  function updateCharacterOptions() {
    const select = $("ai-character");
    if (!select) return;
    const mode = document.querySelector('input[name="mode"]:checked').value;
    const humanColor = Number(document.querySelector('input[name="player-color"]:checked').value);
    const aiColor = -humanColor;
    const available = Object.values(CHARACTERS).filter(character => character.color === aiColor);
    const previous = select.value;
    select.replaceChildren();
    for (const character of available) {
      const option = document.createElement("option");
      option.value = character.id;
      option.textContent = character.name;
      select.append(option);
    }
    if (available.some(character => character.id === previous)) select.value = previous;
    else if (available.length) select.value = available[0].id;
    $("ai-character-field").hidden = mode !== "ai";
  }

  function render() {
    if (!state) return;
    boardElement.setAttribute("aria-label", state.size + " 곱하기 " + state.size + " 바둑판");
    renderOpponentProfile();
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
    const rules = state.rules || "korean";
    const komi = KOMI[rules];
    const areaScoring = rules === "chinese";
    let black = 0, white = komi;
    if (areaScoring) {
      for (const stone of board) {
        if (stone === BLACK) black++;
        else if (stone === WHITE) white++;
      }
    } else {
      black += state.captures.black;
      white += state.captures.white;
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
    return { black, white, komi, rules, areaScoring };
  }

  function showScore() {
    const score = scoreBoard();
    const winner = score.black > score.white ? "흑 승리" : score.white > score.black ? "백 승리" : "무승부";
    const ruleNames = { korean: "한국식", japanese: "일본식", chinese: "중국식" };
    resultPanel.replaceChildren();
    const title = document.createElement("strong");
    title.textContent = ruleNames[score.rules] + " · " + winner + " · 흑 " + score.black + "집 / 백 " + score.white + "집";
    const detail = document.createElement("p");
    const scoringName = score.areaScoring ? "집과 살아 있는 돌을 합산하는 방식" : "집과 포획한 돌을 합산하는 방식";
    detail.textContent = scoringName + ". 백 덤 " + score.komi + "집 포함. 간이 계가이므로 사활·사석 및 빅(세키)은 자동 판정하지 않습니다.";
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
      updateCharacterOptions();
    });
  });
  document.querySelectorAll('input[name="player-color"]').forEach(input => {
    input.addEventListener("change", updateCharacterOptions);
  });
  updateCharacterOptions();
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