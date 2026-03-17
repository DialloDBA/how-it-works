---
title: "Le hardcoding : ce que c'est, pourquoi c'est dangereux, et comment s'en sortir"
slug: "hardcoding-consequences-et-solutions"
type: concepts
lang: fr
translation: /docs/en/programming/hardcoding-consequences-and-solutions.md
author: Abdourahamane Diallo
date: 2026-03-17
tags:
  [
    programmation,
    bonnes-pratiques,
    securite,
    configuration,
    java,
    php,
    python,
    javascript,
  ]
status: published
---

# Le hardcoding : ce que c'est, pourquoi c'est dangereux, et comment s'en sortir

> En une phrase : coder des valeurs directement dans le code source — clés API, URLs, mots de passe, montants — est l'une des erreurs les plus courantes et les plus coûteuses en développement, et elle se reproduit à chaque génération de développeurs.

🌐 [Read in English](/docs/en/programming/hardcoding-consequences-and-solutions.md)

---

## Pourquoi ce sujet

Le hardcoding est probablement la mauvaise pratique la plus universelle du développement logiciel. Tout le monde l'a fait. Tout le monde en a souffert. Et pourtant, des projets en production en 2026 exposent encore des clés AWS dans des repos GitHub publics, des URLs de base de données codées en dur dans des fichiers PHP commités, des montants de frais écrits directement dans des conditions `if`.

Ce n'est pas un problème de compétence. C'est un problème de vitesse : quand on code vite, on colle la valeur directement. Le problème arrive six mois plus tard, à 3h du matin, quand il faut changer cette valeur en production.

---

## Ce que tu dois savoir avant de lire

- Savoir lire du code dans au moins un langage
- Avoir une idée de ce qu'est une variable d'environnement

---

## Qu'est-ce que le hardcoding exactement ?

Le hardcoding, c'est écrire une valeur concrète directement dans le code source, là où elle devrait être configurable, paramétrable, ou secrète.

Il existe trois catégories de valeurs hardcodées, avec des niveaux de gravité différents :

**Catégorie 1 — Secrets (critique)**
Mots de passe, clés API, tokens d'accès, certificats, clés de chiffrement. Ne jamais coder en dur. Jamais.

**Catégorie 2 — Configuration (grave)**
URLs de base de données, hostnames de serveurs, ports, noms de buckets S3, identifiants de région cloud. Doivent vivre dans des variables d'environnement ou fichiers de configuration.

**Catégorie 3 — Valeurs métier (problématique)**
Taux de commission, seuils de transaction, codes de devises, délais d'expiration. Doivent être dans la base de données ou un fichier de configuration — pas dans le code.

---

## Les exemples concrets — PHP / Laravel

### Le classique : clé API dans un contrôleur

```php
// Incorrect — vu dans des projets Laravel en production
class OrangeMoneyController extends Controller
{
    public function initiatePayment(Request $request)
    {
        $response = Http::withHeaders([
            // Clé API Orange Money codée en dur
            // Si ce fichier est pushé sur GitHub → compte compromis
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
// Correct — variables d'environnement Laravel
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

`config/services.php` :

```php
return [
    'orange_money' => [
        'api_key'     => env('ORANGE_MONEY_API_KEY'),
        'merchant_id' => env('ORANGE_MONEY_MERCHANT_ID'),
        'base_url'    => env('ORANGE_MONEY_BASE_URL'),
    ],
];
```

`.env` (jamais committé — dans `.gitignore`) :

```
ORANGE_MONEY_API_KEY=om_live_sk_xK9mP2nQ8rT5vW3yA1bC4dE6fG
ORANGE_MONEY_MERCHANT_ID=MERCHANT_12345
ORANGE_MONEY_BASE_URL=https://api.orange.com/orange-money-webpay/v1
```

### Le hardcoding de logique métier en PHP

```php
// Incorrect — règles de business codées en dur dans le code
class TransactionValidator
{
    public function validate(int $amount, string $currency): bool
    {
        // Ces chiffres vont changer — et XOF n'a pas de sous-unité
        if ($currency === 'XOF' && $amount > 500000) {
            return false; // 500000 = 500 000 XOF, pas 5 000 XOF
        }

        if ($amount < 100) {
            return false;
        }

        return true;
    }
}
```

Il y a deux problèmes ici : le hardcoding ET la confusion sur le multiplicateur XOF.

```php
// Correct — configuration + BIGINT propre
class TransactionValidator
{
    public function __construct(
        private readonly TransactionLimitRepository $limits
    ) {}

    public function validate(int $amount, string $currency): bool
    {
        // Les limites viennent de la base de données
        // Modifiables par l'admin sans toucher au code
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

Table en base :

```sql
CREATE TABLE transaction_limits (
    currency    CHAR(3)  PRIMARY KEY,
    min_amount  BIGINT   NOT NULL,  -- en unité minimale de la devise
    max_amount  BIGINT   NOT NULL,  -- XOF : directement en XOF (pas de centime)
    updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO transaction_limits VALUES
('XOF', 100,     500000,   NOW()),  -- min 100 XOF, max 500 000 XOF
('GNF', 1000,    5000000,  NOW()),  -- min 1 000 GNF, max 5 000 000 GNF
('USD', 100,     50000,    NOW());  -- min 1.00 USD, max 500.00 USD (en centimes)
```

### Le `.env.example` — ce qu'il faut committer à la place

```bash
# .env.example — committé dans le repo
# Remplacer chaque valeur par la vraie valeur dans .env (non committé)

APP_NAME=DymmoApp
APP_ENV=local
APP_KEY=

DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=dymmo
DB_USERNAME=
DB_PASSWORD=

ORANGE_MONEY_API_KEY=
ORANGE_MONEY_MERCHANT_ID=
ORANGE_MONEY_BASE_URL=https://api.orange.com/orange-money-webpay/v1

PISPI_API_KEY=
PISPI_ENV=sandbox
```

---

## Les exemples concrets — Python

```python
# Incorrect — credentials hardcodés dans un script Python
# Classique dans les scripts de migration ou d'automatisation
import psycopg2
import requests

conn = psycopg2.connect(
    host="prod-db.atanax.com",
    database="dymmo",
    user="dymmo_admin",
    password="Dymm0_Pr0d_2024!"  # dans l'historique git pour toujours
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

load_dotenv()  # charge le fichier .env

# Validation au démarrage — avant toute connexion
required_vars = ["DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD", "PISPI_API_KEY"]
missing = [var for var in required_vars if not os.environ.get(var)]
if missing:
    raise EnvironmentError(f"Variables d'environnement manquantes: {', '.join(missing)}")

conn = psycopg2.connect(
    host=os.environ["DB_HOST"],
    database=os.environ["DB_NAME"],
    user=os.environ["DB_USER"],
    password=os.environ["DB_PASSWORD"]
)
```

---

## Les exemples concrets — JavaScript / Node.js

```javascript
// Incorrect — clé Stripe hardcodée dans un fichier JS
// Le pire cas : fichier frontend compilé et envoyé au client
const stripe = require("stripe")("VOTRE_CLE_SECRETE_STRIPE");
// Une clé live Stripe (sk_live_...) hardcodée ici — dans le bundle JS envoyé à tous les navigateurs.

const paymentIntent = await stripe.paymentIntents.create({
  amount: 50000, // Incorrect — montant hardcodé
  currency: "xof",
  payment_method: req.body.paymentMethodId,
  confirm: true,
});
```

```javascript
// Correct — variables d'environnement Node.js
require("dotenv").config();

// Validation au démarrage — avant toute initialisation
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY manquante");
}

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// Le montant vient de la requête ou de la config, jamais hardcodé
const paymentIntent = await stripe.paymentIntents.create({
  amount: req.body.amountCentimes, // BIGINT venant du client validé
  currency: req.body.currency.toLowerCase(),
  payment_method: req.body.paymentMethodId,
  confirm: true,
});
```

**Attention spécifique au frontend :** toute variable d'environnement préfixée `NEXT_PUBLIC_`, `VITE_`, ou `REACT_APP_` dans un projet frontend est **envoyée au navigateur**. Ne jamais mettre de secret dans ces variables.

```bash
# .env.local (Next.js)
STRIPE_SECRET_KEY=sk_live_...        # côté serveur uniquement
NEXT_PUBLIC_STRIPE_PK=pk_live_...    # clé publique — peut être exposée
```

---

## Les exemples concrets — Java

### Le pire cas : credentials en dur

```java
// Incorrect — vu en production. Souvent dans un repo GitHub public.
public class DatabaseConnection {
    private static final String URL      = "jdbc:postgresql://prod-db.atanax.com:5432/dymmo";
    private static final String USERNAME = "dymmo_admin";
    private static final String PASSWORD = "Dymm0_Pr0d_2024!";  // committé sur GitHub

    public Connection getConnection() throws SQLException {
        return DriverManager.getConnection(URL, USERNAME, PASSWORD);
    }
}
```

Ce code a été committé. Il est dans l'historique git. Même si tu supprimes la ligne demain, `git log` le gardera pour toujours. Des bots scannent GitHub en permanence à la recherche de ce pattern.

```java
// Correct — variables d'environnement, validation au démarrage
public class DatabaseConnection {
    private static final String URL;
    private static final String USERNAME;
    private static final String PASSWORD;

    static {
        URL      = System.getenv("DB_URL");
        USERNAME = System.getenv("DB_USERNAME");
        PASSWORD = System.getenv("DB_PASSWORD");

        if (URL == null || USERNAME == null || PASSWORD == null) {
            // IllegalStateException lancée ici — la JVM la wrappe en ExceptionInInitializerError
            throw new IllegalStateException(
                "Variables d'environnement DB manquantes. " +
                "Vérifier DB_URL, DB_USERNAME, DB_PASSWORD."
            );
        }
    }

    public Connection getConnection() throws SQLException {
        return DriverManager.getConnection(URL, USERNAME, PASSWORD);
    }
}
```

### Le cas silencieux : valeurs métier codées en dur

```java
// Incorrect — taux de commission hardcodé
public class PaymentService {

    public long calculateFee(long amountCentimes) {
        // 1.5% de commission
        // Que se passe-t-il quand la BCEAO change les règles ?
        // Que se passe-t-il pour les marchands Premium avec 0.8% ?
        // Que se passe-t-il pour les transactions > 1 000 000 XOF avec 1.2% ?
        return (long) (amountCentimes * 0.015);
    }

    public boolean isTransactionAllowed(long amountCentimes) {
        // Incorrect — seuil codé en dur (va changer, garantie)
        return amountCentimes <= 500000_00L; // 500 000 XOF max
    }
}
```

Quand le directeur commercial appelle pour dire que les marchands Premium ont une commission différente, il faut recompiler, retester, redéployer. Pour changer un chiffre.

```java
// Correct — valeurs métier en configuration
@Service
public class PaymentService {

    @Value("${payment.commission.standard}")  // ex. 150 = 1.5% en basis points
    private int commissionBasisPoints;

    @Value("${payment.transaction.max_amount}")  // en centimes
    private long maxTransactionAmount;

    public long calculateFee(long amountCentimes) {
        // basis points : 100 = 1%, 150 = 1.5%, 80 = 0.8%
        return (amountCentimes * commissionBasisPoints) / 10000;
    }

    public boolean isTransactionAllowed(long amountCentimes) {
        return amountCentimes <= maxTransactionAmount;
    }
}
```

`application.properties` :

```properties
payment.commission.standard=150
payment.transaction.max_amount=50000000
```

Changer la commission = modifier le fichier de config, redémarrer. Pas de recompilation, pas de déploiement de code.

### Le cas de l'URL hardcodée

```java
// Incorrect — URL d'API externe codée en dur
public class PiSpiClient {

    public String getToken() {
        // Que se passe-t-il quand on passe de sandbox à production ?
        String url = "https://api-beta.bceao.int/pi-spi/v1/oauth/token";
        // ... requête HTTP
        return token;
    }
}
```

En sandbox, tout va bien. Le jour du passage en production, il faut chercher toutes les occurrences de l'URL dans le code — et en oublier une, forcément.

```java
// Correct — URL en configuration
@Service
public class PiSpiClient {

    @Value("${pispi.base-url}")
    private String baseUrl;

    public String getToken() {
        String url = baseUrl + "/oauth/token";
        // ... requête HTTP
        return token;
    }
}
```

`application-sandbox.properties` :

```properties
pispi.base-url=https://api-beta.bceao.int/pi-spi/v1
```

`application-production.properties` :

```properties
pispi.base-url=https://api.bceao.int/pi-spi/v1
```

Passer en production = changer le profil Spring. Une ligne.

---

## Les conséquences réelles, par catégorie

### Sécurité — la plus grave

En octobre 2022, Samsung a révélé une fuite de données due à des credentials AWS hardcodés dans du code interne. En décembre 2021, Twitch a subi une fuite de 125 GB de code source — des clés d'API internes étaient hardcodées.

Des bots comme `truffleHog`, `git-secrets`, et `gitleaks` scannent GitHub en continu et trouvent des patterns de clés API en quelques secondes après un push.

```bash
# Ce qu'un bot voit quand tu commites ça :
git log --all -p | grep -E "(api_key|password|secret|token)\s*=\s*['\"][^'\"]{8,}"
# → trouve tout en moins d'une seconde
```

### Maintenance — la plus coûteuse

```java
// Imagine 47 occurrences de cette URL dans le code
String url = "https://api-beta.bceao.int/pi-spi/v1";

// Passage en production : grep + sed sur tout le repo
// Mais grep ne trouve pas les URL dans les strings concaténées :
String url = "https://api-beta.bceao.int" + "/pi-spi/v1";  // passé à travers
String baseUrl = "https://api-beta.bceao.int";  // aussi passé à travers
```

Une recherche `grep` sur une URL ne trouve pas toutes ses occurrences si elle est construite dynamiquement. Tu en oublies une. Tu vas en production. Elle pointe encore sur sandbox.

### Tests — l'invisible

```php
// Incorrect — code impossible à tester unitairement
class FeeCalculator
{
    public function calculate(int $amount): int
    {
        // 1.5% hardcodé — impossible de tester le cas 0.8% sans modifier le code
        return (int) ($amount * 0.015);
    }
}

// Test unitaire : que teste-t-on vraiment ?
// On teste que 0.015 × $amount = résultat. Toujours vrai. Test inutile.
```

```php
// Correct — code testable
class FeeCalculator
{
    public function __construct(
        private readonly int $basisPoints  // injecté
    ) {}

    public function calculate(int $amount): int
    {
        return (int) ($amount * $this->basisPoints / 10000);
    }
}

// Test unitaire utile
it('calcule la commission standard à 1.5%', function () {
    $calculator = new FeeCalculator(150);  // 150 basis points = 1.5%
    expect($calculator->calculate(100000))->toBe(1500);
});

it('calcule la commission premium à 0.8%', function () {
    $calculator = new FeeCalculator(80);
    expect($calculator->calculate(100000))->toBe(800);
});
```

### Multi-environnement — l'inévitable

Tout projet sérieux a au minimum trois environnements : développement, staging, production. Avec des valeurs hardcodées, tu as trois versions du même fichier, chacune différente, chacune à synchroniser manuellement.

```
Développeur A committe avec DB_HOST=localhost
Développeur B tire le code → son app pointe sur localhost de A
CI/CD tourne → pointe sur localhost qui n'existe pas
Production → toujours sur sandbox si quelqu'un a oublié de changer
```

---

## Ce que cet article ne couvre pas

- **La gestion des secrets en production** — HashiCorp Vault, AWS Secrets Manager, Azure Key Vault — les systèmes de gestion de secrets à grande échelle
- **La rotation des clés** — comment changer une clé API compromisée sans downtime
- **Les secrets dans les images Docker** — comment éviter de builder des secrets dans une image
- **L'audit d'un repo existant** — comment scanner l'historique git pour détecter des secrets déjà commités (gitleaks, trufflehog)
- **La configuration du `.gitignore`** — les patterns à inclure selon la stack pour ne jamais committer de secrets
- **Les feature flags** — une extension naturelle de la configuration dynamique pour contrôler les comportements sans redéploiement

---

## Pour aller plus loin

- [OWASP — Hardcoded Credentials](https://owasp.org/www-community/vulnerabilities/Use_of_hard-coded_credentials)
- [The Twelve-Factor App — III. Config](https://12factor.net/config)
- [gitleaks — détection de secrets dans git](https://github.com/gitleaks/gitleaks)
- [Laravel — Configuration & Environment](https://laravel.com/docs/configuration)
- [Spring Boot — Externalized Configuration](https://docs.spring.io/spring-boot/docs/current/reference/html/features.html#features.external-config)

---

_Écrit par [Abdourahamane Diallo](https://github.com/DialloDBA) — ATANAX Inc._
