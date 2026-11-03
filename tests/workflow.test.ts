import { describe, it, expect } from "vitest";
import { actions } from "../src/utils/workflow";
import type { Status } from "../src/types";
describe("доступные действия интерфейса", () => {
  it("manager только проверяет", () => {
    expect(actions("manager", "review")).toEqual(["accepted", "rework"]);
    expect(actions("manager", "new")).toEqual([]);
  });
  it("worker работает и сдаёт", () => {
    expect(actions("worker", "new")).toEqual(["in_progress"]);
    expect(actions("worker", "in_progress")).toEqual(["review"]);
    expect(actions("worker", "rework")).toEqual(["in_progress"]);
  });
  it("финальные и ожидающие статусы не дают действий исполнителю", () => {
    for (const s of ["review", "accepted"] as Status[])
      expect(actions("worker", s)).toEqual([]);
    expect(actions("manager", "accepted")).toEqual([]);
  });
});
