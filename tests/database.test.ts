import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
const db = new PGlite();
const manager = "10000000-0000-0000-0000-000000000001",
  worker = "10000000-0000-0000-0000-000000000002",
  other = "10000000-0000-0000-0000-000000000003";
const object = "20000000-0000-0000-0000-000000000001",
  hidden = "20000000-0000-0000-0000-000000000002";
let task: string;
async function asUser<T>(uid: string, run: () => Promise<T>) {
  await db.exec(
    `set role authenticated; select set_config('request.jwt.claim.sub','${uid}',false)`,
  );
  try {
    return await run();
  } finally {
    await db.exec("reset role");
  }
}
async function rpc(uid: string, status: string, comment: string | null = null) {
  return asUser(uid, () =>
    db.query("select public.change_task_status($1,$2,$3)", [
      task,
      status,
      comment,
    ]),
  );
}
beforeAll(async () => {
  await db.exec(
    `create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key,email text unique); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`,
  );
  await db.exec(
    readFileSync(
      new URL(
        "../supabase/migrations/202611030001_initial.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.query(`insert into auth.users(id) values ($1),($2),($3)`, [
    manager,
    worker,
    other,
  ]);
  await db.query(
    `insert into public.profiles(id,full_name,role) values ($1,'Постановщик','manager'),($2,'Первый исполнитель','worker'),($3,'Второй исполнитель','worker')`,
    [manager, worker, other],
  );
  await db.query(
    `insert into public.objects(id,name,address) values ($1,'Первый','Адрес 1'),($2,'Второй','Адрес 2')`,
    [object, hidden],
  );
  const result = await asUser(manager, () =>
    db.query<{ id: string }>(
      `insert into public.tasks(title,object_id,assignee_id) values ('Работа',$1,$2) returning id`,
      [object, worker],
    ),
  );
  task = result.rows[0].id;
  await asUser(manager, () =>
    db.query(
      `insert into public.tasks(title,object_id,assignee_id) values ('Чужая',$1,$2)`,
      [hidden, other],
    ),
  );
}, 30000);
afterAll(async () => {
  await db.close();
});
describe("Реальная миграция PostgreSQL: права, RLS и workflow", () => {
  it("manager видит все объекты и задачи", async () => {
    await asUser(manager, async () => {
      expect(
        (await db.query("select * from public.objects")).rows,
      ).toHaveLength(2);
      expect((await db.query("select * from public.tasks")).rows).toHaveLength(
        2,
      );
    });
  });
  it("worker видит только свои задачи и объекты, прямой UUID не помогает", async () => {
    await asUser(worker, async () => {
      expect(
        (await db.query("select * from public.objects")).rows,
      ).toHaveLength(1);
      expect((await db.query("select * from public.tasks")).rows).toHaveLength(
        1,
      );
      expect(
        (await db.query("select * from public.objects where id=$1", [hidden]))
          .rows,
      ).toHaveLength(0);
    });
    await asUser(other, async () =>
      expect(
        (await db.query("select * from public.tasks where id=$1", [task])).rows,
      ).toHaveLength(0),
    );
  });
  it("worker не изменяет задачи через прямой UPDATE", async () => {
    await asUser(worker, async () =>
      expect(
        (await db.query(`update public.tasks set title='Взлом' returning id`))
          .rows,
      ).toHaveLength(0),
    );
  });
  it("worker не создаёт объекты или задачи", async () => {
    await expect(
      asUser(worker, () =>
        db.exec(`insert into public.objects(name,address) values ('x','y')`),
      ),
    ).rejects.toThrow();
    await expect(
      asUser(worker, () =>
        db.query(
          `insert into public.tasks(title,object_id,assignee_id) values ('x',$1,$2)`,
          [object, worker],
        ),
      ),
    ).rejects.toThrow();
  });
  it("профили и роли нельзя изменить", async () => {
    await expect(
      asUser(worker, () =>
        db.query(`update public.profiles set role='manager' where id=$1`, [
          worker,
        ]),
      ),
    ).rejects.toThrow();
  });
  it("статус и автор защищены колонковыми привилегиями даже от manager", async () => {
    await expect(
      asUser(manager, () =>
        db.query(`update public.tasks set status='accepted' where id=$1`, [
          task,
        ]),
      ),
    ).rejects.toThrow();
    await expect(
      asUser(manager, () =>
        db.query(`update public.tasks set author_id=$1 where id=$2`, [
          other,
          task,
        ]),
      ),
    ).rejects.toThrow();
    await expect(
      asUser(manager, () =>
        db.query(
          `insert into public.tasks(title,object_id,assignee_id,status) values ('x',$1,$2,'accepted')`,
          [object, worker],
        ),
      ),
    ).rejects.toThrow();
  });
  it("чужой исполнитель и аноним не вызывают RPC успешно", async () => {
    await expect(rpc(other, "in_progress")).rejects.toThrow();
    await expect(rpc("", "in_progress")).rejects.toThrow();
    await db.exec("set role anon");
    try {
      await expect(
        db.query("select public.change_task_status($1,$2,$3)", [
          task,
          "in_progress",
          null,
        ]),
      ).rejects.toThrow();
    } finally {
      await db.exec("reset role");
    }
  });
  it("new → accepted запрещён обоим ролям", async () => {
    await expect(rpc(worker, "accepted")).rejects.toThrow();
    await expect(rpc(manager, "accepted")).rejects.toThrow();
  });
  it("создание автоматически записывает историю, подделка и удаление запрещены", async () => {
    await asUser(worker, async () =>
      expect(
        (await db.query("select * from public.task_history")).rows,
      ).toHaveLength(1),
    );
    await expect(
      asUser(manager, () =>
        db.query(
          `insert into public.task_history(task_id,changed_by,new_status) values ($1,$2,'accepted')`,
          [task, manager],
        ),
      ),
    ).rejects.toThrow();
    await expect(
      asUser(worker, () => db.exec("delete from public.task_history")),
    ).rejects.toThrow();
    await expect(
      asUser(manager, () =>
        db.exec(`update public.task_history set comment='fake'`),
      ),
    ).rejects.toThrow();
  });
  it("new → in_progress → review работают и создают историю", async () => {
    await rpc(worker, "in_progress");
    await rpc(worker, "review");
    await asUser(worker, async () =>
      expect(
        (
          await db.query("select * from public.task_history where task_id=$1", [
            task,
          ])
        ).rows,
      ).toHaveLength(3),
    );
  });
  it("worker не принимает задачу; manager не возвращает без комментария", async () => {
    await expect(rpc(worker, "accepted")).rejects.toThrow();
    for (const c of [null, "", "   ", "\t\n"])
      await expect(rpc(manager, "rework", c)).rejects.toThrow();
  });
  it("ошибка записи истории откатывает уже выполненный UPDATE статуса", async () => {
    await db.exec(
      `alter table public.task_history add constraint simulate_failure check (comment is distinct from 'simulate-failure')`,
    );
    try {
      await expect(
        rpc(manager, "rework", "simulate-failure"),
      ).rejects.toThrow();
      expect(
        (
          await db.query<{ status: string }>(
            "select status from public.tasks where id=$1",
            [task],
          )
        ).rows[0].status,
      ).toBe("review");
      expect(
        (
          await db.query("select * from public.task_history where task_id=$1", [
            task,
          ])
        ).rows,
      ).toHaveLength(3);
    } finally {
      await db.exec(
        "alter table public.task_history drop constraint simulate_failure",
      );
    }
  });
  it("возврат, повторная работа и принятие; финальность accepted", async () => {
    await rpc(manager, "rework", "Исправить стык");
    await rpc(worker, "in_progress");
    await rpc(worker, "review");
    await rpc(manager, "accepted");
    await expect(rpc(manager, "rework", "Ещё раз")).rejects.toThrow();
    await expect(rpc(worker, "in_progress")).rejects.toThrow();
    await asUser(worker, async () =>
      expect(
        (
          await db.query("select * from public.task_history where task_id=$1", [
            task,
          ])
        ).rows,
      ).toHaveLength(7),
    );
  });
  it("откат транзакции отменяет статус и историю вместе", async () => {
    await db.exec("begin");
    try {
      await asUser(manager, () =>
        db.query("delete from public.tasks where id=$1", [task]),
      );
    } finally {
      await db.exec("rollback");
    }
    expect(
      (await db.query("select * from public.tasks where id=$1", [task])).rows,
    ).toHaveLength(1);
    expect(
      (
        await db.query("select * from public.task_history where task_id=$1", [
          task,
        ])
      ).rows,
    ).toHaveLength(7);
  });
  it("непустой объект защищён FK; удаление задачи каскадно удаляет историю", async () => {
    await expect(
      asUser(manager, () =>
        db.query("delete from public.objects where id=$1", [object]),
      ),
    ).rejects.toThrow();
    await asUser(manager, () =>
      db.query("delete from public.tasks where id=$1", [task]),
    );
    expect(
      (
        await db.query("select * from public.task_history where task_id=$1", [
          task,
        ])
      ).rows,
    ).toHaveLength(0);
  });
  it("демонстрационный seed создаёт пять статусов и согласованную историю", async () => {
    const seed = readFileSync(
      new URL("../supabase/seed-demo.sql", import.meta.url),
      "utf8",
    );
    // The setup guide asks users to customize these emails. Create matching
    // accounts only in the isolated test database, never in cloud Supabase.
    const emails = new Map(
      [
        ...seed.matchAll(
          /select\s+id\s+into\s+(m|w1|w2)\s+from\s+auth\.users\s+where\s+email\s*=\s*'((?:[^']|'')*)'/gi,
        ),
      ].map((match) => [
        match[1].toLowerCase(),
        match[2].replaceAll("''", "'"),
      ]),
    );
    expect(emails.size).toBe(3);
    expect(new Set(emails.values()).size).toBe(3);
    for (const email of emails.values()) {
      await db.query(
        "insert into auth.users(id,email) values (gen_random_uuid(),$1)",
        [email],
      );
    }
    try {
      await db.exec(seed);
    } catch (error) {
      // A failed multi-statement seed leaves its explicit transaction aborted.
      await db.exec("rollback");
      throw error;
    }
    const result = await db.query<{ status: string }>(
      `select distinct t.status from public.tasks t join auth.users u on u.id=t.author_id where u.email=$1`,
      [emails.get("m")],
    );
    expect(result.rows.map((r) => r.status).sort()).toEqual([
      "accepted",
      "in_progress",
      "new",
      "review",
      "rework",
    ]);
    expect(
      (
        await db.query(
          `select h.* from public.task_history h join public.tasks t on t.id=h.task_id join auth.users u on u.id=t.author_id where u.email=$1`,
          [emails.get("m")],
        )
      ).rows,
    ).toHaveLength(14);
  });
  it("повторный seed отказывает без частичного добавления данных", async () => {
    const count = (await db.query("select * from public.objects")).rows.length;
    try {
      await expect(
        db.exec(
          readFileSync(
            new URL("../supabase/seed-demo.sql", import.meta.url),
            "utf8",
          ),
        ),
      ).rejects.toThrow();
    } finally {
      await db.exec("rollback");
    }
    expect((await db.query("select * from public.objects")).rows).toHaveLength(
      count,
    );
  });
});
