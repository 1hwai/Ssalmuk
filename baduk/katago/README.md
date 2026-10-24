# KataGo character evaluator

Ssalmuk uses the browser build of [saigo-online/katago-webgpu](https://github.com/saigo-online/katago-webgpu) for character-facing position evaluation. This is separate from the existing move-selection engine in `engine.js`.

## Runtime files required

Place these generated files in this directory:

- `kataeval.js`
- `kataeval.wasm`
- `model.bin.gz`

The model must be supported by the upstream `kataeval` build. The adapter loads a separate KataGo instance for each board size (9, 13, 19) and evaluates the current board with the selected rules' komi. KataGo's expected score is converted to the app's Black-minus-White convention and used to update the character reaction.

## Build the runtime

Use the upstream repository and its documented Emscripten setup:

1. Clone https://github.com/saigo-online/katago-webgpu.
2. Install/activate Emscripten (emcc 6+) and follow the upstream `Compiling.md`.
3. Run `scripts/build-eval.sh` from the upstream repository.
4. Copy `web/demo/kataeval.js` and `web/demo/kataeval.wasm` here as `kataeval.js` and `kataeval.wasm`.
5. Copy a compatible KataGo network file here as `model.bin.gz`.

For a model file, use one of the compatible network files described by the upstream project; do not rename an unrelated neural-network format to `model.bin.gz`.

## Fallback and verification

The runtime files are built and committed by `.github/workflows/build-katago.yml`. The workflow checks both the compiled WASM with the real b18 model and the sequence-aware `kgeEvalSeq` API with a one-move test position.

After each legal move in AI mode, the adapter replays the complete move history (including passes) through KataGo so captures and recent-move input features are preserved. The adapter reads the win/loss/no-result logits, converts them to normalized Black/White win probabilities, and uses KataGo's `whiteLead` output for the expected lead. The existing TF.js engine still chooses moves; this evaluator only drives the character's emotion and dialogue.

Below the character dialogue, the game displays KataGo's Black/White win rates, expected Black lead in points, the selected position band (unfavorable / normal / favorable), and model version. While evaluation is running it shows an analysis-in-progress status; on failure it shows the error instead of silently presenting a local heuristic as KataGo output. The game hint repeats the current KataGo estimate for quick checking.
