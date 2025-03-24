# LogoToAnything

To run the LogoToAnything application, first install the npm dependencies:

```bash
npm install
```

Next, run the development server:

```bash
npm run dev
```

Finally, open [http://localhost:3000](http://localhost:3000) in your browser to view the website.

## Supabase setup

Create a supabase project and create the tables by runnning the SQL script:
```
CREATE TABLE public.app_settings (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  key text NOT NULL,
  value jsonb NOT NULL,
  description text NULL,
  CONSTRAINT app_settings_pkey PRIMARY KEY (id),
  CONSTRAINT app_settings_key_key UNIQUE (key)
) TABLESPACE pg_default;

CREATE TABLE public.credit_transactions (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  user_id uuid NOT NULL,
  amount integer NOT NULL,
  transaction_type public.credit_transaction_type NOT NULL,
  description text NULL,
  generation_id uuid NULL,
  payment_id uuid NULL,
  expires_at timestamp with time zone NULL,
  CONSTRAINT credit_transactions_pkey PRIMARY KEY (id),
  CONSTRAINT credit_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
) TABLESPACE pg_default;

CREATE TABLE public.generation_feedback (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  user_id uuid NOT NULL,
  generation_id uuid NOT NULL,
  rating integer NULL,
  comment text NULL,
  metadata jsonb NULL,
  CONSTRAINT generation_feedback_pkey PRIMARY KEY (id),
  CONSTRAINT generation_feedback_generation_id_fkey FOREIGN KEY (generation_id) REFERENCES generations(id) ON DELETE CASCADE,
  CONSTRAINT generation_feedback_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT generation_feedback_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
) TABLESPACE pg_default;

CREATE TABLE public.generations (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  user_id uuid NOT NULL,
  logo_url text NOT NULL,
  result_url text NOT NULL,
  prompt text NOT NULL,
  status public.generation_status NOT NULL DEFAULT 'pending'::generation_status,
  credit_cost integer NOT NULL DEFAULT 1,
  processing_duration_ms integer NULL,
  width integer NULL,
  height integer NULL,
  metadata jsonb NULL,
  logo_file_name text NULL,
  subject_file_name text NULL,
  result_file_name text NULL,
  ip_address text NULL,
  user_agent text NULL,
  logo_description text NULL,
  destination_prompt text NULL,
  CONSTRAINT generations_pkey PRIMARY KEY (id),
  CONSTRAINT generations_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
) TABLESPACE pg_default;

CREATE TABLE public.payments (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  user_id uuid NOT NULL,
  amount numeric(10,2) NOT NULL,
  currency text NOT NULL DEFAULT 'USD'::text,
  status public.payment_status NOT NULL DEFAULT 'pending'::payment_status,
  description text NULL,
  payment_method text NULL,
  stripe_payment_intent_id text NULL,
  stripe_payment_method_id text NULL,
  credits_purchased integer NULL,
  subscription_id uuid NULL,
  CONSTRAINT payments_pkey PRIMARY KEY (id),
  CONSTRAINT payments_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES subscriptions(id),
  CONSTRAINT payments_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
) TABLESPACE pg_default;

CREATE TABLE public.profiles (
  id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  full_name text NULL,
  email public.citext NULL,
  avatar_url text NULL,
  remaining_credits integer NOT NULL DEFAULT 5,
  total_generations integer NOT NULL DEFAULT 0,
  stripe_customer_id text NULL,
  last_login timestamp with time zone NULL,
  subscription_status text NULL DEFAULT 'inactive'::text,
  subscription_plan text NULL,
  subscription_period_start timestamp with time zone NULL,
  subscription_period_end timestamp with time zone NULL,
  credits_remaining integer NULL DEFAULT 0,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id ON public.profiles USING btree (stripe_customer_id) TABLESPACE pg_default;

CREATE TABLE public.subscription_plans (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  name text NOT NULL,
  description text NULL,
  price_monthly numeric(10,2) NOT NULL,
  price_yearly numeric(10,2) NOT NULL,
  credits_per_month integer NOT NULL,
  stripe_price_id_monthly text NULL,
  stripe_price_id_yearly text NULL,
  features jsonb NULL,
  CONSTRAINT subscription_plans_pkey PRIMARY KEY (id)
) TABLESPACE pg_default;

CREATE TABLE public.subscriptions (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  user_id uuid NOT NULL,
  plan_id uuid NOT NULL,
  status public.subscription_status NOT NULL DEFAULT 'active'::subscription_status,
  subscription_period_start timestamp with time zone NOT NULL,
  subscription_period_end timestamp with time zone NOT NULL,
  stripe_subscription_id text NULL,
  is_annual boolean NOT NULL DEFAULT false,
  canceled_at timestamp with time zone NULL,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  CONSTRAINT subscriptions_pkey PRIMARY KEY (id),
  CONSTRAINT subscriptions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES subscription_plans(id),
  CONSTRAINT subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
) TABLESPACE pg_default;
```

## Authentication Setup

This application uses NextAuth.js for authentication. To enable Google Sign-in, you need to:

1. Create OAuth credentials in the [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Add the following to your `.env.local` file:

```
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
NEXTAUTH_SECRET="a-random-string-for-encryption"
NEXTAUTH_URL="http://localhost:3000"
```

For authorized redirect URIs in Google Cloud Console, add:
- http://localhost:3000/api/callback/google

GitHub authentication is also configured but currently disabled.
