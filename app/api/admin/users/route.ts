import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/actions/auth'
import { getUsers, createUser } from '@/lib/actions/users'
import { z } from 'zod'

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(6).optional(),
  role: z.enum(['user', 'admin']).default('user'),
})

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search') || undefined
    const role = searchParams.get('role') as 'user' | 'admin' | undefined
    const sortBy = searchParams.get('sortBy') || 'createdAt'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

    const result = await getUsers(page, limit, {
      search,
      role,
      sortBy: sortBy as 'name' | 'email' | 'role' | 'createdAt',
      sortOrder: sortOrder as 'asc' | 'desc',
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = createUserSchema.parse(body)

    const user = await createUser(validatedData)

    return NextResponse.json(user, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', issues: error.issues }, { status: 400 })
    }
    console.error('Error creating user:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
