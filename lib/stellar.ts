import { Keypair, Networks, TransactionBuilder, Operation, Asset, Horizon } from 'stellar-sdk';

const server = new Horizon.Server('https://api.mainnet.minepi.com', { allowHttp: false });

export async function sendPiFromEscrow(params: {
  destinationWallet: string;
  amount: string;
  memo: string;
}): Promise<{ success: boolean; txHash: string }> {
  const seed = process.env.STELLAR_ESCROW_SEED!;
  const keypair = Keypair.fromSecret(seed);
  const account = await server.loadAccount(keypair.publicKey());
  const tx = new TransactionBuilder(account, { fee: '1000', networkPassphrase: Networks.PUBLIC })
    .addOperation(Operation.payment({
      destination: params.destinationWallet,
      asset: Asset.native(),
      amount: params.amount,
    }))
    .addMemo({ value: params.memo.substring(0, 28), type: 'text' } as any)
    .setTimeout(30)
    .build();
  tx.sign(keypair);
  const result = await server.submitTransaction(tx);
  return { success: true, txHash: result.hash };
}

export async function sendCommission(params: { amount: string; memo: string }) {
  return sendPiFromEscrow({
    destinationWallet: process.env.PI_COMMISSION_WALLET!,
    amount: params.amount,
    memo: params.memo,
  });
}

export async function validateEscrowBalance(required: number): Promise<void> {
  const account = await server.loadAccount(process.env.PI_ESCROW_WALLET!);
  const bal = account.balances.find((b: any) => b.asset_type === 'native');
  const balance = bal ? parseFloat(bal.balance) : 0;
  if (balance < required) throw new Error(`Insufficient balance: ${balance} Pi available, ${required} required`);
}
