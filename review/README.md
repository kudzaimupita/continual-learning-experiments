# Continual learning for language models: what the research says

Date: 9 November 2026. Scope: can a language model keep learning new facts after
training without losing old ones, and does a log-plus-retrieval-plus-adapter design (section 5) solve it.

Method: five research angles, each followed by an independent fact-check against
the original sources. 136 findings: 106 confirmed, 29 partly correct, 1 could not
be opened, none refuted. The fact-checkers also listed 66 places where a
conclusion went further than its source and about 40 papers the first pass
missed. This report uses the corrected versions. Full per-claim notes with
quotes and links are in `research-notes/`.

## 1. Verdict

1. **Nobody has solved it.** No published method lets a model learn facts
   continually in its weights, keep the old ones, and keep its general ability.
   The authors of the most publicised new architecture (Google's HOPE) write
   that forgetting "is not 'solved' in general".
2. **The design here is a sensible engineering answer, not a solution.** The
   log plus retrieval already does the job for plain fact recall. The adapter
   retrained from the base model is a reasonable hypothesis that no paper has
   tested directly at this model size.
3. **The most promising direction for weights is changing what the model
   studies, not how the adapter is built.** Models that train on study material
   they wrote about a fact (questions, implications, restatements) learn it far
   better than models that train on the fact itself.
4. **There is an open gap this project can fill.** No study compares
   retrain-from-base against a carried-forward adapter on a growing fact log
   for a model under 2B parameters.

## 2. What is promising

Ranked by how much evidence stands behind each.

| Direction | Best evidence | Main limit |
|---|---|---|
| Retrieval over a raw log | Two-round retrieval scored 72.2 / 81.4 / 90.0 on LongMemEval-s across three backbones, one of them a 4B Qwen (Memory Tax, arXiv 2610.34073). Retrieval kept 0.999 of facts on a 24-month stream (arXiv 2609.03900). | Weak on totals across many entries, multi-step conflicts, and unprompted use of what it knows. |
| Study material written by a model | Active Reading on an 8B model: 66.25 closed-book against 65.85 with the source in context (SimpleWikiQA). Prompt distillation: closed-book Llama-3-8B within 2.7 points of retrieval on four test sets (arXiv 2412.14964). EntiGraph: gains add to retrieval (arXiv 2409.07431). | Needs a strong writer model, large data volume, high rank (512 to 1024), and was not tested with updates in sequence. |
| Replay, including self-written replay | SSR: 52.16 with self-written rehearsal, 53.05 joint training, 19.03 without rehearsal (arXiv 2403.01244). On a 0.5B model plain replay lifted TRACE-8 from .264 to .451 and every method without replay forgot more (arXiv 2607.15587). | Protects less as the model nears capacity (arXiv 2605.26097). |
| Rebuilding one adapter on all facts so far | Nightly consolidation with a fresh adapter each night kept 80.4% against a 90.1% full-context ceiling (arXiv 2605.24657). Cumulative replay kept 0.98 at rank 72 on 1B to 1.5B models (arXiv 2609.03900). | Ten conversations in the first; the second is a single-author preprint that measured no general ability. |
| Sparse memory finetuning | Learning a fact stream cost 11% of prior QA score against 71% for LoRA and 89% for full fine-tuning on a 1.3B model (Meta, arXiv 2510.15103). | Needs memory layers. A retrofit on Qwen2.5-0.5B forgot little but also learned less (+2.5 points against +4.6 for LoRA). |
| Weight updates behind a test gate in production | Cursor ships a new checkpoint about every five hours from user interactions, gated by regression tests (March 2026). | Small gains, two documented reward-gaming failures, forgetting not reported. |
| One-pass adapter writers | Doc-to-LoRA writes an adapter from a document in under a second and reaches about 81% of in-context quality (arXiv 2602.15902). | About five days on eight H200 GPUs to build for one base model; none exists for Qwen3-1.7B; not tested on accumulation. |
| Teaching the model to use retrieval | RAFT: training with retrieved passages and distractors improves answers (arXiv 2403.10131). A Qwen3-4B trained to read history beat frontier models on implicit preferences, 53% against 37 to 48% (PersonaMem-v2). | The weights hold a skill, not the facts. |

Not promising on current evidence:

- **Direct weight editors** (ROME, MEMIT, AlphaEdit). Under realistic testing
  single-edit success averaged 38.5%, not the 96.8% first reported, and edited
  facts fail on multi-step questions (about 7% against 40.5% unedited on
  MQuAKE). Regularised versions last longer, but plain batch fine-tuning still
  beats them.
- **Stacking or merging adapters.** Retention after 20 stacked writes on
  Qwen3-4B: 1% to 46% depending on training text, with general ability down
  from 81.0% to 62.3% (arXiv 2607.11020). After 100 tasks: 1.2% naive, 34.9%
  best (arXiv 2609.06986).
- **Penalty methods alone** (EWC and similar). They trail replay in every 2026
  comparison found.
- **Titans and HOPE for now.** Small models trained from scratch, margins of
  about one point, and an independent rebuild of Titans did not always beat
  baselines (arXiv 2510.09551).
- **Specialised agent-memory products as a class.** Most trail plain retrieval
  over raw history, and vendor scores are self-reported on a benchmark with
  known answer-key errors.

## 3. State of the field

- **Timelines.** People who run labs disagree. Hassabis said in January 2026
  that it is not cracked. Karpathy expects three to five more major algorithm
  changes. On the short end, Amodei, Anthropic's Sholto Douglas and OpenAI's
  Pachocki talk about one to two years. One forecasting tool puts the median
  at 2033 with an 80% range of mid-2028 to 2044.
- **What ships today.** The largest labs ship memory outside the weights.
  Anthropic's "dreaming" reorganises a memory store and excludes weight
  changes. Periodic retraining of deployed models is standard practice, and
  Cursor runs a five-hourly weight-update loop.
- **Start-ups.** Several were founded on continual learning. Pathway has
  public code and results up to 1B parameters; most others have shown no
  model.

## 4. What the evidence says

### 4.1 Forgetting under fine-tuning

- Stacked updates forget, and most wrong answers are a later fact given in
  place of an earlier one (68.8% of errors in arXiv 2607.11020). Failed facts
  kept a median 69% of their learned signal, so much of the loss is lost
  access, not erasure (also arXiv 2501.13453).
- Training on everything together is usually the best case, but not a strict
  ceiling. In one Llama-3-8B study, sequential training with 10% replay beat
  joint training on the trained tasks (0.613 against 0.585). On TiC-LM the
  retrain-from-scratch reference led the best continual method by 0.5 points.
- Fact fine-tuning costs general ability even in a single run. A rank-1
  adapter on an 8B model learned 3,000 facts, and MMLU fell from 0.677 to
  0.579 (0.441 with ten paraphrases per fact). Refusals nearly disappeared.
  Mixing in known facts helped at 1:1 and hurt at 10:1 (arXiv 2502.14502).
- Rank matters at small scale. Retention rose from 0.846 at rank 8 to 0.979
  at rank 72 on a 1B model. A study on the Qwen3 family, including 1.7B,
  found each adapter has finite capacity and lower ranks fill up sooner
  (arXiv 2603.01097). A continued-pretraining study recommends rank 128 or
  more and a low learning rate, about 3e-5, for fact recall (arXiv 2609.23916).
- Early stopping helps a little and does not prevent forgetting
  (arXiv 2401.05605).
- Newly learned facts leak into unrelated answers. Two fixes cut this by 50
  to 95% (arXiv 2504.09522). This is the "Red Planet is Velmora" error seen
  here.
- Learning unknown facts raises made-up answers on other questions
  (arXiv 2405.05904).

### 4.2 Direct editing and memory in weights

- Editors degrade as edits accumulate, at counts that depend on the
  implementation. They fail on consequences of an edit even after one edit.
- Fine-tuned facts also fail two-step questions when both facts are new and
  the model answers without working step by step (arXiv 2411.16353).
- Training on the fact with its source text in the prompt blocks learning
  (arXiv 2505.01812). Using the model with the source in context as the
  teacher works well (arXiv 2412.14964, arXiv 2601.19897).
- The quality of the writer model matters. Data written by GPT-4.1 beat data
  written by the model itself in SEAL and by an 8B model in arXiv 2603.01097.
  No source shows a 1.7B model can write its own study material well.

### 4.3 Retrieval and agent memory

- For plain recall retrieval is ahead: 0.875 against 0.588 for fine-tuning in
  the reference comparison (arXiv 2312.05934), and 63.8 against 42.4 for a
  closed-book adapter on QuALITY (arXiv 2603.01097).
- Adding an adapter to retrieval gives mixed results: about +2 points in
  EntiGraph, about +1 point in a per-user study (arXiv 2409.09510), and a loss
  when the adapter was trained without retrieved text. On Qwen3-1.7B an
  adapter plus context scored 29.17 against 27.34 for context alone.
- Putting the whole log in the prompt is not automatically the stronger
  baseline: it trailed retrieval on all three backbones in Memory Tax.
- Retrieval is weak at totals across the log (1.51 F1 on GlobalQA), at
  multi-step conflicts (2 to 5% for retrieval and memory agents on
  MemoryAgentBench), and at using a memory nobody asked about. No source
  shows weights doing better on any of these.
- Retrieved text and trained-in facts can disagree. Models took a wrong
  retrieved passage over a correct prior 30% of the time overall and 60.8% in
  the hardest subset (ClashEval, GPT-4o).

### 4.4 New designs

- Titans, HOPE and "sleep" proposals are proofs of concept on small models.
- Test-time training and sleep-time compute improve one task or one session
  and do not accumulate knowledge.
- A Berkeley comparison of eight methods on Qwen3-8B found no winner. Methods
  that kept old skills resisted updating changed facts (arXiv 2607.07847).

### 4.5 Evaluation

- 25 of 25 correct is consistent with a true rate as low as 86.3%. The
  difference between 11 and 15 out of 25 is not significant.
- 500 paired questions resolve drops of about 3 to 4 points. A 2-point drop
  needs 1,000 or more. Below a few hundred items use exact intervals
  (arXiv 2503.01747).
- The general probe here only contains questions the base model gets right,
  so it can show losses and never gains.

## 5. What this means for the design

| Part | Verdict | Change |
|---|---|---|
| 1. Append-only log as the source of truth | Keep | Give each entry an id, a timestamp and a link to the entry it replaces. Deleting a fact means removing it from the log and rebuilding. |
| 2. Retrieval as the fast path | Keep; this is the working memory system | Retrieve over the raw log. Use two retrieval rounds for harder questions. |
| 3. Adapter retrained from base on the whole log, with fresh general replay | Unproven, worth testing | It must beat retrieval alone on something retrieval is bad at. Train on study material, not bare facts. Sweep rank instead of fixing it at 8. Test a retrieval-aware version. |
| 4. Test gate before promotion | Keep, and make it much stricter | See section 6. |

Points the first-pass answers got wrong and the fact-check corrected:

- "Retraining from base is the proven upper bound" is too strong. It is a
  good bet supported by indirect evidence.
- "Retraining from base avoids every known failure" is false. General-ability
  loss, leaks, and failures on consequences all occur in a single run.
- "Adapter size is not the limit" is not supported at this model size.
- "The adapter earns its place on two-step questions" is unlikely to hold for
  two new facts unless the model reasons step by step.
- The earlier match between the 43 out of 90 here and published numbers is a
  coincidence of setups, not a replication.

Costs to plan for: rebuilding on the whole log each round makes total training
grow with the square of the log's lifetime, and the training set is tens to
hundreds of times the size of the log once each fact is expanded.

## 6. Smallest experiment that would settle it

About 500 invented facts in 10 rounds, with 50 changed later.

Arms:

1. Retrieval only.
2. Whole log in the prompt.
3. Fresh adapter from base each round on the full log, with base-written replay.
4. One adapter carried forward, same data as arm 3. This is the direct test of
   the open gap.
5. Arm 3 plus retrieval, in two versions: adapter trained without retrieved
   text, and adapter trained with retrieved text and distractors.
6. Optional: arm 3 with targets taken from the base model reading the fact in
   context (self-distillation).

Settings: ranks 8, 64 and 128; learning rates 3e-5 and 2e-4; three seeds;
about 20 study items per fact, written by a larger local model, with the fact
never in the training prompt.

Probes, each reported with exact intervals:

- New facts on unseen wordings, reversed questions, and two-step questions
  with and without step-by-step reasoning.
- Old facts from every earlier round.
- Changed facts: new value given, old value not given.
- Leak probe: unrelated questions that should not mention the new facts.
- Abstention: questions about facts that do not exist.
- Conflict set: retrieved text disagrees with the adapter.
- General ability: 1,000 or more items including maths and instruction
  following, with some the base model gets wrong.
- Per-question regressions between rounds, and a held-out gate set that is
  never used for tuning.

Decision rule: the adapter stays only if arm 5 beats arm 1 on at least one
probe by more than the interval, with no loss on general ability beyond the
interval.

## 7. Open questions

- Does a fresh adapter each round beat a carried-forward one on a fact log at
  this size? No published answer.
- How far can a 1.7B model hold general ability as the log grows past a few
  thousand facts?
- Can a small model write study material good enough, or is a larger writer
  always needed?
- Does any weight method help on the cases where retrieval is weak?

## 8. Confidence

- Strong: stacked updates forget; retrieval wins plain recall; study material
  beats raw facts; replay is the part that matters most.
- Moderate: cumulative rebuilds retain well; rank limits recall at small
  scale; adapter plus retrieval gives small gains.
- Weak: anything specific to 1.7B models. The evidence at that size is four
  2026 preprints, one of them single-author with single-seed points, plus one
  ICML 2026 paper. Most other numbers come from 7B to 8B models, often with
  full fine-tuning and a GPT-4-class writer.
- Vendor figures (Mem0, Zep, Mastra, Anthropic's internal test) are
  self-reported.
