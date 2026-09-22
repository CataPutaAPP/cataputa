-- =====================================================================
-- CATAPUTA — M3_A: COBRANÇA DAS ASSINATURAS E DO IMPULSO (modelo Fatal Model)
-- Rodar depois da M1, M2 e CHAT. Não altera tabelas usadas pelo app. Idempotente.
--
-- O ÚNICO dinheiro que passa pelo app: assinatura dos planos + impulso avulso.
-- Atendimento continua pago direto entre as partes, fora do app.
--
--   • Planos mensais PRÉ-PAGOS: pagou → 30 dias; renovar soma +30 dias
--   • Impulso do prestador: 24h de destaque (R$ 9,90, editável)
--   • Pagamento: Pix ou cartão. Estorno de cartão → conta fica só com Pix
--   • Gateway-agnóstico: o gateway só confirma; a ativação é daqui (apply_payment)
--   • Sai o "chamado avulso" e o "Chamado Turbo" (não existem na Fatal Model)
-- =====================================================================

SET lock_timeout = '10s';

DO $$
DECLARE n text; taken text := '';
BEGIN
  IF to_regclass('public.chat_messages') IS NULL THEN RAISE EXCEPTION 'Rode CHAT_A antes da M3'; END IF;
  FOREACH n IN ARRAY ARRAY['billing_products','payment_orders','billing_customers','provider_boosts'] LOOP
    IF EXISTS (SELECT 1 FROM pg_type WHERE typnamespace = 'public'::regnamespace AND typname = n)
       AND to_regclass('public.' || n) IS NULL THEN taken := taken || n || ' '; END IF;
  END LOOP;
  IF taken <> '' THEN RAISE EXCEPTION 'Nomes já usados por outro tipo: %', taken; END IF;
END $$;


-- ─────────────────────────────────────────────────────────────────────
-- 1. PRODUTOS AVULSOS (hoje só o impulso)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.billing_products (
  code           text PRIMARY KEY,
  audience       text NOT NULL CHECK (audience IN ('cliente','prestador','parceiro')),
  name           text NOT NULL,
  description    text,
  price          numeric(10,2) NOT NULL CHECK (price > 0),
  duration_hours int NOT NULL CHECK (duration_hours > 0),
  is_active      boolean NOT NULL DEFAULT true
);
INSERT INTO public.billing_products (code, audience, name, description, price, duration_hours) VALUES
  ('impulso_24h', 'prestador', 'Impulso 24h', 'Seu perfil em destaque nas propostas por 24 horas', 9.90, 24)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.platform_settings (key, value, description) VALUES
  ('plan_period_days',     30, 'Dias de acesso por pagamento de plano (pré-pago)'),
  ('order_expiry_minutes', 30, 'Minutos para pagar um pedido Pix antes de expirar')
ON CONFLICT (key) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────
-- 2. PEDIDOS, CLIENTE DE COBRANÇA, IMPULSOS
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payment_orders (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  item_type       text NOT NULL CHECK (item_type IN ('plano','impulso')),
  plan_id         uuid REFERENCES public.plans(id),
  product_code    text REFERENCES public.billing_products(code),
  item_name       text NOT NULL,
  list_price      numeric(10,2) NOT NULL,
  discount_pct    numeric(5,2) NOT NULL DEFAULT 0,
  amount          numeric(10,2) NOT NULL CHECK (amount > 0),
  campaign_id     uuid REFERENCES public.campaigns(id),
  method          text NOT NULL CHECK (method IN ('pix','cartao')),
  provider        text,                     -- 'teste', ou o gateway escolhido
  provider_ref    text,                     -- id da cobrança no gateway
  pix_copy_paste  text,
  pix_qr_base64   text,
  checkout_url    text,                     -- cartão: página segura do gateway
  status          text NOT NULL DEFAULT 'pendente'
                  CHECK (status IN ('pendente','pago','expirado','cancelado','estornado')),
  expires_at      timestamptz NOT NULL,
  paid_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CHECK ((item_type = 'plano' AND plan_id IS NOT NULL) OR (item_type = 'impulso' AND product_code IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS ix_orders_user ON public.payment_orders(user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS ux_orders_provider_ref ON public.payment_orders(provider, provider_ref) WHERE provider_ref IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.billing_customers (
  user_id              uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider_customer_id text,
  card_blocked         boolean NOT NULL DEFAULT false,   -- regra Fatal Model: estornou → só Pix
  card_blocked_at      timestamptz,
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.provider_boosts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  order_id   uuid REFERENCES public.payment_orders(id),
  starts_at  timestamptz NOT NULL,
  ends_at    timestamptz NOT NULL,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_boosts_user ON public.provider_boosts(user_id, ends_at DESC);


-- ─────────────────────────────────────────────────────────────────────
-- 3. FIM DO CHAMADO AVULSO: mensagem do limite aponta só para o Pass
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_limit_chamados()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_max numeric; v_cnt int;
BEGIN
  IF COALESCE(public.get_setting('billing_enabled'), 0) <> 1 THEN RETURN NEW; END IF;
  v_max := public.get_entitlement(NEW.client_id, 'chamados_per_month');
  IF v_max IS NULL OR v_max < 0 THEN RETURN NEW; END IF;
  SELECT count(*) INTO v_cnt FROM public.service_requests
   WHERE client_id = NEW.client_id AND created_at >= date_trunc('month', now());
  IF v_cnt < v_max THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'Você usou seu chamado grátis do mês. Assine o CataPuta Pass para chamados ilimitados.';
END $$;

UPDATE public.feature_catalog SET description = '-1 = ilimitado' WHERE feature = 'chamados_per_month';


-- ─────────────────────────────────────────────────────────────────────
-- 4. DESTAQUE (impulso ativo OU plano com destaque)
-- ─────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.boost_until(uuid);
CREATE FUNCTION public.boost_until(p_user_id uuid)
RETURNS timestamptz LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT max(ends_at) FROM public.provider_boosts
  WHERE user_id = p_user_id AND is_active AND ends_at > now();
$$;

DROP FUNCTION IF EXISTS public.highlighted_providers(uuid[]);
CREATE FUNCTION public.highlighted_providers(p_ids uuid[])
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM unnest(p_ids) AS id
  WHERE public.boost_until(id) IS NOT NULL
     OR COALESCE(public.get_entitlement(id, 'highlight_provider'), 0) = 1;
$$;

-- Mapa de quartos: parceiro com plano Destaque aparece primeiro
DROP FUNCTION IF EXISTS public.nearby_partner_rooms(double precision, double precision, double precision);
CREATE FUNCTION public.nearby_partner_rooms(
  p_lat double precision, p_lng double precision, p_radius_km double precision DEFAULT 10
)
RETURNS TABLE (
  room_id uuid, partner_id uuid, partner_name text, local_type text, local_address text,
  partner_lat double precision, partner_lng double precision,
  room_name text, room_description text, photo_url text,
  price numeric, duration_minutes int, distance_km double precision, available boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT room_id, partner_id, partner_name, local_type, local_address, partner_lat, partner_lng,
         room_name, room_description, photo_url, price, duration_minutes, distance_km, available
  FROM (
    SELECT
      r.id AS room_id, r.partner_id, pr.full_name::text AS partner_name, pr.local_type::text AS local_type,
      pr.local_address::text AS local_address, pr.lat::double precision AS partner_lat, pr.lng::double precision AS partner_lng,
      r.name AS room_name, r.description AS room_description, r.photo_url, r.price, r.duration_minutes,
      (6371 * acos(least(1, greatest(-1,
          cos(radians(p_lat)) * cos(radians(pr.lat::double precision))
        * cos(radians(pr.lng::double precision) - radians(p_lng))
        + sin(radians(p_lat)) * sin(radians(pr.lat::double precision))
      ))))::double precision AS distance_km,
      NOT EXISTS (
        SELECT 1 FROM public.room_bookings b
        WHERE b.room_id = r.id
          AND (b.status IN ('confirmada','em_uso')
               OR (b.status = 'pendente'
                   AND b.created_at > now() - make_interval(mins => public.get_setting('booking_hold_minutes')::int)))
      ) AS available,
      COALESCE(public.get_entitlement(r.partner_id, 'highlight_partner'), 0) = 1 AS highlight
    FROM public.partner_rooms r
    JOIN public.profiles pr ON pr.id = r.partner_id
    WHERE r.is_active AND pr.lat IS NOT NULL AND pr.lng IS NOT NULL
      AND public.is_user_cleared(r.partner_id)
  ) x
  WHERE x.distance_km <= p_radius_km
  ORDER BY x.available DESC, x.highlight DESC, x.distance_km, x.price;
$$;


-- ─────────────────────────────────────────────────────────────────────
-- 5. CRIAR PEDIDO (o app chama; o gateway gera o Pix/cartão depois)
-- ─────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.create_order(text, text, text, text);
CREATE FUNCTION public.create_order(p_item_type text, p_code text, p_method text, p_coupon text DEFAULT NULL)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid(); v_aud text := public.user_audience(auth.uid());
  v_plan public.plans%ROWTYPE; v_prod public.billing_products%ROWTYPE; c public.campaigns%ROWTYPE;
  v_name text; v_price numeric; v_disc numeric := 0; v_camp uuid; v_id uuid; v_amount numeric;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Faça login'; END IF;
  IF NOT public.is_user_cleared(v_uid) THEN RAISE EXCEPTION 'Conclua a verificação da conta antes de assinar.'; END IF;
  IF COALESCE(public.get_setting('billing_enabled'), 0) <> 1 AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'As assinaturas ainda não estão disponíveis.';
  END IF;
  IF p_method NOT IN ('pix','cartao') THEN RAISE EXCEPTION 'Forma de pagamento inválida'; END IF;
  IF p_method = 'cartao' AND EXISTS (SELECT 1 FROM public.billing_customers WHERE user_id = v_uid AND card_blocked) THEN
    RAISE EXCEPTION 'Pagamento por cartão indisponível para sua conta. Use Pix.';
  END IF;

  IF p_item_type = 'plano' THEN
    SELECT * INTO v_plan FROM public.plans WHERE code = p_code AND is_active;
    IF NOT FOUND OR v_plan.audience <> v_aud OR v_plan.price_month <= 0 THEN RAISE EXCEPTION 'Plano indisponível'; END IF;
    v_name := 'Plano ' || v_plan.name || ' — 30 dias'; v_price := v_plan.price_month;
  ELSIF p_item_type = 'impulso' THEN
    SELECT * INTO v_prod FROM public.billing_products WHERE code = p_code AND is_active;
    IF NOT FOUND OR v_prod.audience <> v_aud THEN RAISE EXCEPTION 'Produto indisponível'; END IF;
    v_name := v_prod.name; v_price := v_prod.price;
  ELSE
    RAISE EXCEPTION 'Item inválido';
  END IF;

  -- Cupom de desconto (campanhas da M1)
  IF NULLIF(btrim(p_coupon), '') IS NOT NULL THEN
    SELECT * INTO c FROM public.campaigns WHERE upper(code) = upper(btrim(p_coupon)) AND type = 'cupom_desconto';
    IF NOT FOUND OR NOT c.is_active OR c.starts_at > now() OR (c.ends_at IS NOT NULL AND c.ends_at < now()) THEN
      RAISE EXCEPTION 'Cupom inválido ou expirado';
    END IF;
    IF c.audience IS NOT NULL AND c.audience <> v_aud THEN RAISE EXCEPTION 'Cupom não vale para sua conta'; END IF;
    IF c.plan_id IS NOT NULL AND (p_item_type <> 'plano' OR c.plan_id <> v_plan.id) THEN RAISE EXCEPTION 'Cupom não vale para este item'; END IF;
    IF EXISTS (SELECT 1 FROM public.campaign_redemptions WHERE campaign_id = c.id AND user_id = v_uid) THEN
      RAISE EXCEPTION 'Você já usou este cupom';
    END IF;
    IF c.max_redemptions IS NOT NULL
       AND (SELECT count(*) FROM public.campaign_redemptions WHERE campaign_id = c.id) >= c.max_redemptions THEN
      RAISE EXCEPTION 'Cupom esgotado';
    END IF;
    v_disc := COALESCE(c.discount_pct, 0); v_camp := c.id;
  END IF;

  v_amount := round(v_price * (1 - v_disc / 100), 2);
  IF v_amount < 1 THEN v_amount := 1; END IF;

  -- um pedido pendente por item: o anterior é cancelado
  UPDATE public.payment_orders SET status = 'cancelado'
   WHERE user_id = v_uid AND status = 'pendente'
     AND item_type = p_item_type AND COALESCE(plan_id::text, product_code) = COALESCE(v_plan.id::text, v_prod.code);

  INSERT INTO public.payment_orders
    (user_id, item_type, plan_id, product_code, item_name, list_price, discount_pct, amount, campaign_id, method, expires_at)
  VALUES
    (v_uid, p_item_type, v_plan.id, v_prod.code, v_name, v_price, v_disc, v_amount, v_camp, p_method,
     now() + make_interval(mins => COALESCE(public.get_setting('order_expiry_minutes'), 30)::int))
  RETURNING id INTO v_id;

  RETURN json_build_object('order_id', v_id, 'amount', v_amount, 'item_name', v_name, 'discount_pct', v_disc);
END $$;


-- ─────────────────────────────────────────────────────────────────────
-- 6. APLICAR PAGAMENTO (só servidor/webhook ou admin em teste). Idempotente.
-- ─────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.apply_payment(uuid, text);
CREATE FUNCTION public.apply_payment(p_order_id uuid, p_provider_ref text DEFAULT NULL)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.payment_orders%ROWTYPE; v_cur public.subscriptions%ROWTYPE;
        v_days int := COALESCE(public.get_setting('plan_period_days'), 30)::int; v_start timestamptz; v_hours int;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' AND NOT public.is_admin() THEN RAISE EXCEPTION 'Sem permissão'; END IF;

  SELECT * INTO o FROM public.payment_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  IF o.status = 'pago' THEN RETURN json_build_object('ok', true, 'already', true); END IF;
  -- Dinheiro entrou = vale. Inclusive Pix pago depois de "expirar" ou de um pedido
  -- substituído por outro (senão a pessoa pagaria e não receberia). Só estorno bloqueia.
  IF o.status NOT IN ('pendente','expirado','cancelado') THEN RAISE EXCEPTION 'Pedido está %', o.status; END IF;

  UPDATE public.payment_orders SET status = 'pago', paid_at = now(),
         provider_ref = COALESCE(p_provider_ref, provider_ref) WHERE id = o.id;

  IF o.item_type = 'plano' THEN
    SELECT * INTO v_cur FROM public.subscriptions WHERE user_id = o.user_id AND status = 'ativa' LIMIT 1 FOR UPDATE;
    IF FOUND AND v_cur.plan_id = o.plan_id AND v_cur.source = 'gateway' THEN
      -- renovação do mesmo plano: soma 30 dias ao que falta
      UPDATE public.subscriptions
         SET expires_at = GREATEST(COALESCE(expires_at, now()), now()) + make_interval(days => v_days)
       WHERE id = v_cur.id;
    ELSE
      -- plano novo (ou troca de plano): começa agora
      IF FOUND THEN UPDATE public.subscriptions SET status = 'expirada' WHERE id = v_cur.id; END IF;
      INSERT INTO public.subscriptions (user_id, plan_id, status, source, gateway_ref, started_at, expires_at)
      VALUES (o.user_id, o.plan_id, 'ativa', 'gateway', o.id::text, now(), now() + make_interval(days => v_days));
    END IF;
  ELSE
    SELECT duration_hours INTO v_hours FROM public.billing_products WHERE code = o.product_code;
    v_start := GREATEST(now(), COALESCE(public.boost_until(o.user_id), now()));   -- impulsos em sequência somam
    INSERT INTO public.provider_boosts (user_id, order_id, starts_at, ends_at)
    VALUES (o.user_id, o.id, v_start, v_start + make_interval(hours => v_hours));
  END IF;

  IF o.campaign_id IS NOT NULL THEN
    INSERT INTO public.campaign_redemptions (campaign_id, user_id) VALUES (o.campaign_id, o.user_id)
    ON CONFLICT (campaign_id, user_id) DO NOTHING;
  END IF;
  RETURN json_build_object('ok', true);
END $$;

-- Estorno de cartão (regra Fatal Model): cancela o que foi comprado e deixa a conta só com Pix
DROP FUNCTION IF EXISTS public.register_chargeback(uuid);
CREATE FUNCTION public.register_chargeback(p_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.payment_orders%ROWTYPE;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' AND NOT public.is_admin() THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  SELECT * INTO o FROM public.payment_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND OR o.status <> 'pago' THEN RETURN; END IF;
  UPDATE public.payment_orders SET status = 'estornado' WHERE id = o.id;
  UPDATE public.subscriptions SET status = 'cancelada' WHERE gateway_ref = o.id::text AND status = 'ativa';
  UPDATE public.provider_boosts SET is_active = false WHERE order_id = o.id;
  IF o.method = 'cartao' THEN
    INSERT INTO public.billing_customers (user_id, card_blocked, card_blocked_at) VALUES (o.user_id, true, now())
    ON CONFLICT (user_id) DO UPDATE SET card_blocked = true, card_blocked_at = now(), updated_at = now();
  END IF;
END $$;

-- Pedidos Pix vencidos (chamado pela limpeza diária e ao abrir o app)
DROP FUNCTION IF EXISTS public.expire_orders();
CREATE FUNCTION public.expire_orders()
RETURNS int LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH u AS (UPDATE public.payment_orders SET status = 'expirado'
             WHERE status = 'pendente' AND expires_at < now() RETURNING 1)
  SELECT count(*)::int FROM u;
$$;


-- ─────────────────────────────────────────────────────────────────────
-- 7. my_plan() com dados de cobrança (validade, cartão, impulso, admin)
-- ─────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.my_plan();
CREATE FUNCTION public.my_plan()
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_plan public.plans%ROWTYPE; v_sub public.subscriptions%ROWTYPE;
BEGIN
  SELECT * INTO v_plan FROM public.plans WHERE id = public.current_plan_id(auth.uid());
  SELECT * INTO v_sub FROM public.subscriptions
   WHERE user_id = auth.uid() AND status = 'ativa' AND (expires_at IS NULL OR expires_at > now()) LIMIT 1;
  RETURN json_build_object(
    'plan_code',       v_plan.code,
    'plan_name',       v_plan.name,
    'is_beta',         v_sub.id IS NULL AND COALESCE(public.get_setting('beta_all_features'),0) = 1,
    'billing_enabled', COALESCE(public.get_setting('billing_enabled'),0) = 1,
    'can_buy',         COALESCE(public.get_setting('billing_enabled'),0) = 1 OR public.is_admin(),
    'is_admin',        public.is_admin(),
    'source',          v_sub.source,
    'expires_at',      v_sub.expires_at,
    'card_blocked',    COALESCE((SELECT card_blocked FROM public.billing_customers WHERE user_id = auth.uid()), false),
    'boost_until',     public.boost_until(auth.uid()),
    'features',        COALESCE((SELECT json_object_agg(feature, value) FROM public.plan_features WHERE plan_id = v_plan.id), '{}'::json),
    'credits',         json_build_object('chamado', 0, 'turbo', 0, 'impulso', 0)
  );
END $$;


-- ─────────────────────────────────────────────────────────────────────
-- 8. RLS + REALTIME + AGENDAMENTO
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.billing_products  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_orders    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_boosts   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS products_read  ON public.billing_products;
DROP POLICY IF EXISTS products_admin ON public.billing_products;
CREATE POLICY products_read  ON public.billing_products FOR SELECT TO authenticated USING (true);
CREATE POLICY products_admin ON public.billing_products FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['payment_orders','billing_customers','provider_boosts'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_own', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_admin', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (user_id = auth.uid())', t || '_own', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())', t || '_admin', t);
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime'
                 AND schemaname = 'public' AND tablename = 'payment_orders') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_orders;
  END IF;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'cataputa-expire-orders';
  PERFORM cron.schedule('cataputa-expire-orders', '*/10 * * * *', 'SELECT public.expire_orders()');
EXCEPTION WHEN others THEN
  RAISE NOTICE 'pg_cron indisponível (%). Pedidos vencidos serão expirados só ao criar novos.', SQLERRM;
END $$;


-- ─────────────────────────────────────────────────────────────────────
-- 9. TEXTOS DO "?"
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO public.help_content (screen, title, body, sort_order) VALUES
  ('cliente', 'Planos', 'O plano grátis inclui 1 chamado por mês. O CataPuta Pass libera chamados ilimitados, conversa antes de aceitar, radar e modo discreto. Os planos são pré-pagos por 30 dias, via Pix ou cartão — sem renovação automática.', 6),
  ('prestador', 'Planos e impulso', 'Grátis: 3 propostas por dia e 3 fotos. Pro: propostas ilimitadas e 10 fotos. Top: destaque e vídeo. O Impulso deixa seu perfil em destaque por 24h. Pagamento via Pix ou cartão, pré-pago.', 6),
  ('parceiro', 'Planos', 'Básico: até 3 quartos no mapa. Destaque: quartos ilimitados e topo da lista. Plano pré-pago por 30 dias, via Pix ou cartão.', 4)
ON CONFLICT (screen, title) DO UPDATE SET body = EXCLUDED.body, sort_order = EXCLUDED.sort_order, updated_at = now();

-- Conferência
SELECT 'produto' AS item, code || ' = R$ ' || price AS valor FROM public.billing_products
UNION ALL SELECT 'funcoes', count(*)::text FROM pg_proc WHERE pronamespace = 'public'::regnamespace
  AND proname IN ('create_order','apply_payment','register_chargeback','expire_orders','boost_until','highlighted_providers','my_plan');
