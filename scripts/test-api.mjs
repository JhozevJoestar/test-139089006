// Run only against a dedicated, migrated test project. No service-role key needed.
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
const env = process.env;
for (const key of [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
  ...["MANAGER", "WORKER", "OTHER"].flatMap((r) => [
    `TEST_${r}_EMAIL`,
    `TEST_${r}_PASSWORD`,
  ]),
])
  assert(env[key], `Missing ${key}`);
async function login(role) {
  const client = createClient(
    env.VITE_SUPABASE_URL,
    env.VITE_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await client.auth.signInWithPassword({
    email: env[`TEST_${role}_EMAIL`],
    password: env[`TEST_${role}_PASSWORD`],
  });
  assert.ifError(error);
  return { client, id: data.user.id };
}
const m = await login("MANAGER"),
  w = await login("WORKER"),
  o = await login("OTHER");
const ok = (result) => {
  assert.ifError(result.error);
  return result.data;
};
const denied = (result) => assert(result.error, "Expected an API error");
let objectId, hiddenId, taskId, otherTaskId;
try {
  objectId = ok(
    await m.client
      .from("objects")
      .insert({ name: `API test ${Date.now()}`, address: "Тест" })
      .select()
      .single(),
  ).id;
  hiddenId = ok(
    await m.client
      .from("objects")
      .insert({ name: "API hidden", address: "Тест" })
      .select()
      .single(),
  ).id;
  taskId = ok(
    await m.client
      .from("tasks")
      .insert({ object_id: objectId, title: "Проверка API", assignee_id: w.id })
      .select()
      .single(),
  ).id;
  otherTaskId = ok(
    await m.client
      .from("tasks")
      .insert({ object_id: hiddenId, title: "Чужая", assignee_id: o.id })
      .select()
      .single(),
  ).id;
  assert.equal(
    ok(await m.client.from("tasks").select().in("id", [taskId, otherTaskId]))
      .length,
    2,
  );
  assert.equal(
    ok(await w.client.from("tasks").select().eq("id", otherTaskId)).length,
    0,
  );
  assert.equal(
    ok(await w.client.from("objects").select().eq("id", hiddenId)).length,
    0,
  );
  assert.equal(
    ok(
      await w.client
        .from("tasks")
        .update({ title: "Взлом" })
        .eq("id", otherTaskId)
        .select(),
    ).length,
    0,
  );
  denied(await w.client.from("objects").insert({ name: "x", address: "y" }));
  denied(
    await w.client.from("profiles").update({ role: "manager" }).eq("id", w.id),
  );
  denied(
    await m.client
      .from("tasks")
      .update({ status: "accepted" })
      .eq("id", taskId),
  );
  const change = (client, status, comment = null) =>
    client.rpc("change_task_status", {
      p_task_id: taskId,
      p_new_status: status,
      p_comment: comment,
    });
  denied(await change(o.client, "in_progress"));
  denied(await change(w.client, "accepted"));
  denied(await change(m.client, "accepted"));
  ok(await change(w.client, "in_progress"));
  ok(await change(w.client, "review"));
  denied(await change(w.client, "accepted"));
  denied(await change(m.client, "rework", " \t\n"));
  ok(await change(m.client, "rework", "Исправить"));
  ok(await change(w.client, "in_progress"));
  ok(await change(w.client, "review"));
  // Concurrent acceptance: only one transaction may succeed and log history.
  const concurrent = await Promise.all([
    change(m.client, "accepted"),
    change(m.client, "accepted"),
  ]);
  assert.equal(concurrent.filter((r) => !r.error).length, 1);
  assert.equal(
    ok(await w.client.from("task_history").select().eq("task_id", taskId))
      .length,
    7,
  );
  denied(
    await m.client
      .from("task_history")
      .insert({ task_id: taskId, changed_by: m.id, new_status: "accepted" }),
  );
  denied(await m.client.from("task_history").delete().eq("task_id", taskId));
  const session = ok(await w.client.auth.getSession()).session;
  assert(session);
  ok(
    await w.client.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    }),
  );
  assert.equal(
    ok(await w.client.from("tasks").select().eq("id", taskId)).length,
    1,
  );
  ok(await w.client.auth.signOut());
  const after = await w.client.from("tasks").select().eq("id", taskId);
  assert(after.error || after.data.length === 0);
  console.log(
    "PASS: Supabase Auth, direct API, RLS, workflow, concurrent acceptance and protected history",
  );
} finally {
  for (const id of [taskId, otherTaskId].filter(Boolean))
    ok(await m.client.from("tasks").delete().eq("id", id));
  for (const id of [objectId, hiddenId].filter(Boolean))
    ok(await m.client.from("objects").delete().eq("id", id));
  for (const user of [m, w, o]) await user.client.auth.signOut();
}
