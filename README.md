![GitHub stars](https://img.shields.io/github/stars/DialloDBA/how-it-works?style=flat-square)
![License: CC BY 4.0](https://img.shields.io/badge/License-CC%20BY%204.0-blue.svg?style=flat-square)
![GitHub last commit](https://img.shields.io/github/last-commit/DialloDBA/how-it-works?style=flat-square)

# how-it-works

Technical explanations of how real systems work in practice.

**[Français](#français) · [English](#english)**

---

## Français

Ce dépôt regroupe mes notes techniques sur des sujets que je maîtrise réellement.

Pas des résumés de Wikipedia. Pas des définitions copiées-collées. Des explications construites à partir de ce que j'ai conçu, débogué et mis en production.

Les sujets couverts : fintech, bases de données, systèmes distribués, sécurité, programmation, architecture système. La liste grandit avec le temps.

Chaque article que j'écris respecte trois règles :

- Un exemple concret avant toute abstraction
- Une section honnête sur les limites — ce que ça ne couvre pas
- Si c'est un tutoriel, tu dois pouvoir le refaire toi-même

---

## English

This repo is where I write down technical explanations of things I actually understand.

The focus is on how real systems work in practice — payment infrastructure, databases, distributed systems, security, and architecture. Not theory for its own sake.

I write in both French and English. Some articles will exist in one language before the other — I translate when I have time.

---

## Topics

- fintech infrastructure
- databases
- distributed systems
- security
- programming
- system architecture

---

## Index

<!-- INDEX_START -->

### 🇫🇷 Français

**fintech**

- [Pourquoi stocker les montants en BIGINT et non en DECIMAL ou FLOAT](docs/fr/fintech/pourquoi-bigint-pour-les-montants.md)

**artificial-intelligence**

- [Métacognition dans les systèmes multi-agents : comment un agent IA sait quand demander de l'aide](docs/fr/artificial-intelligence/metacognition-agents-ia-seuil-competence.md)

### 🇬🇧 English

**fintech**

- [Why Store Monetary Amounts as BIGINT Instead of DECIMAL or FLOAT](docs/en/fintech/why-store-amounts-as-bigint.md)

**artificial-intelligence**

- [Metacognition in Multi-Agent Systems: How an AI Agent Knows When to Ask for Help](docs/en/artificial-intelligence/ai-agent-competence-threshold-metacognition.md)

<!-- INDEX_END -->

---

## À venir · Upcoming

Sujets sur lesquels je travaille en ce moment ou que j'ai prévu d'écrire prochainement :

- How remittance corridors work
- How card networks work (Visa / Mastercard)
- Ledger design in SQL
- Idempotency keys in payment systems
- Kafka internals
- Database indexing strategies

---

## Structure du repo

```
how-it-works/
├── docs/
│   ├── en/
│   └── fr/
├── templates/
└── .github/
```

Les dossiers de catégories (`fintech/`, `databases/`, etc.) sont créés au fur et à mesure — pas à l'avance.

---

## Contribuer

Corrections, suggestions, signalement d'erreurs → ouvrir une [Issue](https://github.com/DialloDBA/how-it-works/issues).

Voir [CONTRIBUTING.md](CONTRIBUTING.md) pour les détails.

---

## Licence

[CC BY 4.0](LICENSE) — tu peux utiliser, adapter et redistribuer ce contenu, y compris commercialement, à condition de créditer l'auteur et de lier vers la source originale.

---

*Africa-first, World-ready.*