import { PrismaClient } from '@prisma/client';

export async function seedConversations(prisma: PrismaClient) {
  console.log('  💬 Seeding conversations...');

  const user  = await prisma.user.findFirst({ where: { role: 'CUSTOMER' } });
  const order = await prisma.order.findFirst();

  if (!user || !order) {
    console.log('    ⏭  Skipped (no customer user or order found)');
    return;
  }

  const conv = await prisma.conversation.create({
    data: {
      userId:        user.id,
      orderId:       order.id,
      subject:       'Question about my custom mug',
      status:        'OPEN',
      lastMessage:   'Hi, can I add an extra line of text to my order?',
      lastMessageAt: new Date(),
      unreadByAdmin: 1,
      messages: {
        create: [{
          senderType: 'CUSTOMER',
          senderId:   user.id,
          body:       `Hi! I just placed order #${order.orderNumber} and was wondering if it's possible to add a second line of text to the mug? Something like "Best Dad 2024" on the second line.`,
        }],
      },
    },
  });

  console.log(`    ✓ 1 conversation (id: ${conv.id})`);
}
