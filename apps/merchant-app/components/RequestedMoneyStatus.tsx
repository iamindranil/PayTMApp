import { Card } from "@repo/ui/card";

export const RequestedMoneyStatus = ({
  moneyStatus,
}: {
  moneyStatus: {
    amt: number;
    pid: number | null;
    status: string;
    time: Date;
  }[];
}) => {
  if (!moneyStatus.length) {
    return (
      <Card title="Recent Request">
        <div className="text-center pb-8 pt-8 text-sm text-gray-500">No Recent Request</div>
      </Card>
    );
  }

  return (
    <Card title="Recent Request">
      <div className="pt-2 space-y-4">
        {moneyStatus.map((t) => (
          <div
            key={t.time.getTime()}
            className="flex justify-between items-center border-b border-gray-200 pb-2"
          >
            <div className="text-xs text-gray-500 w-1/4">
              {t.time.toDateString()}
            </div>

            <div className="text-sm text-gray-700 w-1/4 text-center">
              User ID: {t.pid ?? "N/A"}
            </div>

            <div className="text-sm w-1/4 text-center">
              Status:{" "}
              <span
                className={
                  t.status === "Success"
                    ? "text-green-600"
                    : t.status === "Failed"
                    ? "text-red-600"
                    : "text-yellow-600"
                }
              >
                {t.status}
              </span>
            </div>

            <div className="text-sm text-right font-semibold w-1/4">
              ₹ {(t.amt / 100).toFixed(2)}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};
