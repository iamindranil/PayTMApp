import { Card } from "@repo/ui/card";

export const P2PTransactions = ({
  transactions,
}: {
  transactions: {
    time: Date;
    amount: number;
    userId:number,
    flag:boolean//T-credit(+) F-debit(-)
  }[];
}) => {
  if (!transactions.length) {
    return (
      <Card title="Recent Transactions">
        <div className="text-center pb-8 pt-8">No Recent transactions</div>
      </Card>
    );
  }
  return (
    <Card title="Recent Transactions">
      <div className="pt-2">
        {transactions.map((t) => (
          <div key={t.time.getTime()} className="flex justify-between">
            <div>
              <div className="text-sm">{t.flag?"Received INR":"Sent INR"}</div>
              <div className="text-slate-600 text-xs">
                {t.time.toDateString()}
              </div>
            </div>
            <div className="text-sm text-gray-700">
                UserId:{t.userId}
            </div>
            <div className="flex flex-col justify-center">
              {t.flag?"+":"-"} Rs {t.amount / 100}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};
