import Database from "better-sqlite3"
import { cookies } from "next/headers"

const db = new Database("backend/app.db")

export async function POST(req: Request) {
  const { username, password } = (await req.json()) as { username?: string; password?: string }
  if (!username || !password) {
    return Response.json({ error: "กรุณากรอกชื่อผู้ใช้และรหัสผ่าน" }, { status: 400 })
  }

  const user = db
    .prepare("SELECT user_id, user_name, user_role FROM users WHERE user_name = ? AND user_password = ?")
    .get(username.trim(), password) as { user_id: number; user_name: string; user_role: string } | undefined

  if (!user) {
    return Response.json({ error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" }, { status: 401 })
  }

  const cookieStore = await cookies()
  cookieStore.set("auth_user", JSON.stringify(user), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  })

  return Response.json({ success: true, user })
}

export async function GET() {
  const cookieStore = await cookies()
  const auth = cookieStore.get("auth_user")
  if (!auth?.value) {
    return Response.json({ user: null })
  }
  try {
    return Response.json({ user: JSON.parse(auth.value) })
  } catch {
    return Response.json({ user: null })
  }
}

export async function DELETE() {
  const cookieStore = await cookies()
  cookieStore.delete("auth_user")
  return Response.json({ success: true })
}
