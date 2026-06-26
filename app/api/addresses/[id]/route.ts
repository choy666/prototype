import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/actions/auth";
import { db } from "@/lib/db";
import { addresses } from "@/lib/schema";
import { addressSchema } from "@/lib/validations/checkout";
import { eq, and } from "drizzle-orm";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const addressId = parseInt(id);
    if (isNaN(addressId)) {
      return NextResponse.json(
        { error: "ID de dirección inválido" },
        { status: 400 }
      );
    }

    const address = await db
      .select()
      .from(addresses)
      .where(
        and(
          eq(addresses.id, addressId),
          eq(addresses.userId, parseInt(session.user.id))
        )
      )
      .limit(1);

    if (address.length === 0) {
      return NextResponse.json(
        { error: "Dirección no encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json(address[0]);
  } catch (error) {
    console.error("Error fetching address:", error);
    return NextResponse.json(
      { error: "Error al obtener dirección" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const addressId = parseInt(id);
    if (isNaN(addressId)) {
      return NextResponse.json(
        { error: "ID de dirección inválido" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const validationResult = addressSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Datos de dirección inválidos",
          details: validationResult.error.issues
        },
        { status: 400 }
      );
    }

    const addressData = validationResult.data;

    // Verificar que la dirección pertenece al usuario
    const existingAddress = await db
      .select()
      .from(addresses)
      .where(
        and(
          eq(addresses.id, addressId),
          eq(addresses.userId, parseInt(session.user.id))
        )
      )
      .limit(1);

    if (existingAddress.length === 0) {
      return NextResponse.json(
        { error: "Dirección no encontrada" },
        { status: 404 }
      );
    }

    // Si se marca como predeterminada, quitar el flag de otras direcciones
    if (addressData.isDefault) {
      await db
        .update(addresses)
        .set({ isDefault: false })
        .where(eq(addresses.userId, parseInt(session.user.id)));
    }

    const updatedAddress = await db
      .update(addresses)
      .set({
        ...addressData,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(addresses.id, addressId),
          eq(addresses.userId, parseInt(session.user.id))
        )
      )
      .returning();

    return NextResponse.json(updatedAddress[0]);
  } catch (error) {
    console.error("Error updating address:", error);
    return NextResponse.json(
      { error: "Error al actualizar dirección" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const addressId = parseInt(id);
    if (isNaN(addressId)) {
      return NextResponse.json(
        { error: "ID de dirección inválido" },
        { status: 400 }
      );
    }

    // Verificar que la dirección pertenece al usuario
    const existingAddress = await db
      .select()
      .from(addresses)
      .where(
        and(
          eq(addresses.id, addressId),
          eq(addresses.userId, parseInt(session.user.id))
        )
      )
      .limit(1);

    if (existingAddress.length === 0) {
      return NextResponse.json(
        { error: "Dirección no encontrada" },
        { status: 404 }
      );
    }

    await db
      .delete(addresses)
      .where(
        and(
          eq(addresses.id, addressId),
          eq(addresses.userId, parseInt(session.user.id))
        )
      );

    return NextResponse.json({ message: "Dirección eliminada" });
  } catch (error) {
    console.error("Error deleting address:", error);
    return NextResponse.json(
      { error: "Error al eliminar dirección" },
      { status: 500 }
    );
  }
}
