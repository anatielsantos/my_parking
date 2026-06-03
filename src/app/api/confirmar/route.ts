import { NextRequest, NextResponse } from "next/server";
import { createConfirmEntryUseCase } from "@/lib/use-cases/factory";
import {
  DuplicateTokenError,
  NoAvailableSpotsError,
} from "@/lib/use-cases/confirm-entry";
import { entradaEventEmitter, ENTRADA_EVENT } from "@/lib/sse/entrada-emitter";

/**
 * @swagger
 * /api/confirmar:
 *   get:
 *     summary: Confirma entrada do veiculo
 *     description: Cria registro de entrada no banco, marca a vaga como ocupada e dispara evento SSE para gerar novo QR na tela de entrada.
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Token UUID unico da sessao (gerado no QR escaneado).
 *     responses:
 *       200:
 *         description: Entrada confirmada com sucesso.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 entry:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     spotId:
 *                       type: integer
 *                     token:
 *                       type: string
 *                       format: uuid
 *                     entryTime:
 *                       type: string
 *                       format: date-time
 *                     exitTime:
 *                       type: string
 *                       format: date-time
 *                       nullable: true
 *       400:
 *         description: Token nao informado.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *       409:
 *         description: Token ja foi utilizado anteriormente.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *       503:
 *         description: Nenhuma vaga disponivel no momento.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.json(
      { error: "Token é obrigatório" },
      { status: 400 },
    );
  }

  const confirmEntry = createConfirmEntryUseCase();

  try {
    const entry = await confirmEntry.execute(token);

    return NextResponse.json({ entry });
  } catch (error) {
    if (error instanceof DuplicateTokenError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof NoAvailableSpotsError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    throw error;
  } finally {
    entradaEventEmitter.emit(ENTRADA_EVENT);
  }
}
