---
title: "Pourquoi stocker les montants en BIGINT et non en DECIMAL ou FLOAT"
slug: "pourquoi-bigint-pour-les-montants"
type: concepts
lang: fr
translation: /docs/en/fintech/why-store-amounts-as-bigint.md
author: Abdourahamane Diallo
date: 2026-03-17
tags: [fintech, base-de-donnees, sql, paiements, precision-numerique]
status: published
---

# Pourquoi stocker les montants en BIGINT et non en DECIMAL ou FLOAT

> En une phrase : les types à virgule introduisent des erreurs d'arrondi imperceptibles en développement mais catastrophiques en production — BIGINT les élimine complètement en travaillant dans l'unité minimale de chaque devise.

🌐 [Read in English](/docs/en/fintech/why-store-amounts-as-bigint.md)

---

## Pourquoi ce sujet

Un système de paiement qui calcule mal n'est pas juste buggé — il est potentiellement frauduleux ou en infraction réglementaire. Les erreurs d'arrondi sur les devises sont silencieuses : elles ne lèvent aucune exception, elles s'accumulent sur des millions de transactions, et ton livre de comptes finit par ne plus balancer. Ce problème a un nom dans l'industrie : **floating point leakage**.

---

## Ce que tu dois savoir avant de lire

- Savoir ce qu'est une colonne SQL et un type de donnée
- Avoir une notion de base de ce qu'est une transaction financière

---

## Le problème avec FLOAT

FLOAT est un type à virgule flottante binaire, défini par la norme IEEE 754. Il représente les nombres réels en binaire avec un exposant et une mantisse. Le problème fondamental : il est **impossible de représenter exactement la plupart des fractions décimales en base 2** — de la même façon qu'on ne peut pas écrire `1/3` exactement en base 10.

```
0.1 + 0.2 = 0.30000000000000004
```

Ce n'est pas un bug de ton langage. C'est une limite mathématique. En base de données :

```sql
SELECT 0.1 + 0.2 = 0.3;
-- Résultat : FALSE
```

Sur une transaction isolée, l'erreur est infime. Sur un million de transactions quotidiennes, ces fractions de centimes s'accumulent. À la fin du mois, ton système déclare un solde différent de la réalité. Utiliser FLOAT pour des montants monétaires est une faute d'architecture.

---

## Pourquoi pas DECIMAL ?

`DECIMAL(19, 4)` est mathématiquement exact — pas d'erreur de représentation. C'est ce que beaucoup de systèmes legacy utilisent, et ce n'est pas incorrect.

Le problème est la performance. Les processeurs modernes ont des instructions natives pour l'arithmétique entière et flottante, mais pas pour l'arithmétique décimale. Les opérations sur DECIMAL passent par une émulation logicielle. Sur des volumes importants — millions de transactions par jour, agrégations comptables, rapprochements en temps réel — cette différence se mesure.

| Critère           | BIGINT                   | DECIMAL                  | FLOAT               |
| ----------------- | ------------------------ | ------------------------ | ------------------- |
| Exactitude        | Parfaite                 | Parfaite                 | Erreurs d'arrondi   |
| Performance       | Instructions CPU natives | Arithmétique logicielle  | Rapide mais inexact |
| Stockage          | 8 octets fixe            | Variable selon précision | 4-8 octets          |
| Tri / comparaison | Trivial                  | Plus coûteux             | Non fiable          |
| Overflow          | Gérable                  | Rare                     | Silencieux          |

---

## La solution : travailler en unité minimale

L'astuce est simple : ne stocke jamais une devise avec une virgule. Convertis chaque montant dans l'unité indivisible de sa devise avant de l'écrire en base.

```
1,00 USD  →  100          (centimes)
1,00 EUR  →  100          (centimes)
1,00 XOF  →  1            (pas de sous-unité en franc CFA)
1,00 BTC  →  100 000 000  (satoshis)
```

```sql
-- Ne pas faire
amount DECIMAL(19,4)   -- stocke 12.5000

-- Faire
amount BIGINT          -- stocke 1250 (en centimes)
```

La valeur maximale de BIGINT est `9 223 372 036 854 775 807`. En centimes, ça représente 92 trillions de dollars. Il n'y a aucun risque de dépassement dans un usage monétaire réel.

---

## Ce que tu prends en charge en contrepartie

Ce choix déplace la responsabilité vers l'application. Trois choses à gérer :

**1. La conversion à l'affichage**

La division ne se fait jamais en base — seulement au moment de présenter la valeur à l'utilisateur.

```javascript
// Stocké en DB : 10050
// Affiché : "100.50 USD"
const formatAmount = (amount, currency) => {
  const precision = CURRENCY_DECIMALS[currency] ?? 2;
  return (amount / Math.pow(10, precision)).toFixed(precision) + " " + currency;
};
```

**2. La précision par devise**

Toutes les devises n'ont pas 2 décimales. La norme ISO 4217 définit le nombre de décimales officielles pour chaque devise.

```
USD, EUR, XOF, MAD  →  ×100    (2 décimales)
KWD, BHD, OMR       →  ×1000   (3 décimales)
JPY, KRW, GNF       →  ×1      (0 décimale)
BTC                 →  ×10^8   (8 décimales)
```

**3. Les taux de change**

Les taux de change restent en DECIMAL — `1 USD = 934.27 XOF` ne s'exprime pas en entier. La règle : le taux en DECIMAL, le montant converti en BIGINT.

```sql
-- Table des taux
rate DECIMAL(18, 8)   -- ex: 934.27000000

-- La conversion se fait dans l'application
-- amount_xof = ROUND(amount_usd * rate)
-- Le résultat est stocké comme BIGINT
```

---

## Implémentation pratique

Les exemples ci-dessous appliquent le même principe dans les quatre langages les plus courants en fintech : conversion au stockage, lecture depuis la base, et gestion de la précision par devise.

```python
# CURRENCY_DECIMALS — table de référence ISO 4217
CURRENCY_DECIMALS = {"USD": 2, "EUR": 2, "XOF": 0, "KWD": 3, "JPY": 0, "BTC": 8}
```

### PHP

```php
<?php

const CURRENCY_DECIMALS = ['USD' => 2, 'EUR' => 2, 'XOF' => 0, 'KWD' => 3, 'JPY' => 0, 'BTC' => 8];

// Avant l'écriture en base : convertir le montant affiché en unité minimale
function toMinorUnit(string $amount, string $currency): int
{
    $decimals = CURRENCY_DECIMALS[$currency] ?? 2;
    // bcmath évite les erreurs de floating-point durant la conversion elle-même
    return (int) bcmul($amount, bcpow('10', (string) $decimals), 0);
}

// Après lecture depuis la base : formater pour l'affichage
function formatAmount(int $amount, string $currency): string
{
    $decimals = CURRENCY_DECIMALS[$currency] ?? 2;
    $value = bcdiv((string) $amount, bcpow('10', (string) $decimals), $decimals);
    return number_format((float) $value, $decimals, '.', ' ') . ' ' . $currency;
}

// Conversion de taux de change : taux en DECIMAL, résultat en BIGINT
function convertCurrency(int $amountFrom, float $rate, string $toCurrency): int
{
    $decimals = CURRENCY_DECIMALS[$toCurrency] ?? 2;
    return (int) round($amountFrom * $rate);
}

// Usage
$stored  = toMinorUnit('10.50', 'USD');   // 1050
$display = formatAmount(1050, 'USD');     // "10.50 USD"
$xof     = convertCurrency(1050, 934.27, 'XOF'); // ~9810 francs CFA
```

### Python

```python
from decimal import Decimal, ROUND_HALF_UP

CURRENCY_DECIMALS: dict[str, int] = {
    "USD": 2, "EUR": 2, "XOF": 0, "KWD": 3, "JPY": 0, "BTC": 8
}

def to_minor_unit(amount: str | Decimal, currency: str) -> int:
    """Convertit un montant affiché en unité minimale (stockage BIGINT)."""
    decimals = CURRENCY_DECIMALS.get(currency, 2)
    # Decimal(str(...)) pour éviter les erreurs float dès la saisie
    return int(Decimal(str(amount)) * Decimal(10 ** decimals))

def format_amount(amount: int, currency: str) -> str:
    """Convertit un BIGINT en chaîne lisible pour l'affichage."""
    decimals = CURRENCY_DECIMALS.get(currency, 2)
    value = Decimal(amount) / Decimal(10 ** decimals)
    return f"{value:.{decimals}f} {currency}"

def convert_currency(amount_from: int, rate: str | Decimal, to_currency: str) -> int:
    """Applique un taux de change (DECIMAL) et renvoie un BIGINT."""
    result = Decimal(amount_from) * Decimal(str(rate))
    return int(result.quantize(Decimal("1"), rounding=ROUND_HALF_UP))

# Usage
stored  = to_minor_unit("10.50", "USD")  # 1050
display = format_amount(1050, "USD")     # "10.50 USD"
xof     = convert_currency(1050, "934.27", "XOF")  # 981982
```

### JavaScript / Node.js

```javascript
const CURRENCY_DECIMALS = { USD: 2, EUR: 2, XOF: 0, KWD: 3, JPY: 0, BTC: 8 };

/**
 * Convertit un montant affiché (string recommandé) en unité minimale.
 * Utilise BigInt pour éviter les dépassements sur les très grandes valeurs.
 */
function toMinorUnit(amount, currency) {
  const decimals = CURRENCY_DECIMALS[currency] ?? 2;
  const [intPart = "0", decPart = ""] = String(amount).split(".");
  const paddedDec = decPart.padEnd(decimals, "0").slice(0, decimals);
  return BigInt(intPart) * BigInt(10 ** decimals) + BigInt(paddedDec || "0");
}

/** Convertit un BIGINT (number ou BigInt) en chaîne lisible. */
function formatAmount(amount, currency) {
  const decimals = CURRENCY_DECIMALS[currency] ?? 2;
  const divisor = 10 ** decimals;
  const value = Number(amount) / divisor;
  return value.toFixed(decimals) + " " + currency;
}

/** Applique un taux de change et renvoie un entier (number safe jusqu'à 2^53). */
function convertCurrency(amountFrom, rate, toCurrency) {
  return Math.round(Number(amountFrom) * rate);
}

// Usage
const stored  = toMinorUnit("10.50", "USD");   // 1050n (BigInt)
const display = formatAmount(1050n, "USD");    // "10.50 USD"
const xof     = convertCurrency(1050, 934.27, "XOF"); // 981984
```

> **Note Node.js** : pour les APIs REST, sérialise les BIGINT en `string` dans le JSON (`JSON.stringify` natif ne gère pas `BigInt`). Utilise `BigInt.prototype.toString()` ou une lib comme `json-bigint`.

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

    /** Convertit un montant affiché (BigDecimal) en unité minimale pour stockage. */
    public static long toMinorUnit(BigDecimal amount, String currency) {
        int decimals = CURRENCY_DECIMALS.getOrDefault(currency, 2);
        return amount
            .multiply(BigDecimal.TEN.pow(decimals))
            .setScale(0, RoundingMode.HALF_UP)
            .longValueExact(); // lève ArithmeticException si overflow
    }

    /** Convertit un BIGINT (long) en chaîne lisible pour l'affichage. */
    public static String formatAmount(long amount, String currency) {
        int decimals = CURRENCY_DECIMALS.getOrDefault(currency, 2);
        BigDecimal value = BigDecimal.valueOf(amount, decimals);
        return String.format("%." + decimals + "f %s", value, currency);
    }

    /** Applique un taux de change (BigDecimal) et renvoie un long BIGINT. */
    public static long convertCurrency(long amountFrom, BigDecimal rate, String toCurrency) {
        return BigDecimal.valueOf(amountFrom)
            .multiply(rate)
            .setScale(0, RoundingMode.HALF_UP)
            .longValueExact();
    }
}

// Usage
long stored  = MoneyUtils.toMinorUnit(new BigDecimal("10.50"), "USD");   // 1050
String display = MoneyUtils.formatAmount(1050L, "USD");                  // "10.50 USD"
long xof     = MoneyUtils.convertCurrency(1050L, new BigDecimal("934.27"), "XOF"); // 981984
```

> **Note Java** : `longValueExact()` lève une exception si la valeur dépasse `Long.MAX_VALUE`. Pour les actifs crypto à forte précision (Wei/Ethereum), remplace `long` par `BigInteger`.

---

## Ce pattern est le standard de l'industrie

L'API Stripe retourne toujours :

```json
{
  "amount": 1050,
  "currency": "usd"
}
```

`1050` = 10,50 USD. Le champ `currency` porte l'information de précision. C'est exactement cette logique.

---

## Ce que cet article ne couvre pas

- Les calculs d'intérêts composés, qui nécessitent une précision intermédiaire élevée — on travaille en DECIMAL pour le calcul, puis on arrondit le résultat final en BIGINT à l'écriture
- Les actifs fractionnés comme 0.00341 ETH — la logique est la même mais le multiplicateur monte (×10^18 pour Wei sur Ethereum)
- Les devises en hyperinflation, où des montants en milliards d'unités locales peuvent nécessiter une analyse spécifique

---

## Pour aller plus loin

- [ISO 4217 — Codes de devises et décimales officielles](https://www.iso.org/iso-4217-currency-codes.html)
- [IEEE 754 — Standard pour l'arithmétique flottante](https://ieeexplore.ieee.org/document/8766229)
- [Stripe API Reference — Amounts](https://stripe.com/docs/api/charges/object#charge_object-amount)
- [Martin Fowler — Money Pattern](https://martinfowler.com/eaaCatalog/money.html)

---

_Écrit par [Abdourahamane Diallo](https://github.com/DialloDBA) — ATANAX Inc._
