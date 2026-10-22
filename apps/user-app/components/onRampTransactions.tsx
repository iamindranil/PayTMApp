import { Card } from "@repo/ui/card";


export const OnRampTransactions = ({
  transactions,
}: {
  transactions: {
    time: Date;
    amount: number;
    status: "Success" | "Failure" | "Processing";
    provider: string;
  }[];
}) => {
  if (!transactions.length) {
    return (
      <Card title="Recent Transactions">
        <div className="text-center pb-8 pt-8 text-sm text-gray-500">No Recent transactions</div>
      </Card>
    );
  }
  return (
    <Card title="Recent Transactions">
      <div className="pt-2 divide-y divide-gray-100">
        {transactions.map((t) => (
          <div key={t.time.getTime()} className="flex justify-between items-center py-2">
            <div>
              <div className="text-sm font-medium text-gray-800">
                {t.provider || "Bank Deposit"}
              </div>
              <div className="text-slate-500 text-xs">
                {t.time.toDateString()}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  t.status === "Success"
                    ? "bg-green-100 text-green-700"
                    : t.status === "Failure"
                    ? "bg-red-100 text-red-700"
                    : "bg-yellow-100 text-yellow-700"
                }`}
              >
                {t.status}
              </span>
              <div className="text-sm font-semibold text-gray-900">
                + ₹{t.amount / 100}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};
