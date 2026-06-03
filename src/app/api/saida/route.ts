import { NextRequest, NextResponse } from "next/server";
import { createProcessExitUseCase } from "@/lib/use-cases/factory";
import { InvalidTokenError } from "@/lib/use-cases/process-exit";
import { entradaEventEmitter, ENTRADA_EVENT } from "@/lib/sse/entrada-emitter";

/**
 * @swagger
 * /api/saida:
 *   get:
 *     summary: Registra saida do veiculo
 *     description: Busca entrada ativa pelo token, marca exit_time e libera a vaga.
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Token UUID da sessao (mesmo do QR de saida).
 *     responses:
 *       200:
 *         description: Saida registrada com sucesso.
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
 *       404:
 *         description: Token invalido ou saida ja processada.
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

  const processExit = createProcessExitUseCase();

  try {
    const entry = await processExit.execute(token);

    entradaEventEmitter.emit(ENTRADA_EVENT);

    return NextResponse.json({ entry });
  } catch (error) {
    if (error instanceof InvalidTokenError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    throw error;
  }
}
