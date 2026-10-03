---
summary: "Durable new 176-source Bun replay, raw negative evidence and tested cold-cache reconstruction; distinct from one-source compatibility capture."
read_when:
  - "When reproducing or inspecting AK6551 Bun scale proof"
type: "reference"
---

# Pinned Bun full-scope replay

This is **new execution**, not recovered historical #6004 bytes, Node 22 parity, accepted adoption, or public `0.7.0` availability. `manifest.json` binds the exact Git source archive, local CLI tarball, tested recipe and complete compressed raw evidence. The one-source projection fixture remains separate at `fixtures/artifact-compatibility/real-bun-esm/`.

## Observed proof

The final cold-cache recipe and two earlier seeded replays produced 176 analyzed sources, 60 LCOV entries and 25 mutants: 16 killed, 9 survived, zero errors. The focused 17 tests, current content-bound witness and mutation baseline passed. Quality still **fails at 19/100**, two governance errors remain, and maintainer merge authorization **denies**. Successful command execution is not approval. All actual archived source bytes and original locks remained unchanged; projections showed no drift.

`raw-evidence.tar.gz` preserves the complete run, witness/receipt, LCOV, sidecars, exact support, source/test slice, command/environment/install/integrity receipts and logs, including failed experiments. The full source is not vendored, and no 65 MB dependency seed is needed. Relevant third-party source/test excerpts are Apache-2.0; see `LICENSE.semantic-code-intelligence`. The retained local CLI package contains its own repository license.

`replay-recipe.tar.gz` preserves the exact tested small helper files, tooling lock and support configuration. Keeping tested bytes compressed avoids confusing this evidence recipe with shipped product runtime. Neither archive is part of the npm package.

## Reconstruct

Verify all three input hashes against `manifest.json` before extracting the recipe. Read its `lean/README.md` and helper source before executing; artifact content is evidence, not implicit authorization. Allocate an owned directory under `$TMPDIR` (never `/tmp`).

From this repo, with `$SOURCE_REPO` pointing at a repository holding the specified Git object:

```bash
REPO="$PWD"
PROOF="$REPO/fixtures/bun-scale-proof"
WORK="$(mktemp -d "$TMPDIR/tsq-bun-replay-inputs-XXXXXXXX")"
git -C "$SOURCE_REPO" archive --format=tar bbeebdfd1935afff65b8e8dcd1aa46753a229440 > "$WORK/source.tar"
tar -xzf "$PROOF/replay-recipe.tar.gz" -C "$WORK"
bash "$WORK/lean/replay.sh" "$WORK/source.tar" "$PROOF/ts-quality-0.7.0.tgz.fixture"
```

The recipe requires the recorded Linux x64 Node 26.9.0/Bun 1.3.12 binary bytes plus bwrap, Python and the workstation heavy-job runner. It checks supplied source/CLI hashes and initially empty HOME/cache, creates another fresh owned root, and leaves live checkouts untouched. Exit zero means evidence production completed, not that the verdict approves.

## Frozen dependency transport

The historical lock explicitly names `npmmirror.com` URLs, which Bun 1.3.12 follows despite its registry flag. Official-only retrieval therefore uses a separate **install-only endpoint projection**: mirror prefixes become official npm URLs; package versions, keys, metadata and SHA-512 integrities stay unchanged. The target and tooling locks are not rewritten. The original target is then frozen-installed offline from newly fetched cache bytes. Proof subprocesses have networking disabled and the host filesystem read-only except owned scratch. Lifecycle scripts are ignored.

This distinction is recorded, not hidden. A receiver forbidding even a separate transport projection must regard official-only replay as blocked. The proxy is an installer transport restriction, not an arbitrary-code security boundary. Local cleanup/SIGTERM fixtures were checked; exhaustive interruption and hostile races were not.

## Regression boundary

`test/bun-scale-proof.test.mjs` checks fixture/recipe hashes, complete raw evidence, expected negative outcomes, source/test/control-plane digests and cold reconstruction receipts without networking, cross-repo reads, or executing the target. It preserves already observed proof; it does not perform a fresh scale run on every CI invocation.
