import { prisma } from "@/lib/prisma";
import { sendPushToUser } from "@/lib/push";

export async function createNotificationAndPush(input: {
  userId: string;
  title: string;
  message: string;
  type?: string;
  data?: unknown;
  url?: string;
}) {
  const notification = await prisma.notification.create({
    data: {
      userId: input.userId,
      title: input.title,
      message: input.message,
      type: input.type || "general",
      data: input.data ? JSON.stringify(input.data) : null,
    },
  });

  await sendPushToUser(input.userId, {
    title: input.title,
    body: input.message,
    url: input.url || "/notifications",
  });

  return notification;
}
