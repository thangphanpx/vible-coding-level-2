import type { DatabaseSync } from "node:sqlite";
import type { Course } from "@ces/shared";

/** Khóa học kèm lịch khai giảng. Mọi vai trò đã đăng nhập đều được xem. */
export function listCourses(db: DatabaseSync): Course[] {
  const courses = db.prepare("SELECT id, name, tuition_vnd, sessions, description FROM courses ORDER BY name").all() as {
    id: string; name: string; tuition_vnd: number; sessions: number; description: string | null;
  }[];
  const intakes = db.prepare("SELECT id, course_id, start_date, seats FROM course_intakes ORDER BY start_date").all() as {
    id: string; course_id: string; start_date: string; seats: number;
  }[];
  return courses.map((c) => ({
    id: c.id, name: c.name, tuitionVnd: c.tuition_vnd, sessions: c.sessions, description: c.description,
    intakes: intakes.filter((i) => i.course_id === c.id).map((i) => ({ id: i.id, startDate: i.start_date, seats: i.seats })),
  }));
}
