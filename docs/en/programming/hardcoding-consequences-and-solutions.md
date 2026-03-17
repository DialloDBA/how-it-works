---
title: "Hardcoding: What It Is, Why It's Dangerous, and How to Fix It"
slug: "hardcoding-consequences-and-solutions"
type: concepts
lang: en
translation: /docs/fr/programming/hardcoding-consequences-et-solutions.md
author: Abdourahamane Diallo
date: 2026-03-17
tags:
  [
    programming,
    best-practices,
    security,
    configuration,
    java,
    php,
    python,
    javascript,
  ]
status: published
---

# Hardcoding: What It Is, Why It's Dangerous, and How to Fix It

> In one sentence: writing values directly into source code — API keys, URLs, passwords, amounts — is one of the most common and most expensive mistakes in software development, and it repeats itself with every generation of developers.

🌐 [Lire en français](/docs/fr/programming/hardcoding-consequences-et-solutions.md)

---

## Why this matters

Hardcoding is probably the most universal bad practice in software development. Everyone has done it. Everyone has suffered from it. And yet, production projects in 2026 still expose AWS keys in public GitHub repos, database URLs committed in PHP files, fee amounts written directly in `if` conditions.

This is not a competence problem. It is a speed problem: when you code fast, you paste the value inline. The problem arrives six months later, at 3am, when you need to change that value in production.

---

## What you need to know first

- Be able to read code in at least one language
- Have a general idea of what an environment variable is

---

## What exactly is hardcoding?

Hardcoding means writing a concrete value directly in source code, where it should be configurable, parameterizable, or secret.

There are three categories of hardcoded values, with different severity levels:

**Category 1 — Secrets (critical)**
Passwords, API keys, access tokens, certificates, encryption keys. Never hardcode. Ever.

**Category 2 — Configuration (serious)**
Database URLs, server hostnames, ports, S3 bucket names, cloud region identifiers. Must live in environment variables or configuration files.

**Category 3 — Business values (problematic)**
Commission rates, transaction thresholds, currency codes, expiration delays. Must be in the database or a configuration file — not in the code.

---

## Concrete examples — PHP / Laravel

### The classic: API key in a controller

```php
// Incorrect — seen in Laravel projects in production
class OrangeMoneyController extends Controller
{
    public function initiatePayment(Request $request)
    {
        $response = Http::withHeaders([
            // Orange Money API key hardcoded
            // If this file is pushed to GitHub → account compromised
            'Authorization' => 'Bearer om_live_sk_xK9mP2nQ8rT5vW3yA1bC4dE6fG',
            'X-Merchant-Id' => 'MERCHANT_12345',
        ])->post('https://api.orange.com/orange-money-webpay/v1/webpayment', [
            'amount'   => $request->amount,
            'currency' => 'XOF',
        ]);

        return $response->json();
    }
}
```

```php
// Correct — Laravel environment variables
class OrangeMoneyController extends Controller
{
    public function initiatePayment(Request $request)
    {
        $response = Http::withHeaders([
            'Authorization' => 'Bearer ' . config('services.orange_money.api_key'),
            'X-Merchant-Id' => config('services.orange_money.merchant_id'),
        ])->post(config('services.orange_money.base_url') . '/webpayment', [
            'amount'   => $request->amount,
            'currency' => 'XOF',
        ]);

        return $response->json();
    }
}
```

`config/services.php`:

```php
return [
    'orange_money' => [
        'api_key'     => env('ORANGE_MONEY_API_KEY'),
        'merchant_id' => env('ORANGE_MONEY_MERCHANT_ID'),
        'base_url'    => env('ORANGE_MONEY_BASE_URL'),
    ],
];
```

`.env` (never committed — in `.gitignore`):

```
ORANGE_MONEY_API_KEY=om_live_sk_xK9mP2nQ8rT5vW3yA1bC4dE6fG
ORANGE_MONEY_MERCHANT_ID=MERCHANT_12345
ORANGE_MONEY_BASE_URL=https://api.orange.com/orange-money-webpay/v1
```

### Hardcoded business logic in PHP

```php
// Incorrect — business rules hardcoded in the code
class TransactionValidator
{
    public function validate(int $amount, string $currency): bool
    {
        // These numbers will change — and XOF has no sub-unit
        if ($currency === 'XOF' && $amount > 500000) {
            return false;
            // ERROR: XOF has no sub-unit, multiplier = 1
            // 500000 = 500,000 XOF, not 5,000 XOF
        }

        if ($amount < 100) {
            return false;
        }

        return true;
    }
}
```

Two problems here: the hardcoding and the confusion about the XOF multiplier.

```php
// Correct — configuration + clean BIGINT
class TransactionValidator
{
    public function __construct(
        private readonly TransactionLimitRepository $limits
    ) {}

    public function validate(int $amount, string $currency): bool
    {
        // Limits come from the database
        // Modifiable by admin without touching the code
        $limit = $this->limits->findByCurrency($currency);

        if ($amount > $limit->max_amount) {
            return false;
        }

        if ($amount < $limit->min_amount) {
            return false;
        }

        return true;
    }
}
```

Database table:

```sql
CREATE TABLE transaction_limits (
    currency    CHAR(3)   PRIMARY KEY,
    min_amount  BIGINT    NOT NULL,  -- in currency's smallest unit
    max_amount  BIGINT    NOT NULL,  -- XOF: directly in XOF (no sub-unit)
    updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO transaction_limits VALUES
('XOF', 100,     500000,    NOW()),  -- min 100 XOF, max 500,000 XOF
('GNF', 1000,    5000000,   NOW()),  -- min 1,000 GNF, max 5,000,000 GNF
('USD', 100,     50000,     NOW());  -- min $1.00, max $500.00 (in cents)
```

---

## Concrete examples — Python

```python
# Incorrect — hardcoded credentials in a Python script
# Classic in migration or automation scripts
import psycopg2
import requests

conn = psycopg2.connect(
    host="prod-db.atanax.com",
    database="dymmo",
    user="dymmo_admin",
    password="Dymm0_Pr0d_2024!"  # in git history forever
)

response = requests.post(
    "https://api-beta.bceao.int/pi-spi/v1/payments",
    headers={"Authorization": "Bearer eyJhbGci..."},
    json={"amount": 50000}
)
```

```python
# Correct — python-dotenv + os.environ
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()  # loads the .env file

# Validate at startup — before any connection
required_vars = ["DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD", "PISPI_API_KEY"]
missing = [var for var in required_vars if not os.environ.get(var)]
if missing:
    raise EnvironmentError(f"Missing environment variables: {', '.join(missing)}")

conn = psycopg2.connect(
    host=os.environ["DB_HOST"],
    database=os.environ["DB_NAME"],
    user=os.environ["DB_USER"],
    password=os.environ["DB_PASSWORD"]
)
```

---

## Concrete examples — JavaScript / Node.js

```javascript
// Incorrect — Stripe key hardcoded in a JS file
// Worst case: frontend file compiled and sent to the client
const stripe = require("stripe")("YOUR_STRIPE_SECRET_KEY");
// A live Stripe key (sk_live_...) hardcoded here — in the JS bundle sent to all browsers.

const paymentIntent = await stripe.paymentIntents.create({
  amount: 50000, // Incorrect — hardcoded amount
  currency: "xof",
  payment_method: req.body.paymentMethodId,
  confirm: true,
});
```

```javascript
// Correct — Node.js environment variables
require("dotenv").config();

// Validate at startup — before any initialization
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY missing");
}

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// Amount comes from the request or config, never hardcoded
const paymentIntent = await stripe.paymentIntents.create({
  amount: req.body.amountCentimes, // validated BIGINT from client
  currency: req.body.currency.toLowerCase(),
  payment_method: req.body.paymentMethodId,
  confirm: true,
});
```

**Frontend-specific warning:** any environment variable prefixed with `NEXT_PUBLIC_`, `VITE_`, or `REACT_APP_` in a frontend project is **sent to the browser**. Never put a secret in these variables.

```bash
# .env.local (Next.js)
STRIPE_SECRET_KEY=sk_live_...        # server-side only
NEXT_PUBLIC_STRIPE_PK=pk_live_...    # public key — safe to expose
```

---

## Concrete examples — Java

### The worst case: credentials hardcoded

```java
// Incorrect — seen in production. Often in a public GitHub repo.
public class DatabaseConnection {
    private static final String URL      = "jdbc:postgresql://prod-db.atanax.com:5432/dymmo";
    private static final String USERNAME = "dymmo_admin";
    private static final String PASSWORD = "Dymm0_Pr0d_2024!";  // committed to GitHub

    public Connection getConnection() throws SQLException {
        return DriverManager.getConnection(URL, USERNAME, PASSWORD);
    }
}
```

This code was committed. It is in the git history. Even if you delete the line tomorrow, `git log` keeps it forever. Bots continuously scan GitHub for this exact pattern.

```java
// Correct — environment variables, validated at startup
public class DatabaseConnection {
    private static final String URL;
    private static final String USERNAME;
    private static final String PASSWORD;

    static {
        URL      = System.getenv("DB_URL");
        USERNAME = System.getenv("DB_USERNAME");
        PASSWORD = System.getenv("DB_PASSWORD");

        if (URL == null || USERNAME == null || PASSWORD == null) {
            // IllegalStateException thrown here — the JVM wraps it in ExceptionInInitializerError
            throw new IllegalStateException(
                "Missing DB environment variables. " +
                "Check DB_URL, DB_USERNAME, DB_PASSWORD."
            );
        }
    }

    public Connection getConnection() throws SQLException {
        return DriverManager.getConnection(URL, USERNAME, PASSWORD);
    }
}
```

### The silent case: hardcoded business values

```java
// Incorrect — hardcoded commission rate
public class PaymentService {

    public long calculateFee(long amountCentimes) {
        // 1.5% commission
        // What happens when BCEAO changes the rules?
        // What happens for Premium merchants at 0.8%?
        // What happens for transactions > 1,000,000 XOF at 1.2%?
        return (long) (amountCentimes * 0.015);
    }

    public boolean isTransactionAllowed(long amountCentimes) {
        // Incorrect — hardcoded threshold (guaranteed to change)
        return amountCentimes <= 500000_00L;
    }
}
```

When the commercial director calls to say Premium merchants get a different rate, you have to recompile, retest, redeploy. To change a number.

```java
// Correct — business values in configuration
@Service
public class PaymentService {

    @Value("${payment.commission.standard}")  // e.g. 150 = 1.5% in basis points
    private int commissionBasisPoints;

    @Value("${payment.transaction.max_amount}")  // in smallest unit
    private long maxTransactionAmount;

    public long calculateFee(long amountCentimes) {
        // basis points: 100 = 1%, 150 = 1.5%, 80 = 0.8%
        return (amountCentimes * commissionBasisPoints) / 10000;
    }

    public boolean isTransactionAllowed(long amountCentimes) {
        return amountCentimes <= maxTransactionAmount;
    }
}
```

`application.properties`:

```properties
payment.commission.standard=150
payment.transaction.max_amount=50000000
```

Changing the commission = modify the config file, restart. No recompilation, no code deployment.

### The hardcoded URL

```java
// Incorrect — external API URL hardcoded
public class PiSpiClient {

    public String getToken() {
        // What happens when switching from sandbox to production?
        String url = "https://api-beta.bceao.int/pi-spi/v1/oauth/token";
        return token;
    }
}
```

In sandbox, everything works. On the day of the production switch, you have to find every occurrence in the code — and miss one, inevitably.

```java
// Correct — URL in configuration
@Service
public class PiSpiClient {

    @Value("${pispi.base-url}")
    private String baseUrl;

    public String getToken() {
        String url = baseUrl + "/oauth/token";
        return token;
    }
}
```

`application-sandbox.properties`:

```properties
pispi.base-url=https://api-beta.bceao.int/pi-spi/v1
```

`application-production.properties`:

```properties
pispi.base-url=https://api.bceao.int/pi-spi/v1
```

Switch to production = change the Spring profile. One line.

---

## Real consequences, by category

### Security — the most severe

In October 2022, Samsung disclosed a data breach due to hardcoded AWS credentials in internal code. In December 2021, Twitch suffered a 125 GB source code leak — internal API keys were hardcoded.

Bots like `truffleHog`, `git-secrets`, and `gitleaks` scan GitHub continuously and find API key patterns within seconds of a push.

```bash
# What a bot sees when you commit this:
git log --all -p | grep -E "(api_key|password|secret|token)\s*=\s*['\"][^'\"]{8,}"
# → finds everything in under a second
```

### Maintenance — the most expensive

```java
// Imagine 47 occurrences of this URL in the codebase
String url = "https://api-beta.bceao.int/pi-spi/v1";

// Production switch: grep + sed on the entire repo
// But grep does not find URLs built dynamically:
String url = "https://api-beta.bceao.int" + "/pi-spi/v1";  // missed
String baseUrl = "https://api-beta.bceao.int";              // also missed
```

A `grep` on a URL does not find all its occurrences if it is built dynamically. You miss one. You go to production. It still points to sandbox.

### Testing — the invisible cost

```php
// Incorrect — code impossible to unit test
class FeeCalculator
{
    public function calculate(int $amount): int
    {
        // 1.5% hardcoded — impossible to test the 0.8% case without modifying code
        return (int) ($amount * 0.015);
    }
}

// Unit test: what are we actually testing?
// That 0.015 × $amount = result. Always true. Useless test.
```

```php
// Correct — testable code
class FeeCalculator
{
    public function __construct(
        private readonly int $basisPoints  // injected
    ) {}

    public function calculate(int $amount): int
    {
        return (int) ($amount * $this->basisPoints / 10000);
    }
}

// Useful unit tests
it('calculates standard commission at 1.5%', function () {
    $calculator = new FeeCalculator(150);
    expect($calculator->calculate(100000))->toBe(1500);
});

it('calculates premium commission at 0.8%', function () {
    $calculator = new FeeCalculator(80);
    expect($calculator->calculate(100000))->toBe(800);
});
```

### Multi-environment — the inevitable

Every serious project has at least three environments: development, staging, production. With hardcoded values, you have three versions of the same file, each different, each synchronized manually.

```
Developer A commits with DB_HOST=localhost
Developer B pulls → their app points to A's localhost
CI/CD runs → points to localhost that does not exist
Production → still pointing to sandbox if someone forgot to change it
```

---

## What this article does not cover

- **Secret management in production** — HashiCorp Vault, AWS Secrets Manager, Azure Key Vault
- **Key rotation** — how to change a compromised API key without downtime
- **Secrets in Docker images** — how to avoid building secrets into an image
- **Auditing an existing repo** — how to scan git history to detect already-committed secrets (gitleaks, trufflehog)
- **`.gitignore` configuration** — the patterns to include per stack to never commit secrets
- **Feature flags** — a natural extension of dynamic configuration to control behavior without redeployment

---

## Going further

- [OWASP — Hardcoded Credentials](https://owasp.org/www-community/vulnerabilities/Use_of_hard-coded_credentials)
- [The Twelve-Factor App — III. Config](https://12factor.net/config)
- [gitleaks — secret detection in git](https://github.com/gitleaks/gitleaks)
- [Laravel — Configuration & Environment](https://laravel.com/docs/configuration)
- [Spring Boot — Externalized Configuration](https://docs.spring.io/spring-boot/docs/current/reference/html/features.html#features.external-config)

---

_Written by [Abdourahamane Diallo](https://github.com/DialloDBA) — ATANAX Inc._
