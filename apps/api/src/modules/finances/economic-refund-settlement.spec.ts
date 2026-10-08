import { PrismaClient } from '@prisma/client';
import { RefundProvider } from '../payments/economic-refund-evidence';
import { executeEconomicRefund } from './economic-refund-settlement';
import { buildEconomicQuote, quoteFingerprint } from './economic-quote';
import { planQuantityRefund } from './economic-refund-plan';
import { plannedRefundJournal } from './economic-refund-journal';

function harness(paid = 0n) {
  const quote=buildEconomicQuote({orderId:'order',currency:'USD',minorExponent:2,
    stores:[{storeId:'shop',storeOrderId:'shop-order',lines:[{id:'line',productId:'product',variantId:null,quantity:2,unitPriceMinor:'100',sellerDiscountMinor:'0',platformDiscountMinor:'0'}],customerShippingMinor:'0',expectedShippingSubsidyMinor:'0',giftWrapMinor:'0',fees:[]}],tax:{amountMinor:'0',ruleReference:'synthetic'},affiliate:null});
  const plan=planQuantityRefund(quote,[{partKey:'item:line',quantity:1}]);
  const op={id:'refund-op',kind:'REFUND',state:'PREPARED',amountMinor:100n,providerReference:null as string|null,dispatchToken:null as string|null,
    contextId:'context',provider:'STRIPE',providerAccount:'acct_fixture',provenance:'TEST',currency:'USD'};
  const capture={id:'capture',contextId:'context',operationId:'capture-op',quoteHash:quoteFingerprint(quote),provider:'STRIPE',providerAccount:'acct_fixture',provenance:'TEST',currency:'USD',providerReference:'ch_fixture',amountMinor:200n,
    context:{orderId:'order',minorExponent:2,quote,order:{payment:{stripePaymentIntentId:'pi_fixture',paypalOrderId:null}}}};
  const request={id:'request',captureId:'capture',operationId:'refund-op',operation:op,capture,plan,plannedJournal:plannedRefundJournal(plan,quote),platformRoundingMinor:0n,settlement:null as Record<string,unknown>|null};
  const lot={id:'lot',accountId:'account',captureId:'capture',sourceKey:'item:line',amountMinor:200n,paidMinor:paid,reservedMinor:0n,reversedMinor:0n,debtRecoveredMinor:0n};
  const account={debtMinor:0n};
  const events:Record<string,unknown>[]=[];
  const reversals:Record<string,unknown>[]=[];
  const journals:Record<string,unknown>[]=[];
  const tx={
    $queryRaw:jest.fn().mockResolvedValue([]),
    economicRefundRequest:{findUniqueOrThrow:jest.fn(async()=>request)},
    economicOperation:{findUniqueOrThrow:jest.fn(async()=>op),updateMany:jest.fn(async({where,data})=>{
      if (typeof where.state==='string' ? op.state!==where.state : !where.state.in.includes(op.state)) return {count:0};
      if (where.dispatchToken && op.dispatchToken!==where.dispatchToken) return {count:0};
      Object.assign(op,data); return {count:1};
    })},
    economicRefund:{create:jest.fn(async({data})=>{const refund={id:'refund',...data}; request.settlement=refund;return refund;})},
    economicRefundJournalEntry:{createMany:jest.fn(async({data})=>{journals.push(...data);return {count:data.length};})},
    economicBalanceLot:{findMany:jest.fn(async()=>[lot]),update:jest.fn(async({data})=>{Object.assign(lot,data);return lot;})},
    economicBalanceAccount:{update:jest.fn(async({data})=>{account.debtMinor+=data.debtMinor.increment;return account;})},
    economicRefundLotReversal:{create:jest.fn(async({data})=>{reversals.push(data);return data;})},
    economicOutbox:{createMany:jest.fn(async({data})=>{events.push(...data);return {count:1};}),findUniqueOrThrow:jest.fn(async()=>events[0])},
  };
  // Serialized transaction model with rollback; not PostgreSQL contention proof.
  let serial=Promise.resolve();
  const db={...tx,$transaction:jest.fn(work=>{
    const task=serial.then(async()=>{
      const oldOp={...op},oldLot={...lot},oldDebt=account.debtMinor,oldSettlement=request.settlement;
      const lengths=[events.length,reversals.length,journals.length];
      try{return await work(tx);}catch(error){Object.assign(op,oldOp);Object.assign(lot,oldLot);account.debtMinor=oldDebt;request.settlement=oldSettlement;
        events.length=lengths[0];reversals.length=lengths[1];journals.length=lengths[2];throw error;}
    }); serial=task.then(()=>undefined,()=>undefined);return task;
  })};
  const provider:RefundProvider={provider:'STRIPE',providerAccount:'acct_fixture',provenance:'TEST',create:jest.fn(async()=> 're_fixture'),read:jest.fn(async expected=>({
    refund:{id:expected.refundReference,status:'succeeded',charge:'ch_fixture',payment_intent:'pi_fixture',currency:'usd',amount:100,
      metadata:{economicRefundOperationId:'refund-op',economicCaptureId:'capture',quoteHash:capture.quoteHash}},
    original:{id:'ch_fixture',payment_intent:'pi_fixture',livemode:false,paid:true,captured:true,disputed:false,currency:'usd',amount_captured:200,amount_refunded:100},
  }))};
  return {db:db as unknown as PrismaClient,tx,provider,op,request,lot,account,events,reversals,journals};
}
describe('durable evidenced refunds (modeled DB, synthetic provider)',()=>{
  it('books compensating journal once and preserves original paid money on replay',async()=>{
    const h=harness(160n);
    expect(await executeEconomicRefund(h.db,'request','operator',h.provider)).toMatchObject({state:'SUCCEEDED',amountMinor:'100'});
    expect(h.lot).toMatchObject({paidMinor:160n,reversedMinor:100n,reservedMinor:0n});
    expect(h.account.debtMinor).toBe(60n);
    expect(h.reversals[0]).toMatchObject({amountMinor:100n,availableDebitMinor:40n,debtMinor:60n});
    expect(h.journals.reduce((sum,row)=>sum+(row['amountMinor'] as bigint),0n)).toBe(0n);
    await executeEconomicRefund(h.db,'request','operator',h.provider);
    expect(h.provider.create).toHaveBeenCalledTimes(1);expect(h.reversals).toHaveLength(1);expect(h.events).toHaveLength(1);
  });
  it('quarantines a timeout and never resends, even when called with the same ID',async()=>{
    const h=harness(); (h.provider.create as jest.Mock).mockRejectedValue(new Error('timeout'));
    await expect(executeEconomicRefund(h.db,'request','operator',h.provider)).rejects.toThrow('timeout');
    expect(h.op.state).toBe('NEEDS_RECONCILIATION');
    await expect(executeEconomicRefund(h.db,'request','operator',h.provider)).rejects.toThrow('Unknown refund outcome');
    expect(h.provider.create).toHaveBeenCalledTimes(1);expect(h.provider.read).not.toHaveBeenCalled();expect(h.journals).toHaveLength(0);
    await executeEconomicRefund(h.db,'request','operator',h.provider,'re_fixture');
    expect(h.op.state).toBe('SUCCEEDED');expect(h.provider.create).toHaveBeenCalledTimes(1);
  });
  it('keeps a trusted pending reference but does not book until the server read proves success',async()=>{
    const h=harness(),read=h.provider.read;
    (h.provider.read as jest.Mock).mockRejectedValueOnce(new Error('pending'));
    await expect(executeEconomicRefund(h.db,'request','operator',h.provider)).rejects.toThrow('pending');
    expect(h.op.providerReference).toBe('re_fixture');expect(h.request.settlement).toBeNull();
    await executeEconomicRefund(h.db,'request','operator',h.provider);
    expect(h.provider.create).toHaveBeenCalledTimes(1);expect(read).toHaveBeenCalledTimes(2);
  });
  it('refuses a reserved payout and rolls back proof, journal and balances after a provider success',async()=>{
    const h=harness();h.lot.reservedMinor=1n;
    await expect(executeEconomicRefund(h.db,'request','operator',h.provider)).rejects.toThrow('reserved payout');
    expect(h.request.settlement).toBeNull();expect(h.journals).toHaveLength(0);expect(h.lot.reversedMinor).toBe(0n);
    expect(h.op.state).toBe('NEEDS_RECONCILIATION');expect(h.op.providerReference).toBe('re_fixture');
    h.lot.reservedMinor=0n;
    await executeEconomicRefund(h.db,'request','operator',h.provider);
    expect(h.provider.create).toHaveBeenCalledTimes(1);
  });
  it('validates scope before dispatch, refuses unclaimed recovery and does not latch a bad recovery hint',async()=>{
    const h=harness();
    await expect(executeEconomicRefund(h.db,'request','operator',{...h.provider,provenance:'LIVE'})).rejects.toThrow('scope');
    await expect(executeEconomicRefund(h.db,'request','operator',h.provider,'re_fixture')).rejects.toThrow('undispatched');
    expect(h.provider.create).not.toHaveBeenCalled();
    h.op.state='NEEDS_RECONCILIATION';
    (h.provider.read as jest.Mock).mockRejectedValueOnce(new Error('foreign proof'));
    await expect(executeEconomicRefund(h.db,'request','operator',h.provider,'re_foreign')).rejects.toThrow('foreign proof');
    expect(h.op.providerReference).toBeNull();
    await executeEconomicRefund(h.db,'request','operator',h.provider,'re_fixture');
    expect(h.op.providerReference).toBe('re_fixture');expect(h.provider.create).not.toHaveBeenCalled();
  });
});
