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

Until all three runtime files are deployed, the game continues to use its local lightweight position estimate and logs the KataGo load error in the browser console. Once deployed, after a move the character's displayed estimate is updated from KataGo's expected score. Check the browser console and the hint text beginning `KataGo 형세 분석` to verify that the runtime is actually active.
