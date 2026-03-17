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

## Practical implementation

The examples below apply the same principle across the four languages most commonly used in fintech: convert on write, read back from the database, and handle per-currency precision.

```python
# CURRENCY_DECIMALS — ISO 4217 reference table
CURRENCY_DECIMALS = {"USD": 2, "EUR": 2, "XOF": 0, "KWD": 3, "JPY": 0, "BTC": 8}
```

### PHP

```php
<?php

const CURRENCY_DECIMALS = ['USD' => 2, 'EUR' => 2, 'XOF' => 0, 'KWD' => 3, 'JPY' => 0, 'BTC' => 8];

// Before writing to the database: convert display amount to smallest unit
function toMinorUnit(string $amount, string $currency): int
{
    $decimals = CURRENCY_DECIMALS[$currency] ?? 2;
    // bcmath avoids floating-point errors during the conversion itself
    return (int) bcmul($amount, bcpow('10', (string) $decimals), 0);
}

// After reading from the database: format for display
function formatAmount(int $amount, string $currency): string
{
    $decimals = CURRENCY_DECIMALS[$currency] ?? 2;
    $value = bcdiv((string) $amount, bcpow('10', (string) $decimals), $decimals);
    return number_format((float) $value, $decimals, '.', ' ') . ' ' . $currency;
}

// Exchange rate conversion: rate in major-unit source → major-unit target
function convertCurrency(int $amountFrom, float $rate, string $fromCurrency, string $toCurrency): int
{
    $fromDecimals = CURRENCY_DECIMALS[$fromCurrency] ?? 2;
    $toDecimals   = CURRENCY_DECIMALS[$toCurrency] ?? 2;
    // minor source → major source × rate → major target → minor target
    $result = ($amountFrom / pow(10, $fromDecimals)) * $rate * pow(10, $toDecimals);
    return (int) round($result);
}

// Usage
$stored  = toMinorUnit('10.50', 'USD');                   // 1050
$display = formatAmount(1050, 'USD');                     // "10.50 USD"
$xof     = convertCurrency(1050, 934.27, 'USD', 'XOF');  // 9810
```

### Python

```python
from decimal import Decimal, ROUND_HALF_UP

CURRENCY_DECIMALS: dict[str, int] = {
    "USD": 2, "EUR": 2, "XOF": 0, "KWD": 3, "JPY": 0, "BTC": 8
}

def to_minor_unit(amount: str | Decimal, currency: str) -> int:
    """Convert a display amount to the smallest unit (BIGINT storage)."""
    decimals = CURRENCY_DECIMALS.get(currency, 2)
    # Decimal(str(...)) avoids float errors at input
    return int(Decimal(str(amount)) * Decimal(10 ** decimals))

def format_amount(amount: int, currency: str) -> str:
    """Convert a BIGINT back to a human-readable display string."""
    decimals = CURRENCY_DECIMALS.get(currency, 2)
    value = Decimal(amount) / Decimal(10 ** decimals)
    return f"{value:.{decimals}f} {currency}"

def convert_currency(amount_from: int, rate: str | Decimal, from_currency: str, to_currency: str) -> int:
    """Apply an exchange rate (DECIMAL) and return a BIGINT."""
    from_decimals = CURRENCY_DECIMALS.get(from_currency, 2)
    to_decimals   = CURRENCY_DECIMALS.get(to_currency, 2)
    # minor source → major source × rate → major target → minor target
    result = Decimal(amount_from) / Decimal(10 ** from_decimals) * Decimal(str(rate)) * Decimal(10 ** to_decimals)
    return int(result.quantize(Decimal("1"), rounding=ROUND_HALF_UP))

# Usage
stored  = to_minor_unit("10.50", "USD")  # 1050
display = format_amount(1050, "USD")     # "10.50 USD"
xof     = convert_currency(1050, "934.27", "USD", "XOF")  # 9810
```

### JavaScript / Node.js

```javascript
const CURRENCY_DECIMALS = { USD: 2, EUR: 2, XOF: 0, KWD: 3, JPY: 0, BTC: 8 };

/**
 * Convert a display amount (string recommended) to the smallest unit.
 * Uses BigInt to avoid overflow on very large values.
 */
function toMinorUnit(amount, currency) {
  const decimals = CURRENCY_DECIMALS[currency] ?? 2;
  const [intPart = "0", decPart = ""] = String(amount).split(".");
  const paddedDec = decPart.padEnd(decimals, "0").slice(0, decimals);
  return BigInt(intPart) * BigInt(10 ** decimals) + BigInt(paddedDec || "0");
}

/** Convert a BIGINT (number or BigInt) to a human-readable display string. */
function formatAmount(amount, currency) {
  const decimals = CURRENCY_DECIMALS[currency] ?? 2;
  const value = Number(amount) / 10 ** decimals;
  return value.toFixed(decimals) + " " + currency;
}

/** Apply an exchange rate and return a safe integer. */
function convertCurrency(amountFrom, rate, fromCurrency, toCurrency) {
  const fromDecimals = CURRENCY_DECIMALS[fromCurrency] ?? 2;
  const toDecimals   = CURRENCY_DECIMALS[toCurrency]   ?? 2;
  // minor source → major source × rate → major target → minor target
  return Math.round((Number(amountFrom) / 10 ** fromDecimals) * rate * 10 ** toDecimals);
}

// Usage
const stored  = toMinorUnit("10.50", "USD");   // 1050n (BigInt)
const display = formatAmount(1050n, "USD");    // "10.50 USD"
const xof     = convertCurrency(1050, 934.27, "USD", "XOF"); // 9810
```

> **Node.js note**: when serializing to JSON over REST, convert BigInt to string (`BigInt.prototype.toString()`). Native `JSON.stringify` throws on BigInt values — use a library like `json-bigint` if needed.

### Java

```java
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Map;

public final class MoneyUtils {

    private static final Map<String, Integer> CURRENCY_DECIMALS = Map.of(
        "USD", 2, "EUR", 2, "XOF", 0, "KWD", 3, "JPY", 0, "BTC", 8
    );

    private MoneyUtils() {}

    /** Convert a display amount (BigDecimal) to the smallest unit for storage. */
    public static long toMinorUnit(BigDecimal amount, String currency) {
        int decimals = CURRENCY_DECIMALS.getOrDefault(currency, 2);
        return amount
            .multiply(BigDecimal.TEN.pow(decimals))
            .setScale(0, RoundingMode.HALF_UP)
            .longValueExact(); // throws ArithmeticException on overflow
    }

    /** Convert a BIGINT (long) to a human-readable display string. */
    public static String formatAmount(long amount, String currency) {
        int decimals = CURRENCY_DECIMALS.getOrDefault(currency, 2);
        BigDecimal value = BigDecimal.valueOf(amount, decimals);
        return String.format("%." + decimals + "f %s", value, currency);
    }

    /** Apply an exchange rate (BigDecimal) and return a long BIGINT. */
    public static long convertCurrency(long amountFrom, BigDecimal rate, String fromCurrency, String toCurrency) {
        int fromDecimals = CURRENCY_DECIMALS.getOrDefault(fromCurrency, 2);
        int toDecimals   = CURRENCY_DECIMALS.getOrDefault(toCurrency, 2);
        // minor source → major source × rate → major target → minor target
        return BigDecimal.valueOf(amountFrom)
            .divide(BigDecimal.TEN.pow(fromDecimals), 10, RoundingMode.HALF_UP)
            .multiply(rate)
            .multiply(BigDecimal.TEN.pow(toDecimals))
            .setScale(0, RoundingMode.HALF_UP)
            .longValueExact();
    }
}

// Usage
long   stored  = MoneyUtils.toMinorUnit(new BigDecimal("10.50"), "USD");   // 1050
String display = MoneyUtils.formatAmount(1050L, "USD");                    // "10.50 USD"
long   xof     = MoneyUtils.convertCurrency(1050L, new BigDecimal("934.27"), "USD", "XOF"); // 9810
```

> **Java note**: `longValueExact()` throws if the value exceeds `Long.MAX_VALUE`. For high-precision crypto assets (Wei/Ethereum), replace `long` with `BigInteger`.

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
