# Stripe — Mise en route

Squelette d'intégration Stripe Checkout + webhook. Tant que les variables d'env
ne sont pas remplies, les boutons "Choisir" et "Acheter" renvoient une 503
explicite (rien ne casse, mais aucun paiement ne passe).

## 1) Créer le compte Stripe + produits

Dashboard Stripe → **Products** → créer 4 produits :

### Abonnements (Recurring)

| Produit | Prix mensuel | Prix annuel |
|---------|--------------|-------------|
| BrandSheet Solo | 9,99 €/mois | 83,88 €/an (≈ 6,99 €/mois) |
| BrandSheet Studio | 19,99 €/mois | 167,88 €/an (≈ 13,99 €/mois) |
| BrandSheet Agency | 49,99 €/mois | 419,88 €/an (≈ 34,99 €/mois) |

Chaque abonnement → **2 prix** (mensuel + annuel).

### Packs de crédits (One-time)

8 packs, prix par crédit calibré pour rester plus cher que les abonnements (l'abo doit toujours être l'option la moins chère au crédit).

| Produit | Prix one-shot | Crédits | crédits/€ |
|---------|---------------|---------|-----------|
| Pack 10 €  | 9,99 €  | 100  | 10,0 |
| Pack 20 €  | 19,99 € | 215  | 10,8 |
| Pack 30 €  | 29,99 € | 335  | 11,2 |
| Pack 40 €  | 39,99 € | 465  | 11,6 |
| Pack 50 €  | 49,99 € | 600  | 12,0 |
| Pack 60 €  | 59,99 € | 740  | 12,3 |
| Pack 80 €  | 79,99 € | 1020 | 12,8 |
| Pack 100 € | 99,99 € | 1300 | 13,0 |

Référence : plan Solo = 150c / 9,99 € = 15 c/€. Tous les packs sont en-dessous (au pire 87% de la valeur du plan Solo au crédit).

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

# Price IDs — packs de crédits one-shot (8 packs)
STRIPE_PRICE_PACK_P10=price_...   # Pack 10€  → 100 crédits
STRIPE_PRICE_PACK_P20=price_...   # Pack 20€  → 215 crédits
STRIPE_PRICE_PACK_P30=price_...   # Pack 30€  → 335 crédits
STRIPE_PRICE_PACK_P40=price_...   # Pack 40€  → 465 crédits
STRIPE_PRICE_PACK_P50=price_...   # Pack 50€  → 600 crédits
STRIPE_PRICE_PACK_P60=price_...   # Pack 60€  → 740 crédits
STRIPE_PRICE_PACK_P80=price_...   # Pack 80€  → 1020 crédits
STRIPE_PRICE_PACK_P100=price_...  # Pack 100€ → 1300 crédits

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
