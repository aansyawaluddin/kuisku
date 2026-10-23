// Membuat akun superadmin pertama.
// Pakai: node --env-file=.env.local scripts/create-superadmin.mjs email@domain.id PasswordKuat123 "Nama Admin"
import { createClient } from "@supabase/supabase-js";

const [email, password, name = "Superadmin"] = process.argv.slice(2);
if (!email || !password) {
  console.error('Pakai: node --env-file=.env.local scripts/create-superadmin.mjs <email> <password> "<nama>"');
  process.exit(1);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diatur di .env.local");
  process.exit(1);
}
const admin = createClient(url, key, { auth: { persistSession: false } });
const { data, error } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: name, username: "admin" },
  app_metadata: { role: "superadmin" },
});
if (error) {
  console.error("Gagal:", error.message);
  process.exit(1);
}
console.log(`✔ Superadmin dibuat: ${data.user.email} (login dengan email atau username "admin")`);
