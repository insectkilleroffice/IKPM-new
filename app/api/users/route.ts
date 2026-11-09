import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { ROLES, type NewUserInput, type Role } from "@/types/user";

function fail(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

/** Create a staff account. Only callable by a signed-in admin. */
export async function POST(request: Request) {
  let admin;
  try {
    admin = getSupabaseAdmin();
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Server not configured", 500);
  }

  // 1. Who is calling? Must be a signed-in admin.
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return fail("Not signed in", 401);

  const { data: caller, error: callerErr } = await admin.auth.getUser(token);
  if (callerErr || !caller.user) return fail("Not signed in", 401);

  const { data: callerProfile } = await admin.from("profiles").select("role").eq("id", caller.user.id).single();
  if (callerProfile?.role !== "admin") return fail("Only admins can create users", 403);

  // 2. Validate input.
  const body = (await request.json().catch(() => null)) as Partial<NewUserInput> | null;
  const fullName = body?.fullName?.trim() ?? "";
  const email = body?.email?.trim().toLowerCase() ?? "";
  const password = body?.password ?? "";
  const role = body?.role as Role;

  if (!fullName) return fail("Name is required", 400);
  if (!/^\S+@\S+\.\S+$/.test(email)) return fail("Enter a valid email", 400);
  if (password.length < 8) return fail("Password must be at least 8 characters", 400);
  if (!ROLES.includes(role)) return fail("Choose a valid role", 400);

  // 3. Create the login, then the profile. Roll back the login if the profile fails.
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (createErr || !created.user) return fail(createErr?.message ?? "Could not create user", 400);

  const { data: profile, error: profileErr } = await admin
    .from("profiles")
    .insert({ id: created.user.id, full_name: fullName, email, role })
    .select("id, full_name, email, role, created_at")
    .single();

  if (profileErr) {
    await admin.auth.admin.deleteUser(created.user.id);
    return fail(profileErr.message, 500);
  }

  return Response.json(
    {
      user: {
        id: profile.id,
        fullName: profile.full_name,
        email: profile.email,
        role: profile.role,
        createdAt: profile.created_at,
      },
    },
    { status: 201 }
  );
}
