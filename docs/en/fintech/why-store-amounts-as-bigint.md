---
title: "Why Store Monetary Amounts as BIGINT Instead of DECIMAL or FLOAT"
slug: "why-store-amounts-as-bigint"
type: concepts
lang: en
translation: /docs/fr/fintech/pourquoi-bigint-pour-les-montants.md
author: Abdourahamane Diallo
date: 2026-03-17
tags: [fintech, database, sql, payments, numeric-precision]
status: published
---

# Why Store Monetary Amounts as BIGINT Instead of DECIMAL or FLOAT

> In one sentence: floating-point types introduce rounding errors that are invisible during development but catastrophic in production — BIGINT eliminates them entirely by working in each currency's smallest indivisible unit.

🌐 [Lire en français](/docs/fr/fintech/pourquoi-bigint-pour-les-montants.md)

---

## Why this matters

A payment system that miscalculates isn't just buggy — it's potentially fraudulent or non-compliant. Rounding errors on currency values are silent: they raise no exceptions, they accumulate across millions of transactions, and your ledger eventually stops balancing. The industry has a name for this: **floating point leakage**.

---

## What you need to know first

- Know what a SQL column and data type are
- Have a basic understanding of what a financial transaction is

---

## The problem with FLOAT

FLOAT is a binary floating-point type defined by the IEEE 754 standard. It represents real numbers in binary using an exponent and a mantissa. The fundamental problem: **it is mathematically impossible to represent most decimal fractions exactly in base 2** — just as you cannot write `1/3` exactly in base 10.

```
0.1 + 0.2 = 0.30000000000000004
```

This is not a bug in your language. It's a mathematical limitation. In a database:

```sql
SELECT 0.1 + 0.2 = 0.3;
-- Result: FALSE
```

On a single transaction the error is negligible. Across one million daily transactions, these fractions of cents accumulate. By month-end, your system reports a balance that differs from reality. Using FLOAT for monetary values is an architectural mistake.

---

## Why not DECIMAL?

`DECIMAL(19, 4)` is mathematically exact — no representation errors. Many legacy systems use it, and it's not wrong.

The problem is performance. Modern processors have native instructions for integer and floating-point arithmetic, but not for decimal arithmetic. DECIMAL operations are emulated in software. At scale — millions of transactions per day, accounting aggregations, real-time reconciliation — this difference is measurable.

| Criterion         | BIGINT                  | DECIMAL               | FLOAT               |
| ----------------- | ----------------------- | --------------------- | ------------------- |
| Exactness         | Perfect                 | Perfect               | Rounding errors     |
| Performance       | Native CPU instructions | Software arithmetic   | Fast but inaccurate |
| Storage           | Fixed 8 bytes           | Variable by precision | 4-8 bytes           |
| Sort / comparison | Trivial                 | More costly           | Unreliable          |
| Overflow          | Manageable              | Rare                  | Silent              |

---

## The solution: work in the smallest unit

The trick is simple: never store a currency value with a decimal point. Convert every amount to the indivisible unit of its currency before writing it to the database.

```
1.00 USD  →  100          (cents)
1.00 EUR  →  100          (cents)
1.00 XOF  →  1            (no sub-unit in CFA franc)
1.00 BTC  →  100,000,000  (satoshis)
```

```sql
-- Don't do this
amount DECIMAL(19,4)   -- stores 12.5000

-- Do this
amount BIGINT          -- stores 1250 (in cents)
```

The maximum BIGINT value is `9,223,372,036,854,775,807`. In cents, that is $92 trillion. There is zero overflow risk for any realistic monetary use case.

---

## What you take responsibility for in return

This choice shifts responsibility to the application layer. Three things to manage:

**1. Conversion at display time**

Division never happens in the database — only when presenting the value to a user.

```javascript
// Stored in DB: 10050
// Displayed: "100.50 USD"
const formatAmount = (amount, currency) => {
  const precision = CURRENCY_DECIMALS[currency] ?? 2;
  return (amount / Math.pow(10, precision)).toFixed(precision) + " " + currency;
};
```

**2. Precision per currency**

Not all currencies have 2 decimal places. The ISO 4217 standard defines the official number of decimal digits for each currency.

```
USD, EUR, XOF, MAD  →  ×100    (2 decimal places)
KWD, BHD, OMR       →  ×1000   (3 decimal places)
JPY, KRW, GNF       →  ×1      (0 decimal places)
BTC                 →  ×10^8   (8 decimal places)
```

**3. Exchange rates**

Exchange rates stay in DECIMAL — `1 USD = 934.27 XOF` cannot be expressed as an integer. The rule: rate in DECIMAL, converted amount in BIGINT.

```sql
-- Rate table
rate DECIMAL(18, 8)   -- e.g. 934.27000000

-- Conversion happens in the application
-- amount_xof = ROUND(amount_usd * rate)
-- The result is stored as BIGINT
```

---

## This pattern is the industry standard

The Stripe API always returns:

```json
{
  "amount": 1050,
  "currency": "usd"
}
```

`1050` = $10.50 USD. The `currency` field carries the precision information. Same logic.

---

## What this article does not cover

- Compound interest calculations, which require high intermediate precision — use DECIMAL for the calculation, then round the final result to BIGINT at write time
- Fractional assets like 0.00341 ETH — the logic is the same but the multiplier scales up (×10^18 for Wei on Ethereum)
- Hyperinflationary currencies, where amounts in the billions of local units may need specific overflow analysis

---

## Going further

- [ISO 4217 — Currency codes and official decimal places](https://www.iso.org/iso-4217-currency-codes.html)
- [IEEE 754 — Standard for floating-point arithmetic](https://ieeexplore.ieee.org/document/8766229)
- [Stripe API Reference — Amounts](https://stripe.com/docs/api/charges/object#charge_object-amount)
- [Martin Fowler — Money Pattern](https://martinfowler.com/eaaCatalog/money.html)

---

_Written by [Abdourahamane Diallo](https://github.com/DialloDBA) — ATANAX Inc._
