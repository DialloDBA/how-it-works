---
title: "Metacognition in Multi-Agent Systems: How an AI Agent Knows When to Ask for Help"
slug: "ai-agent-competence-threshold-metacognition"
type: concepts
lang: en
translation: /docs/fr/artificial-intelligence/metacognition-agents-ia-seuil-competence.md
author: Abdourahamane Diallo
date: 2026-03-17
tags: [artificial-intelligence, multi-agent, metacognition, llm, orchestration]
status: published
---

# Metacognition in Multi-Agent Systems: How an AI Agent Knows When to Ask for Help

> In one sentence: LLMs always respond with the same confidence whether they are right or wrong — metacognition is the layer that allows them to estimate their own competence and decide intelligently when to collaborate.

🌐 [Lire en français](/docs/fr/artificial-intelligence/metacognition-agents-ia-seuil-competence.md)

---

## Why this matters

While building Dymmo — an AI-driven payment infrastructure — I observed a concrete problem: multiple LLMs working in parallel on the same project would reprocess the same information from scratch every session, with no shared memory. Worse, when an agent didn't know something, it would invent an answer with the same confidence as when it did.

This problem has a name in AI research: **the absence of metacognition**. It is what I set out to address with Limen, an experimental adaptive reasoning framework.

---

## What you need to know first

- Know what a LLM is (GPT, Claude, Gemini...)
- Have a general idea of what a multi-agent system does
- No math required

---

## The fundamental problem: LLMs don't know what they don't know

A competent human recognizes their limits. Faced with a question outside their domain, they say "I don't know" or "ask someone more qualified." This capacity has a name: **metacognition** — the ability to reason about one's own reasoning.

Current LLMs don't have this. They predict the most probable next token — with no internal mechanism to evaluate the reliability of what they generate. The result:

```
Out-of-domain question
    ↓
LLM generates a confident response
    ↓
Plausible but incorrect answer
    ↓
No warning signal
```

This is what we call a **hallucination** — not a bug, but a direct consequence of the architecture.

---

## What current multi-agent systems do

The dominant solution today: have multiple agents debate each other. If one agent is wrong, the others will correct it.

```
AutoGen / CrewAI:

Question → Agent A → Agent B → Agent C → Response
               ↑_______________|
               (systematic debate)
```

This works — but the debate is **systematic**. Even simple questions go through the same heavy pipeline. Unnecessary token cost, latency, and noise on questions where a single agent would have been sufficient.

---

## The Limen approach: collaborate only at the threshold

The core idea is different: trigger collaboration only when it becomes necessary — at the agent's **competence threshold**.

```
Question
    ↓
Competence estimation (Limen Score)
    ↓
┌─────────────────────────────────────┐
│  Low score    → Answer alone        │  ← simple question
│  Medium score → Consult peers       │  ← uncertainty detected
│  High score   → Delegate to expert  │  ← out of domain
└─────────────────────────────────────┘
```

The Limen Score is not a confidence declared by the model itself — models are notoriously bad at that. It is an estimate built from **observable external signals**.

---

## The four signals of the Limen Score

### 1. Semantic variance

If you ask the same question multiple times to a LLM with slightly different temperatures, the stability of responses indicates real confidence. Very similar responses → high confidence. Responses that vary significantly → uncertainty.

```python
# Principle (simplified)
responses = [model.generate(question, temperature=t) for t in [0.1, 0.3, 0.5]]
embeddings = [embed(r) for r in responses]
variance = compute_semantic_variance(embeddings)
# High variance → the model is uncertain
```

### 2. Logical self-probing

The agent is asked to verify its own response with a different question:

```
Original question : "What is the BCEAO benchmark rate in March 2026?"
Self-probe        : "Are you sure about this? On what basis?"
```

If the agent hesitates or contradicts its first response, the score increases.

### 3. Domain detection

A lightweight classifier compares the question against the agent's known competence domains. A fintech question posed to an agent specialized in international law → high score regardless of declared confidence.

### 4. Calibrated confidence score

Some models expose token-level probabilities. These can be used as a raw signal, but they must be calibrated — models tend to be overconfident.

---

## Shared memory: the second problem

Even if each agent correctly estimates its competence, the memory problem remains. Two agents working on the same project have no common cognitive space — each starts from scratch.

Limen introduces a **Shared Context Layer**: memory attached to the _project_, not the agent.

```
Project: "Dymmo - STC architecture"

Session 1 (Claude):
    → Reads project memory
    → Adds: "STC = Sender Trace Capsule, stored TEE-side on sender device"
    → Updates memory

Session 2 (GPT):
    → Reads project memory (includes Session 1 note)
    → Continues without reprocessing what was already established
```

Result: fewer tokens consumed, fewer hallucinations on already-decided questions, real continuity between sessions.

---

## Comparison with existing approaches

| System    | Collaboration trigger | Shared memory | Metacognition |
| --------- | --------------------- | ------------- | ------------- |
| AutoGen   | Systematic            | No            | No            |
| CrewAI    | Role-defined          | No            | No            |
| LangGraph | Fixed workflow        | No            | No            |
| **Limen** | **At threshold**      | ** Yes**      | ** Yes**      |

Limen's position is not to replace these tools — it is to add an upstream layer that makes their use more efficient.

---

## Honest limitations of this approach

**Threshold calibration is hard.** What Limen Score justifies a consultation? 0.45? 0.60? This threshold is heuristic today — it would need evaluation data to be calibrated correctly per domain.

**Semantic variance costs tokens.** Generating multiple responses to measure stability multiplies cost by 3 or 4. On simple questions, this cost outweighs the benefit.

**Shared memory creates new risks.** An incorrect piece of information written to memory by one agent is read by all subsequent ones. Error propagation can be faster than in a system without memory.

**Not yet empirically validated.** Limen is an experimental framework. Benchmark results on complex reasoning tasks remain to be produced.

---

## What this article does not cover

- **LLM confidence calibration** — active research area (Platt scaling, temperature scaling)
- **RAG architectures** (Retrieval-Augmented Generation) — a different approach to the memory problem
- **Conflict resolution protocols** between agents with contradictory memories
- **Formal evaluation** of the Limen Score — how to measure whether a score of 0.6 actually reflects real uncertainty

---

## Going further

- [Limen — source code](https://github.com/DialloDBA/limen)
- [AutoGen — Microsoft Research](https://github.com/microsoft/autogen)
- [Metacognition in LLMs — Survey (arXiv)](https://arxiv.org/abs/2310.01848)
- [Calibration of Large Language Models — arXiv](https://arxiv.org/abs/2207.05221)
- [LangGraph — Orchestration framework](https://github.com/langchain-ai/langgraph)

---

_Written by [Abdourahamane Diallo](https://github.com/DialloDBA) — ATANAX Inc._
