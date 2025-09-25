/**
 * Seed admin users into Supabase Auth
 * Run: node seed-admins.js
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Resolve project root (one level up from /my-app)

import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });
// Load environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

// Initialize Supabase client (with service role key for elevated permissions)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function seedAdmins() {
  const admins = [
    {
      email: "ali@carpool.com",
      password: "123456",
      meta: { role: "admin", name: "Ali" },
    },
    {
      email: "khadeejah@carpool.com",
      password: "123456",
      meta: { role: "admin", name: "Khadeejah" },
    },
  ];

  for (const admin of admins) {
    try {
      const { data, error } = await supabase.auth.admin.createUser({
        email: admin.email,
        password: admin.password,
        email_confirm: true, // mark as verified
        user_metadata: admin.meta,
        app_metadata: { role: "admin" }, // app-level role for RBAC
      });

      if (error) {
        console.error(`❌ Failed to create ${admin.email}:`, error.message);
      } else {
        console.log(`✅ Created admin user: ${admin.email}`, data.user.id);
      }
    } catch (err) {
      console.error(`❌ Unexpected error for ${admin.email}:`, err);
    }
  }
}

seedAdmins();
