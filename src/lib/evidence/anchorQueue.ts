import prisma from '../prisma.js'
import { anchorPayloadHashSafe } from './solana.js'

interface EnqueueAnchorInput {
  bundleId?: string | null
  entityType: string
  entityId: string
  payloadHash: string
}

export async function enqueueAnchorJob(input: EnqueueAnchorInput) {
  return prisma.anchorQueue.create({
    data: {
      bundleId: input.bundleId ?? null,
      entityType: input.entityType,
      entityId: input.entityId,
      payloadHash: input.payloadHash,
      status: 'PENDING',
      attemptCount: 0,
    },
  })
}

export async function processOneAnchorJobSafe() {
  const job = await prisma.anchorQueue.findFirst({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'asc' },
  })

  if (!job) return { processed: false, reason: 'NO_PENDING_JOB' as const }

  await prisma.anchorQueue.update({
    where: { id: job.id },
    data: { status: 'PROCESSING', attemptCount: { increment: 1 } },
  })

  const anchorResult = await anchorPayloadHashSafe(job.payloadHash)
  if (anchorResult.status === 'ANCHORED') {
    await prisma.anchorQueue.update({
      where: { id: job.id },
      data: { status: 'DONE', lastError: null, nextRetryAt: null },
    })
  } else if (anchorResult.status === 'DISABLED_SAFE' || anchorResult.status === 'PENDING_ANCHOR') {
    await prisma.anchorQueue.update({
      where: { id: job.id },
      data: {
        status: 'PENDING',
        nextRetryAt: new Date(Date.now() + 5 * 60 * 1000),
        lastError: anchorResult.reason ?? null,
      },
    })
  } else {
    await prisma.anchorQueue.update({
      where: { id: job.id },
      data: {
        status: job.attemptCount + 1 >= 5 ? 'DEAD_LETTER' : 'FAILED',
        nextRetryAt: new Date(Date.now() + 15 * 60 * 1000),
        lastError: anchorResult.reason ?? 'ANCHOR_FAILED',
      },
    })
  }

  return { processed: true, jobId: job.id, anchorResult }
}
