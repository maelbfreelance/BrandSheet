# Stripe — Mise en route

Squelette d'intégration Stripe Checkout + webhook. Tant que les variables d'env
ne sont pas remplies, les boutons "Choisir" et "Acheter" renvoient une 503
explicite (rien ne casse, mais aucun paiement ne passe).

## 1) Créer le compte Stripe + produits

Dashboard Stripe → **Products** → créer 4 produits :

| Produit | Prix mensuel | Prix annuel | Type |
|---------|--------------|-------------|------|
| BrandSheet Solo | 9,99 €/mois | 83,88 €/an (≈ 6,99 €/mois) | Recurring |
| BrandSheet Studio | 19,99 €/mois | 167,88 €/an (≈ 13,99 €/mois) | Recurring |
| BrandSheet Agency | 49,99 €/mois | 419,88 €/an (≈ 34,99 €/mois) | Recurring |
| Pack crédits Starter | 9 € (one-shot) | — | One-time |
| Pack crédits Pro | 19 € (one-shot) | — | One-time |
| Pack crédits Studio | 39 € (one-shot) | — | One-time |

Chaque abonnement → **2 prix** (mensuel + annuel). Chaque pack → **1 prix** unique.

Note le **price ID** de chaque prix (commence par `price_…`).

## 2) Variables d'environnement

À ajouter dans `.env.local` (dev) et chez l'hébergeur (prod) :

```bash
# Côté serveur uniquement
STRIPE_SECRET_KEY=sk_test_...           # ou sk_live_... en prod
STRIPE_WEBHOOK_SECRET=whsec_...         # signing secret du webhook (voir §4)

# Price IDs — abonnements
STRIPE_PRICE_SOLO_MONTHLY=price_...
STRIPE_PRICE_SOLO_ANNUAL=price_...
STRIPE_PRICE_STUDIO_MONTHLY=price_...
STRIPE_PRICE_STUDIO_ANNUAL=price_...
STRIPE_PRICE_AGENCY_MONTHLY=price_...
STRIPE_PRICE_AGENCY_ANNUAL=price_...

# Price IDs — packs de crédits one-shot
STRIPE_PRICE_PACK_STARTER=price_...
STRIPE_PRICE_PACK_PRO=price_...
STRIPE_PRICE_PACK_STUDIO=price_...

# Optionnel — URL publique pour les success_url / cancel_url
NEXT_PUBLIC_SITE_URL=https://brandsheet.fr
```

## 3) Routes branchées

- `POST /api/stripe/checkout` — abonnement Solo/Studio/Agency (mode `subscription`)
- `POST /api/stripe/credits-checkout` — pack de crédits one-shot (mode `payment`)
- `POST /api/stripe/portal` — portail de facturation Stripe (gestion abo, factures, CB)
- `POST /api/stripe/webhook` — webhook Stripe pour appliquer les paiements

Le webhook gère :
- `checkout.session.completed` (kind=subscription) → met à jour `profiles.plan`
- `checkout.session.completed` (kind=credits) → ajoute les crédits via `addCredits`
- `customer.subscription.updated` → met à jour `profiles.plan` au changement de plan
- `customer.subscription.deleted` → retombe sur Starter à la fin de l'abo

## 4) Configurer le webhook Stripe

Dashboard Stripe → **Developers → Webhooks → Add endpoint** :

- URL : `https://brandsheet.fr/api/stripe/webhook` (prod)
- Événements à écouter :
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`

Copie le **Signing secret** (`whsec_...`) dans `STRIPE_WEBHOOK_SECRET`.

### En local

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Stripe CLI affichera un `whsec_...` à mettre dans `.env.local`.

## 5) Tester

1. Lance `npm run dev`.
2. Va sur `/pricing`, choisis un plan payant, complète Checkout avec la carte test `4242 4242 4242 4242`.
3. Le webhook doit appliquer le plan sur `profiles.plan`. Vérifier dans Supabase.
4. Va sur `/dashboard/credits`, achète un pack, vérifier que `user_credits.credits` augmente.

## 6) TODOs restants côté code

- Stocker `stripe_customer_id` sur `profiles` à la 1ère souscription pour
  éviter le lookup par email dans `/api/stripe/portal`.
- Ajouter un bouton "Gérer mon abonnement" sur le dashboard qui appelle
  `/api/stripe/portal`.
- Gérer le `subscribed=` query param sur `/dashboard` pour afficher un toast
  "Bienvenue dans le plan X" après le retour de Checkout.
