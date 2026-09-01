import { OrderStatus } from '@prisma/client';
import { OFF_QUEUE_STATUSES, queueLifecycleWhere } from './order-progress.service';

describe('queueLifecycleWhere', () => {
  it('keeps a parent-cancelled order out of the active queue even when its store row drifted', () => {
    expect(queueLifecycleWhere('active')).toEqual({
      status: { notIn: [...OFF_QUEUE_STATUSES] },
      order: {
        status: { notIn: [OrderStatus.CANCELLED, OrderStatus.REFUNDED] },
      },
    });
  });

  it('finds cancelled orders through either side of the relation', () => {
    expect(queueLifecycleWhere('cancelled')).toEqual({
      OR: [
        { status: OrderStatus.CANCELLED },
        { order: { status: OrderStatus.CANCELLED } },
      ],
    });
  });
});
