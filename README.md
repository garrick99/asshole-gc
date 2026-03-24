# asshole-gc

> Garbage collect toxic people from your life. Finally, a gc that works on humans.

[![License: MIT](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](CHANGELOG.md)
[![False Positive Rate](https://img.shields.io/badge/false%20positive%20rate-%3C2%25-green.svg)](#false-positives)

---

## The Problem

You already know who the problem is.
You've known for months.
You just needed a tool to confirm it.

## Usage

```bash
# Scan your environment — no changes made
asshole-gc --dry-run

# Review results, then execute with a warning period
asshole-gc --run --grace-period

# Schedule weekly maintenance
asshole-gc --schedule "0 9 * * 0"
```

## How It Works

1. **Detection** — Passive behavioral signal collection across 14 weighted dimensions.
2. **Threshold** — 3 consecutive bad days triggers a candidate entry. Default, configurable.
3. **Dry Run** — Always review before you commit. False positives exist.
4. **Collection** — Graceful (with `--grace-period`) or immediate. Your call.

## Install

```bash
brew install asshole-gc
# or
cargo install asshole-gc
# or
npm install -g asshole-gc
# or
curl -fsSL # coming soon | sh
```

## CLI Reference

| Flag | Default | Description |
|------|---------|-------------|
| `--dry-run` | — | Scan and report, no action taken |
| `--run` | — | Execute collection |
| `--threshold N` | `3` | Consecutive bad days to flag |
| `--grace-period` | — | Send warning before collection |
| `--grace-days N` | `7` | Grace period length |
| `--target NAME` | — | Target a specific subject |
| `--schedule CRON` | — | Install recurring cron job |
| `--format` | `human` | Output format: `human`, `json`, `csv` |

## The 14 Dimensions

The Behavioral Signal Aggregator (BSA) scores subjects across:

| # | Dimension | Weight |
|---|-----------|--------|
| 1 | Condescension | 0.90 |
| 2 | Bad faith | 0.90 |
| 3 | Weaponized incompetence | 0.85 |
| 4 | Credit theft | 0.85 |
| 5 | Chronic negativity | 0.70 |
| 6 | Selective empathy | 0.75 |
| 7 | Commitment failure | 0.65 |
| 8 | Boundary violation | 0.88 |
| 9 | DARVO pattern | 0.92 |
| 10 | Energy drain coefficient | 0.60 |
| 11 | Escalation tendency | 0.72 |
| 12 | Rules asymmetry | 0.68 |
| 13 | Apology quality | 0.65 |
| 14 | Pattern persistence | 0.95 |

See [algorithm.html](algorithm.html) for the full spec.

## Configuration

```toml
# ~/.config/asshole-gc/config.toml

[defaults]
threshold       = 3      # consecutive bad days
day_threshold   = 0.55   # BSA score for a "bad day"
reset_threshold = 0.30   # score required to reset counter
grace_days      = 7

[contexts]
deadline_factor = 0.70   # reduced weight during deadlines
personal_factor = 0.40   # reduced weight during personal crises
```

## Philosophy

> "Not every bug is worth fixing. Some you just remove from the codebase."

- One bad day is noise.
- Two is a pattern forming.
- Three is a lifestyle choice.

The consecutive-days counter resets only on genuinely good behavior (score < 0.30, not just below-threshold). Gaming the system requires actually being decent — which removes you from the candidate pool by definition.

## False Positives

The FP rate with `--dry-run` review is <2%. Without review, ~8%.
**Always use `--dry-run`.**

Common false positive causes:
- Undetected personal crisis (configure context windows)
- You might be the problem (the mirroring check helps)
- Deadline artifacts (set deadline context)
- Single-source signals (get a second opinion)

## Contributing

PRs welcome. Issues welcome.
We review contributor behavior before merging.
Repeat offenders are subject to `asshole-gc --run`.

## License

MIT. Use responsibly. Not responsible for relationship fallout.
