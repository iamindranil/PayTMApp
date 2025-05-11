"use client";

import { useParams } from "next/navigation";
import {QRCodeCanvas} from "qrcode.react"

export default function QRPayPage() {
  const params = useParams();
  const requestId = params?.nextauth?.[0]; // this gets the request ID from the URL

  const qrContent = `paytm-qr://requestId=${requestId}`;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-xl font-bold mb-4">Scan to Pay</h1>
      <QRCodeCanvas value={qrContent} size={256} />
    </div>
  );
}
