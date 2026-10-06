# LeLab-Bellab — Requirements & Decisions

Running log of product/behavior decisions for this fork, one `D<n>` item per
entry. This file didn't exist in the repo yet as of D14 — if you already
track D1–D13 elsewhere (e.g. outside the repo), reconcile the numbering and
merge that history in here.

## D14 — Training screen defaults to fine-tuning

Training screen defaults to fine-tuning from `lerobot/smolvla_base`;
from-scratch is opt-in.

**Why:** Training with the Policy dropdown alone (`--policy.type=...`, no
`--policy.pretrained_path=...`) builds the policy entirely from scratch — for
SmolVLA this means the 350M-parameter vision-language backbone is randomly
initialized *and* frozen, so the model never actually reads the language
instruction or gets useful visual features. This happened silently: nothing
in the GUI indicated the run wasn't fine-tuning from pretrained weights.

**Decision:** A "Pretrained policy path (fine-tune from)" field on the
training screen defaults to `lerobot/smolvla_base`, sent as
`--policy.pretrained_path` alongside (not instead of) `--policy.type` — it's
a plain field on lerobot's `PreTrainedConfig`, not a separate loading mode.
Leaving it empty (opt-in) falls back to today's from-scratch behavior. The
training log panel surfaces which mode a run started in as its first line,
so a from-scratch run can't go unnoticed again.
