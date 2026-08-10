-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- VENDORS TABLE
CREATE TABLE vendors (
    -- Link id directly to Supabase Auth user id
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    business_name TEXT NOT NULL,
    owner_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    address TEXT,
    category TEXT,
    trust_score NUMERIC(5,2) DEFAULT 0,
    verified BOOLEAN DEFAULT FALSE,
    active BOOLEAN DEFAULT TRUE,
    qr_code TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_checklist_at TIMESTAMPTZ,
    last_image_at TIMESTAMPTZ,
    renewal_deadline DATE,
    renewal_warned BOOLEAN DEFAULT FALSE,
    total_scans INT DEFAULT 0,
    staff_pin TEXT
);

-- CHECKLIST ANSWERS TABLE
CREATE TABLE checklist_answers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    question TEXT NOT NULL,
    answer BOOLEAN NOT NULL,
    submitted_at TIMESTAMPTZ DEFAULT NOW()
);

-- PROOF IMAGES TABLE
CREATE TABLE proof_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
    image_type TEXT NOT NULL,
    image_url TEXT NOT NULL,
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    is_current BOOLEAN DEFAULT TRUE,
    vendor_score INT DEFAULT 5,
    admin_score INT DEFAULT 0,
    status TEXT DEFAULT 'pending'
);

-- SUBSCRIPTION PLANS TABLE
CREATE TABLE subscription_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    price NUMERIC(10,2) NOT NULL,
    description_1 TEXT,
    description_2 TEXT,
    description_3 TEXT,
    active BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- CUSTOMERS TABLE
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);



-- VISITS TABLE
CREATE TABLE visits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
    visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
    earned_star BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(customer_id, vendor_id, visit_date)
);

-- LOYALTY PROGRESS TABLE
CREATE TABLE loyalty_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
    stars INT DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(customer_id, vendor_id)
);

-- REWARD TIERS TABLE (Admin-set globally)
CREATE TABLE reward_tiers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    required_stars INT NOT NULL,
    reward_name TEXT NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- REDEMPTIONS TABLE
CREATE TABLE redemptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
    reward_tier_id UUID REFERENCES reward_tiers(id) ON DELETE CASCADE,
    redeemed_at TIMESTAMPTZ DEFAULT NOW(),
    marked_by_vendor BOOLEAN DEFAULT FALSE
);

-- FRAUD FLAGS TABLE
CREATE TABLE fraud_flags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
    reason TEXT,
    flagged_at TIMESTAMPTZ DEFAULT NOW(),
    resolved BOOLEAN DEFAULT FALSE
);

-- SUBSCRIPTIONS TABLE
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
    plan_name TEXT NOT NULL,
    amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'active',
    start_date TIMESTAMPTZ DEFAULT NOW(),
    end_date TIMESTAMPTZ
);

-- ADMIN LOGS TABLE
CREATE TABLE admin_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_username TEXT NOT NULL,
    action TEXT NOT NULL,
    target_id UUID,
    details TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- FEEDBACK TICKETS TABLE
CREATE TABLE feedback_tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
    feedback_text TEXT NOT NULL,
    status TEXT DEFAULT 'open', -- 'open' or 'resolved'
    resolution_image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);
